/**
 * NIKOLA Pair Site — server.js
 *
 * Flow:
 *   1. Visitor opens site → enters phone + master password
 *   2. POST /api/pair → server starts a Baileys socket, requests pairing code
 *   3. Server returns 8-char code → visitor types it into WhatsApp
 *      (Settings → Linked Devices → Link with phone number)
 *   4. Baileys fires connection.update → "open" → bot is online
 *   5. Visitor polls GET /api/status/:phone → sees "Pairing successful"
 *   6. Bot stays alive, responds to .ping / .menu
 */

const express = require('express');
const path = require('path');
const fs = require('fs');
const P = require('pino');
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
const SESSIONS_DIR = path.join(__dirname, 'sessions');

if (!fs.existsSync(SESSIONS_DIR)) fs.mkdirSync(SESSIONS_DIR, { recursive: true });

// phone -> sock instance
const sessions = new Map();

// ─── Baileys socket starter ────────────────────────────────────────────
async function startSock(phone) {
  const sessionDir = path.join(SESSIONS_DIR, phone);
  if (!fs.existsSync(sessionDir)) fs.mkdirSync(sessionDir, { recursive: true });

  const { state, saveCreds } = await useMultiFileAuthState(sessionDir);
  const { version } = await fetchLatestBaileysVersion();

  const sock = makeWASocket({
    version,
    auth: state,
    printQRInTerminal: false,
    logger: P({ level: 'silent' }),
    browser: ['NIKOLA-Pair', 'Chrome', '1.0.0'],
    generateHighQualityLinkPreview: true,
  });

  sock.ev.on('creds.update', saveCreds);

  sock.ev.on('connection.update', async (update) => {
    const { connection, lastDisconnect } = update;
    if (connection === 'open') {
      console.log(`[PAIR] ✓ ${phone} connected`);
    } else if (connection === 'close') {
      const shouldReconnect = lastDisconnect?.error instanceof Boom
        ? lastDisconnect.error.output.statusCode !== DisconnectReason.loggedOut
        : true;
      if (shouldReconnect) {
        console.log(`[PAIR] ↻ ${phone} reconnecting...`);
        await startSock(phone);
      } else {
        console.log(`[PAIR] ✗ ${phone} logged out — cleaning session`);
        fs.rmSync(sessionDir, { recursive: true, force: true });
        sessions.delete(phone);
      }
    }
  });

  // Minimal bot — proof that pairing worked
  sock.ev.on('messages.upsert', async ({ messages }) => {
    const m = messages[0];
    if (!m.message || m.key.fromMe) return;
    const text = m.message.conversation
      || m.message.extendedTextMessage?.text
      || '';
    const cmd = text.trim().toLowerCase();
    if (cmd === '.ping') {
      await sock.sendMessage(m.key.remoteJid, { text: '🏓 Pong! Bot is alive.' });
    } else if (cmd === '.menu') {
      await sock.sendMessage(m.key.remoteJid, {
        text: '🤖 NIKOLA Pair Site Bot\n\nCommands:\n.ping — check if bot is alive\n.menu — show this menu',
      });
    }
  });

  sessions.set(phone, sock);
  return sock;
}

// ─── Express app ───────────────────────────────────────────────────────
const app = express();
app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

// Pair endpoint
app.post('/api/pair', async (req, res) => {
  try {
    const { phone, password } = req.body || {};

    if (!phone || typeof phone !== 'string') {
      return res.status(400).json({ error: 'Phone number is required' });
    }
    if (!password || password !== MASTER_PASSWORD) {
      return res.status(401).json({ error: 'Invalid master password' });
    }

    const cleanPhone = phone.replace(/\D/g, '');
    if (cleanPhone.length < 10 || cleanPhone.length > 15) {
      return res.status(400).json({ error: 'Phone number must be 10–15 digits' });
    }

    const sock = await startSock(cleanPhone);

    if (sock.authState.creds.registered) {
      return res.json({
        success: true,
        alreadyPaired: true,
        message: 'This number is already paired. Bot is online.',
      });
    }

    // Request 8-char pairing code from WhatsApp
    const code = await sock.requestPairingCode(cleanPhone);

    return res.json({
      success: true,
      pairingCode: code,
      message: 'Enter this code in WhatsApp → Settings → Linked Devices → Link with phone number',
    });
  } catch (err) {
    console.error('[PAIR ERROR]', err);
    return res.status(500).json({
      error: 'Pairing failed: ' + (err.message || 'Unknown error'),
    });
  }
});

// Status endpoint — frontend polls this after generating a code
app.get('/api/status/:phone', (req, res) => {
  const phone = (req.params.phone || '').replace(/\D/g, '');
  const sock = sessions.get(phone);
  if (!sock) return res.json({ online: false, paired: false });
  return res.json({
    online: !!sock.user,
    paired: !!sock.user,
    jid: sock.user?.id || null,
  });
});

// SPA fallback
app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

app.listen(PORT, () => {
  const portStr = String(PORT);
  console.log('┌───────────────────────────────────────────┐');
  console.log('│  🚀 NIKOLA Pair Site                      │');
  console.log('│  Listening on: http://localhost:' + portStr.padEnd(8) + '│');
  console.log('│  Master password: ' + (MASTER_PASSWORD === 'nikola-md-internal' ? '(default)' : '(custom)').padEnd(22) + '   │');
  console.log('└───────────────────────────────────────────┘');
});
