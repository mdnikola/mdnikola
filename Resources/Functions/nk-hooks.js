'use strict';
// Background features: antispam, antisticker, autobio. Flags are kept in a small JSON file.
const fs = require('fs');
const path = require('path');

const FLAGS_FILE = path.join(__dirname, '..', 'nk-data.json');
const read = () => { try { return JSON.parse(fs.readFileSync(FLAGS_FILE, 'utf8')); } catch (e) { return {}; } };
const write = (d) => { try { fs.writeFileSync(FLAGS_FILE, JSON.stringify(d, null, 1)); } catch (e) {} };

const getFlag = (scope, key, def = false) => { const d = read(); return (d[scope] && d[scope][key] !== undefined) ? d[scope][key] : def; };
const setFlag = (scope, key, val) => { const d = read(); d[scope] = d[scope] || {}; d[scope][key] = val; write(d); };

// Names the bot should use instead of the original UltraX defaults.
const BRAND = { botname: 'NIKOLA MD', packname: 'NIKOLA MD', authorname: 'Nikola', ownername: 'Nikola' };
function bootstrapBrand(db) {
  if (!db) return false;
  let changed = false;
  const old = /ultra|cypher/i;
  if (!db.botname || old.test(db.botname)) { db.botname = BRAND.botname; changed = true; }
  if (!db.packname || old.test(db.packname)) { db.packname = BRAND.packname; changed = true; }
  if (!db.authorname || /^ultra$/i.test(db.authorname)) { db.authorname = BRAND.authorname; changed = true; }
  if (!db.ownername || db.ownername === 'Tylor') { db.ownername = BRAND.ownername; changed = true; }
  if (db.author !== undefined && /ultra/i.test(db.author)) { db.author = BRAND.authorname; changed = true; }
  return changed;
}

const attached = new WeakSet();
const spam = new Map();     // chat|user -> timestamps
const strikes = new Map();
const adminCache = new Map();

async function isAdmin(sock, chat, jid) {
  const hit = adminCache.get(chat);
  let meta = hit && Date.now() - hit.t < 60000 ? hit.meta : null;
  if (!meta) { meta = await sock.groupMetadata(chat); adminCache.set(chat, { t: Date.now(), meta }); }
  const num = String(jid).split('@')[0].split(':')[0];
  return meta.participants.some((p) => p.admin && (String(p.id).split('@')[0].split(':')[0] === num || String(p.phoneNumber || '').split('@')[0] === num));
}

function attachHooks(sock, sessionId = 'main') {
  if (!sock || !sock.ev || attached.has(sock)) return;
  attached.add(sock);

  sock.ev.on('messages.upsert', async ({ messages }) => {
    for (const msg of messages || []) {
      try {
        const chat = msg.key?.remoteJid;
        if (!chat || !chat.endsWith('@g.us') || msg.key.fromMe) continue;
        const sender = msg.key.participant || msg.participant;
        if (!sender) continue;
        const flagsAntispam = getFlag(chat, 'antispam');
        const flagsSticker = getFlag(chat, 'antisticker');
        if (!flagsAntispam && !flagsSticker) continue;
        if (await isAdmin(sock, chat, sender)) continue;

        if (flagsSticker && msg.message?.stickerMessage) {
          await sock.sendMessage(chat, { delete: msg.key });
          continue;
        }
        if (flagsAntispam) {
          const k = chat + '|' + sender, now = Date.now();
          const arr = (spam.get(k) || []).filter((t) => now - t < 6000); arr.push(now); spam.set(k, arr);
          if (arr.length > 6) {
            spam.set(k, []);
            const n = (strikes.get(k) || 0) + 1; strikes.set(k, n);
            await sock.sendMessage(chat, { text: `⚠️ @${sender.split('@')[0]} stop spamming! (${n}/3)`, mentions: [sender] });
            if (n >= 3) { strikes.delete(k); await sock.groupParticipantsUpdate(chat, [sender], 'remove'); }
          }
        }
      } catch (e) { /* bot is probably not admin; ignore */ }
    }
  });

  // autobio: refresh profile status once a minute while enabled
  const quotes = ['Powered by NIKOLA MD', 'Stay curious.', 'Always online with NIKOLA MD', 'Build. Learn. Repeat.'];
  const timer = setInterval(async () => {
    try {
      if (!getFlag('bot:' + sessionId, 'autobio')) return;
      const now = new Date().toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' });
      await sock.updateProfileStatus(`🤖 NIKOLA MD • ${now} • ${quotes[Math.floor(Date.now() / 60000) % quotes.length]}`);
    } catch (e) {}
  }, 60000);
  if (timer.unref) timer.unref();
}

// Attach to every active session now and as new ones appear.
function startPoller() {
  let activeSessions;
  try { activeSessions = require('../Events/connection.js').activeSessions; } catch (e) { return; }
  const tick = () => {
    try {
      for (const [id, v] of activeSessions.entries()) {
        const sock = v && v.ev ? v : (v && (v.sock || v.socket || v.Cypher || v.client)) || null;
        if (sock) attachHooks(sock, id);
      }
    } catch (e) {}
  };
  const t = setInterval(tick, 15000); if (t.unref) t.unref();
  setTimeout(tick, 5000);
}
let started = false;
function ensurePoller() { if (!started) { started = true; startPoller(); } }

module.exports = { getFlag, setFlag, bootstrapBrand, attachHooks, ensurePoller, BRAND };
