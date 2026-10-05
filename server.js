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

// Command handler
const { handleMessage, handleWordleGuess, handleNumberGuess, handleTTT, handleHangman } = require('./commands');

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
    if (!sessionId) {
        console.log('[bot] No SESSION_ID env var — running in pair-only mode');
        return;
    }

    // Normalize: strip any surrounding quotes/whitespace
    const cleanSid = sessionId.trim().replace(/^["']|["']$/g, '');

    // Find the prefix (case-insensitive, flexible on spacing/dots after colon)
    // Accepts: "NIKOLA MD:<...>", "NIKOLA MD:.<...>", "NIKOLA MD: <...>"
    const prefixMatch = cleanSid.match(/^NIKOLA\s*MD\s*[:.]?\s*(.+)$/i);
    if (!prefixMatch) {
        console.error(`[bot] SESSION_ID does not start with "NIKOLA MD:" — got: ${cleanSid.slice(0, 30)}...`);
        console.error('[bot] Running in pair-only mode.');
        return;
    }

    const afterPrefix = prefixMatch[1].trim();
    console.log(`[bot] SESSION_ID detected, payload length: ${afterPrefix.length} chars`);

    let credsJson;

    // The payload can be one of several formats:
    //   1. Plain base64 of creds.json (most common — PairSite format)
    //      Example: "eyJub2lzZUtleSI6..."
    //   2. Base64 of gzipped creds.json (KLAUS-XMD format)
    //      Example: "H4sIAAAAAAAAA..."
    //   3. Short 20-char code → fetch from pair site (our own pair server format)
    //
    // We try them in order: plain base64 → gzipped base64 → short code fetch.

    // CASE 1 & 2: Long payload → decode directly
    if (afterPrefix.length > 50) {
        console.log('[bot] Long payload detected — decoding session from SESSION_ID');

        // Try plain base64 first (PairSite format)
        try {
            const decoded = Buffer.from(afterPrefix, 'base64');
            const text = decoded.toString('utf8');
            // Check if it's valid JSON
            const parsed = JSON.parse(text);
            if (parsed && (parsed.noiseKey || parsed.me || parsed.registered !== undefined)) {
                credsJson = text;
                console.log(`[bot] ✓ Decoded as plain base64 JSON (PairSite format, ${credsJson.length} chars)`);
                if (parsed.me) {
                    console.log(`[bot]   Pairing was for: ${parsed.me.id}`);
                }
            } else {
                throw new Error('JSON missing expected Baileys keys');
            }
        } catch (plainErr) {
            // Try gzipped base64 next (KLAUS-XMD format)
            console.log('[bot] Plain base64 JSON failed, trying gzipped base64...');
            try {
                const gzipped = Buffer.from(afterPrefix, 'base64');
                credsJson = zlib.gunzipSync(gzipped).toString('utf8');
                JSON.parse(credsJson); // validate
                console.log(`[bot] ✓ Decoded as gzipped base64 (KLAUS-XMD format, ${credsJson.length} chars)`);
            } catch (gzErr) {
                console.error('[bot] ✗ Both base64 and gzip decode failed.');
                console.error('[bot]   Plain base64 error:', plainErr.message);
                console.error('[bot]   Gzip error:', gzErr.message);
                console.error('[bot] First 80 chars of payload:', afterPrefix.slice(0, 80));
                return;
            }
        }
    }
    // CASE 3: Short payload (20 chars) → it's a short code, fetch from pair site
    else if (afterPrefix.length === CODE_LENGTH) {
        console.log(`[bot] Short code detected (${afterPrefix}) — fetching from pair site...`);

        // Try PairSite first (where the user actually paired)
        const candidateUrls = [
            `https://nikolamd.pairsite.space/session/${afterPrefix}`,
            `https://nikolamd.pairsite.space/api/session/${afterPrefix}`,
        ];
        if (process.env.SELF_URL) {
            candidateUrls.unshift(`${process.env.SELF_URL}/session/${afterPrefix}`);
        }

        let fetched = false;
        for (const url of candidateUrls) {
            try {
                console.log(`[bot] Trying: ${url}`);
                const res = await fetch(url);
                if (!res.ok) {
                    console.log(`[bot]   → HTTP ${res.status}`);
                    continue;
                }
                const text = (await res.text()).trim();
                // If response looks like HTML (PairSite SPA), skip
                if (text.startsWith('<!DOCTYPE') || text.startsWith('<html')) {
                    console.log(`[bot]   → got HTML (not a session endpoint)`);
                    continue;
                }
                if (text.startsWith('NIKOLA MD:') || text.startsWith('NIKOLA MD:.')) {
                    // Extract payload after prefix
                    const m = text.match(/^NIKOLA\s*MD\s*[:.]?\s*(.+)$/i);
                    if (!m) continue;
                    const payload = m[1].trim();
                    // Try plain base64 first
                    try {
                        credsJson = Buffer.from(payload, 'base64').toString('utf8');
                        JSON.parse(credsJson);
                    } catch {
                        // Try gzipped
                        const gzipped = Buffer.from(payload, 'base64');
                        credsJson = zlib.gunzipSync(gzipped).toString('utf8');
                        JSON.parse(credsJson);
                    }
                    console.log(`[bot] ✓ Fetched + decoded session from ${url}`);
                    fetched = true;
                    break;
                }
                // Maybe the response is just the raw base64
                try {
                    credsJson = Buffer.from(text, 'base64').toString('utf8');
                    JSON.parse(credsJson);
                    console.log(`[bot] ✓ Fetched + decoded session from ${url}`);
                    fetched = true;
                    break;
                } catch {
                    // not base64, skip
                }
            } catch (e) {
                console.log(`[bot]   → error: ${e.message}`);
            }
        }

        if (!fetched) {
            console.error('[bot] ✗ Could not fetch session from any known endpoint.');
            console.error('[bot] If you paired on PairSite, the session may only be stored in memory briefly.');
            console.error('[bot] Re-pair and deploy quickly, or paste the FULL session ID (long one) into SESSION_ID.');
            return;
        }
    } else {
        console.error(`[bot] Unexpected SESSION_ID payload length: ${afterPrefix.length}`);
        console.error(`[bot] Expected either ${CODE_LENGTH} chars (short code) or >50 chars (full session).`);
        console.error('[bot] First 50 chars:', afterPrefix.slice(0, 50));
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

        const text = m.message.conversation || m.message.extendedTextMessage?.text || '';
        if (!text) return;

        // Game guesses (no prefix needed) — each handler returns true if it handled the message
        if (await handleWordleGuess(botSock, m)) return;
        if (await handleNumberGuess(botSock, m)) return;
        if (await handleTTT(botSock, m)) return;
        if (await handleHangman(botSock, m)) return;

        // Regular command handler
        await handleMessage(botSock, m);
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
            console.log('');
            startBot().catch(err => console.error('[bot] startup error:', err));
        } else {
            console.log(`🌐 Pair-only mode: ENABLED (no SESSION_ID env var)`);
            console.log('');
            console.log('Waiting for connections...');
        }
    });
})();
