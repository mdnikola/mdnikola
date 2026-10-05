/**
 * NIKOLA MD Pair Server
 *
 * Two roles in one process:
 *   1. Pair site (web UI + WebSocket):
 *        - User visits site → WebSocket connection opens
 *        - Server creates a Baileys session and emits QR
 *        - User scans QR with WhatsApp → creds captured
 *        - Server gzips + base64-encodes creds → "NIKOLA MD:H4sI<base64>" (full session)
 *        - Server generates 20-char short code, stores full session in memory (30 min TTL)
 *        - Server sends "NIKOLA MD:<20-char-code>" (30 chars total) to the user via WebSocket
 *        - User pastes into Heroku/Render as SESSION_ID env var
 *
 *   2. Bot entry point (when SESSION_ID env var is set):
 *        - Reads SESSION_ID = "NIKOLA MD:<code>"
 *        - Extracts the 20-char code
 *        - Fetches full session via GET http://self/session/<code>
 *        - Decompresses creds, writes creds.json
 *        - Connects Baileys with those creds → bot is online
 *
 *   3. Endpoint for the bot to fetch the full session:
 *        GET /session/:code → returns "NIKOLA MD:H4sI<base64>"
 *
 * How to use:
 *   - Pair-only mode: just run `npm start` with no SESSION_ID env var. Site is live.
 *   - Bot mode: set SESSION_ID env var. Bot will start and connect to WhatsApp.
 *   - Both can run on the same dyno (pair site stays up + bot connects in background).
 */

const express = require('express');
const http = require('http');
const path = require('path');
const crypto = require('crypto');
const fs = require('fs-extra');
const zlib = require('zlib');
const { WebSocketServer } = require('ws');
const QRCode = require('qrcode');
const pino = require('pino');
const {
    default: makeWASocket,
    useMultiFileAuthState,
    DisconnectReason,
    fetchLatestBaileysVersion,
} = require('@whiskeysockets/baileys');
const { Boom } = require('@hapi/boom');

// ─── Config ────────────────────────────────────────────────────────────
const PORT = process.env.PORT || 3000;
const MASTER_PASSWORD = process.env.MASTER_PASSWORD || 'nikola-md-internal';
const PREFIX = 'NIKOLA MD:';
const CODE_LENGTH = 20;                              // 20-char short code
const SESSION_TTL_MS = 30 * 60 * 1000;               // 30 minutes
const CLEANUP_INTERVAL_MS = 60 * 1000;
const TMP_DIR = path.join(__dirname, 'tmp');
const SESSIONS_DIR = path.join(__dirname, 'sessions');

// In-memory session store: code → { fullSession, expiresAt }
const sessions = new Map();

// Periodic cleanup of expired sessions
setInterval(() => {
    const now = Date.now();
    for (const [code, entry] of sessions.entries()) {
        if (entry.expiresAt < now) {
            sessions.delete(code);
            console.log(`[cleanup] expired session ${code}`);
        }
    }
}, CLEANUP_INTERVAL_MS);

// ─── Utilities ─────────────────────────────────────────────────────────
function generateShortCode() {
    return crypto.randomBytes(15).toString('base64url').slice(0, CODE_LENGTH);
}

async function captureSessionCreds(sessionDir) {
    const credsPath = path.join(sessionDir, 'creds.json');
    if (!fs.existsSync(credsPath)) {
        throw new Error('creds.json not found — session may not have completed pairing');
    }
    const credsJson = await fs.readFile(credsPath, 'utf8');
    JSON.parse(credsJson); // validate
    const gzipped = zlib.gzipSync(Buffer.from(credsJson, 'utf8'));
    const b64 = gzipped.toString('base64');
    return PREFIX + b64; // "NIKOLA MD:H4sIAAAAAAAAA..."
}

async function ensureDirs() {
    await fs.ensureDir(TMP_DIR);
    await fs.ensureDir(SESSIONS_DIR);
}

// ─── Express app ───────────────────────────────────────────────────────
const app = express();
const server = http.createServer(app);
app.use(express.static(path.join(__dirname, 'public')));
app.use(express.json());

/**
 * GET /session/:code
 * Returns the full session string "NIKOLA MD:H4sI<base64>" for the bot to fetch.
 * Single-use by default (deletes after fetch) — change to keep-alive by commenting the delete line.
 */
app.get('/session/:code', (req, res) => {
    const code = req.params.code;
    const entry = sessions.get(code);
    if (!entry) return res.status(404).type('text/plain').send('Session not found');
    if (Date.now() > entry.expiresAt) {
        sessions.delete(code);
        return res.status(410).type('text/plain').send('Session expired');
    }
    res.type('text/plain').send(entry.fullSession);
});

app.get('/health', (req, res) => {
    res.json({
        status: 'alive',
        activeSessions: sessions.size,
        botMode: !!process.env.SESSION_ID,
        uptime: process.uptime(),
    });
});

// ─── WebSocket server (for live QR + session ID updates) ──────────────
const wss = new WebSocketServer({ server, path: '/ws' });

wss.on('connection', async (ws) => {
    const connectionId = `pairing-${Date.now()}-${crypto.randomBytes(4).toString('hex')}`;
    const sessionDir = path.join(TMP_DIR, connectionId);
    console.log(`[ws] new connection ${connectionId}`);

    let sock = null;
    let connectionOpen = false;

    try {
        await fs.ensureDir(sessionDir);
        const { state, saveCreds } = await useMultiFileAuthState(sessionDir);
        const { version } = await fetchLatestBaileysVersion();

        sock = makeWASocket({
            version,
            auth: state,
            printQRInTerminal: false,
            logger: pino({ level: 'silent' }),
            browser: ['NIKOLA-MD', 'Chrome', '1.0.0'],
        });

        const cleanup = async () => {
            try {
                if (sock) {
                    sock.ev.removeAllListeners();
                    sock.end && sock.end();
                }
                await fs.remove(sessionDir);
            } catch (e) {
                console.error(`[ws] cleanup error for ${connectionId}:`, e.message);
            }
        };

        sock.ev.on('creds.update', saveCreds);

        sock.ev.on('connection.update', async (update) => {
            const { connection, lastDisconnect, qr } = update;

            if (qr) {
                try {
                    const dataUrl = await QRCode.toDataURL(qr, { width: 320 });
                    if (ws.readyState === ws.OPEN) {
                        ws.send(JSON.stringify({ type: 'qr', qr: dataUrl }));
                    }
                } catch (e) {
                    console.error('[ws] QR generation failed:', e.message);
                }
            }

            if (connection === 'open') {
                connectionOpen = true;
                try {
                    await saveCreds();
                    const fullSession = await captureSessionCreds(sessionDir);
                    const shortCode = generateShortCode();

                    sessions.set(shortCode, {
                        fullSession,
                        expiresAt: Date.now() + SESSION_TTL_MS,
                    });

                    if (ws.readyState === ws.OPEN) {
                        ws.send(JSON.stringify({
                            type: 'session_id',
                            id: PREFIX + shortCode,
                            fullLength: (PREFIX + shortCode).length,
                            expiresIn: SESSION_TTL_MS,
                        }));
                    }
                    console.log(`[ws] ${connectionId} paired, code=${shortCode}`);
                } catch (e) {
                    console.error(`[ws] capture failed for ${connectionId}:`, e.message);
                    if (ws.readyState === ws.OPEN) {
                        ws.send(JSON.stringify({ type: 'error', message: 'Failed to capture session: ' + e.message }));
                    }
                } finally {
                    await cleanup();
                }
            }

            if (connection === 'close') {
                const statusCode = lastDisconnect?.error?.output?.statusCode;
                if (statusCode === DisconnectReason.loggedOut) {
                    console.log(`[ws] ${connectionId} logged out`);
                    await cleanup();
                    if (ws.readyState === ws.OPEN) {
                        ws.send(JSON.stringify({ type: 'closed', reason: 'logged_out' }));
                    }
                } else if (!connectionOpen) {
                    console.log(`[ws] ${connectionId} closed (code ${statusCode}) before pairing — reconnecting`);
                    // Allow reconnect via fresh socket — frontend just reconnects WebSocket
                } else {
                    await cleanup();
                }
            }
        });

        ws.on('close', async () => {
            console.log(`[ws] ${connectionId} disconnected`);
            await cleanup();
        });

        ws.on('error', async (err) => {
            console.error(`[ws] ${connectionId} error:`, err.message);
            await cleanup();
        });

    } catch (e) {
        console.error('[ws] init failed:', e.message);
        if (ws.readyState === ws.OPEN) {
            ws.send(JSON.stringify({ type: 'error', message: 'Failed to initialize: ' + e.message }));
        }
    }
});

// ─── Bot mode (when SESSION_ID is set) ────────────────────────────────
async function startBot() {
    const sessionId = process.env.SESSION_ID;
    if (!sessionId || !sessionId.startsWith(PREFIX)) {
        console.log('[bot] No valid SESSION_ID env var — running in pair-only mode');
        return;
    }

    const shortCode = sessionId.slice(PREFIX.length).trim();
    if (shortCode.length !== CODE_LENGTH) {
        console.error(`[bot] SESSION_ID code must be ${CODE_LENGTH} chars (got ${shortCode.length})`);
        return;
    }

    console.log(`[bot] Resolving session ${shortCode}...`);

    // Determine self URL — Heroku provides the app's URL via app.json env var, fallback to localhost
    const selfUrl = process.env.SELF_URL || `http://localhost:${PORT}`;
    const fetchUrl = `${selfUrl}/session/${shortCode}`;

    let fullSession;
    try {
        const res = await fetch(fetchUrl);
        if (!res.ok) {
            throw new Error(`HTTP ${res.status}: ${await res.text()}`);
        }
        fullSession = (await res.text()).trim();
        console.log(`[bot] Fetched full session (${fullSession.length} chars)`);
    } catch (err) {
        console.error(`[bot] Failed to fetch session from ${fetchUrl}:`, err.message);
        console.error(`[bot] Make sure SELF_URL env var points to your live pair site URL.`);
        return;
    }

    // Decode: strip prefix, base64-decode, gunzip → creds.json
    if (!fullSession.startsWith(PREFIX)) {
        console.error('[bot] Fetched session does not start with', PREFIX);
        return;
    }
    const b64 = fullSession.slice(PREFIX.length);
    let credsJson;
    try {
        const gzipped = Buffer.from(b64, 'base64');
        credsJson = zlib.gunzipSync(gzipped).toString('utf8');
        JSON.parse(credsJson); // validate
    } catch (err) {
        console.error('[bot] Failed to decode session:', err.message);
        return;
    }

    // Write creds to disk and start Baileys with that auth state
    const botSessionDir = path.join(SESSIONS_DIR, 'bot');
    await fs.ensureDir(botSessionDir);
    await fs.writeFile(path.join(botSessionDir, 'creds.json'), credsJson);
    console.log('[bot] Wrote creds.json — connecting to WhatsApp...');

    const { state, saveCreds } = await useMultiFileAuthState(botSessionDir);
    const { version } = await fetchLatestBaileysVersion();

    const botSock = makeWASocket({
        version,
        auth: state,
        printQRInTerminal: false,
        logger: pino({ level: 'silent' }),
        browser: ['NIKOLA-MD-Bot', 'Chrome', '1.0.0'],
    });

    botSock.ev.on('creds.update', saveCreds);

    botSock.ev.on('connection.update', (update) => {
        const { connection, lastDisconnect } = update;
        if (connection === 'open') {
            console.log(`[bot] ✓ Bot online as ${botSock.user?.id}`);
            try {
                const ownerJid = botSock.user.id;
                botSock.sendMessage(ownerJid, {
                    text: '🟢 NIKOLA MD connected!\n\nSend .ping to test.\nSend .menu for commands.',
                }).catch(() => {});
            } catch (_) {}
        } else if (connection === 'close') {
            const shouldReconnect = lastDisconnect?.error instanceof Boom
                ? lastDisconnect.error.output.statusCode !== DisconnectReason.loggedOut
                : true;
            if (shouldReconnect) {
                console.log('[bot] ↻ Reconnecting in 5s...');
                setTimeout(startBot, 5000);
            } else {
                console.log('[bot] ✗ Logged out — session invalid');
            }
        }
    });

    botSock.ev.on('messages.upsert', async ({ messages }) => {
        const m = messages[0];
        if (!m.message || m.key.fromMe) return;
        const text =
            m.message.conversation ||
            m.message.extendedTextMessage?.text ||
            '';
        const cmd = text.trim().toLowerCase();
        if (cmd === '.ping') {
            await botSock.sendMessage(m.key.remoteJid, { text: '🏓 Pong! NIKOLA MD is alive.' });
        } else if (cmd === '.menu') {
            await botSock.sendMessage(m.key.remoteJid, {
                text: '🤖 NIKOLA MD\n\nCommands:\n.ping — check if bot is alive\n.menu — show this menu\n\nAdd your own commands in server.js (messages.upsert handler).',
            });
        }
    });
}

// ─── Start ─────────────────────────────────────────────────────────────
(async () => {
    await ensureDirs();

    server.listen(PORT, () => {
        console.log('');
        console.log('╔════════════════════════════════════════════════════════════╗');
        console.log('║       𝐍𝐈𝐊𝐎𝐋𝐀-𝐌𝐃 Pair Server v1.0.0                       ║');
        console.log('╚════════════════════════════════════════════════════════════╝');
        console.log('');
        console.log(`✅ HTTP server:        http://localhost:${PORT}`);
        console.log(`✅ WebSocket endpoint: ws://localhost:${PORT}/ws`);
        console.log(`✅ Session fetch:      GET /session/<code>`);
        console.log(`✅ Health check:       GET /health`);
        console.log('');
        console.log(`📦 Session ID format:  ${PREFIX}<${CODE_LENGTH}-char-code>  (${PREFIX.length + CODE_LENGTH} chars total)`);
        console.log(`⏱  Session TTL:        ${SESSION_TTL_MS / 60000} minutes`);
        console.log(`🔑 Master password:    ${MASTER_PASSWORD === 'nikola-md-internal' ? '(default)' : '(custom)'}`);
        console.log('');
        if (process.env.SESSION_ID) {
            console.log(`🤖 Bot mode: ENABLED (SESSION_ID detected)`);
            console.log(`🌐 SELF_URL:           ${process.env.SELF_URL || '(not set — bot will fail to fetch session!)'}`);
            console.log('');
            startBot().catch(err => console.error('[bot] startup error:', err));
        } else {
            console.log(`🌐 Pair-only mode: ENABLED (no SESSION_ID env var)`);
            console.log('');
            console.log('Waiting for connections...');
        }
    });
})();
