'use strict';
// Shared helpers for the NIKOLA MD command pack (nk-*.js plugins).
const fs = require('fs');
const path = require('path');
const axios = require('axios');
const { execFile } = require('child_process');
const { loadUserDatabase, saveUserDatabase } = require('./database.js');
const { getGroupRoles } = require('./group-antis.js');

let FFMPEG = 'ffmpeg';
try { const fp = require('@ffmpeg-installer/ffmpeg').path; if (typeof fp === 'string' && fp) FFMPEG = fp; } catch (e) {}

const TMP_DIR = path.join(__dirname, '..', 'Temp');
const ASSETS = path.join(__dirname, '..', 'Assets');
try { fs.mkdirSync(TMP_DIR, { recursive: true }); } catch (e) {}

const UA = 'Mozilla/5.0 (Linux; Android 12) AppleWebKit/537.36 Chrome/124 Mobile Safari/537.36';
const rand = () => Math.random().toString(36).slice(2, 10);
const tmpFile = (ext) => path.join(TMP_DIR, `nk_${Date.now()}_${rand()}${ext.startsWith('.') ? ext : '.' + ext}`);
const unlink = (...files) => files.forEach((f) => { try { fs.unlinkSync(f); } catch (e) {} });

// ---------- ffmpeg ----------
function ff(args, timeout = 120000) {
  return new Promise((resolve, reject) => {
    execFile(FFMPEG, ['-y', '-hide_banner', '-loglevel', 'error', ...args], { timeout, maxBuffer: 1 << 26 }, (err, so, se) => {
      if (err) return reject(new Error((se || err.message || 'ffmpeg failed').toString().slice(0, 300)));
      resolve();
    });
  });
}

// Run ffmpeg on a buffer. `build(inPath, outPath)` returns the argument list.
async function ffBuffer(buffer, inExt, outExt, build, timeout) {
  const inp = tmpFile(inExt), out = tmpFile(outExt);
  fs.writeFileSync(inp, buffer);
  try {
    await ff(build(inp, out), timeout);
    return fs.readFileSync(out);
  } finally { unlink(inp, out); }
}

// ---------- http ----------
async function getJSON(url, opts = {}) {
  const r = await axios.get(url, { timeout: 30000, headers: { 'User-Agent': UA }, ...opts });
  return r.data;
}
async function getBuf(url, opts = {}) {
  const r = await axios.get(url, { timeout: 60000, responseType: 'arraybuffer', headers: { 'User-Agent': UA }, ...opts });
  return Buffer.from(r.data);
}
async function postJSON(url, body, headers = {}, timeout = 60000) {
  const r = await axios.post(url, body, { timeout, headers: { 'Content-Type': 'application/json', ...headers } });
  return r.data;
}

// ---------- settings ----------
async function saveSettings(db, sessionId) {
  await saveUserDatabase(sessionId, db);
}
const onOff = (v) => /^(on|enable|true|yes|1)$/i.test(v || '') ? true : /^(off|disable|false|no|0)$/i.test(v || '') ? false : null;

// ---------- messages ----------
// Returns { buffer, mime } for media on the replied-to message (or the message itself).
async function getMedia(m) {
  const q = m.quoted || m.msg?.quoted || null;
  const src = q && (q.mimetype || q.msg?.mimetype) ? q : (m.mimetype || m.msg?.mimetype ? m : null);
  if (!src) return null;
  const mime = src.mimetype || src.msg?.mimetype;
  const buffer = await src.download();
  return { buffer, mime };
}
const quotedText = (m) => (m.quoted && (m.quoted.text || m.quoted.body || m.quoted.msg?.text || m.quoted.msg?.caption || m.quoted.msg?.conversation)) || '';
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const bare = (jid) => String(jid || '').split('@')[0].split(':')[0];

async function groupGuard(Cypher, m, { needBotAdmin = true, needSenderAdmin = true } = {}) {
  if (!m.isGroup) { await m.reply('⚠️ This command only works in groups.'); return null; }
  const roles = await getGroupRoles(Cypher, m);
  if (needSenderAdmin && !roles.isSenderAdmin) { await m.reply('⚠️ Only group admins can use this command.'); return null; }
  if (needBotAdmin && !roles.isBotAdmin) { await m.reply('⚠️ Make the bot an admin first.'); return null; }
  return roles;
}

// Target user: mention, reply, or number in text
function pickTarget(m, text) {
  if (m.mentionedJid && m.mentionedJid[0]) return m.mentionedJid[0];
  if (m.quoted && m.quoted.sender) return m.quoted.sender;
  const n = String(text || '').replace(/[^0-9]/g, '');
  return n.length >= 7 ? n + '@s.whatsapp.net' : null;
}

async function uploadCatbox(buffer, filename = 'file.bin') {
  const FormData = require('form-data');
  const form = new FormData();
  form.append('reqtype', 'fileupload');
  form.append('fileToUpload', buffer, { filename });
  const r = await axios.post('https://catbox.moe/user/api.php', form, { headers: form.getHeaders(), timeout: 60000 });
  if (!/^https?:\/\//.test(String(r.data))) throw new Error('Upload failed');
  return String(r.data).trim();
}

// ---------- AI ----------
const env = (k) => (process.env[k] || '').trim();
const PROVIDERS = {
  openai:     { name: 'ChatGPT',    key: 'OPENAI_API_KEY',     url: 'https://api.openai.com/v1/chat/completions',           model: () => env('NK_OPENAI_MODEL') || 'gpt-4o-mini' },
  deepseek:   { name: 'DeepSeek',   key: 'DEEPSEEK_API_KEY',   url: 'https://api.deepseek.com/chat/completions',            model: () => env('NK_DEEPSEEK_MODEL') || 'deepseek-chat' },
  grok:       { name: 'Grok',       key: 'XAI_API_KEY',        url: 'https://api.x.ai/v1/chat/completions',                 model: () => env('NK_GROK_MODEL') || 'grok-3' },
  mistral:    { name: 'Mistral',    key: 'MISTRAL_API_KEY',    url: 'https://api.mistral.ai/v1/chat/completions',           model: () => env('NK_MISTRAL_MODEL') || 'mistral-small-latest' },
  perplexity: { name: 'Perplexity', key: 'PERPLEXITY_API_KEY', url: 'https://api.perplexity.ai/chat/completions',           model: () => env('NK_PERPLEXITY_MODEL') || 'sonar' },
  llama:      { name: 'Llama',      key: 'GROQ_API_KEY',       url: 'https://api.groq.com/openai/v1/chat/completions',      model: () => env('NK_LLAMA_MODEL') || 'llama-3.3-70b-versatile' },
  kimi:       { name: 'Kimi',       key: 'GROQ_API_KEY',       url: 'https://api.groq.com/openai/v1/chat/completions',      model: () => env('NK_KIMI_MODEL') || 'moonshotai/kimi-k2-instruct' },
  qwen:       { name: 'Qwen',       key: 'GROQ_API_KEY',       url: 'https://api.groq.com/openai/v1/chat/completions',      model: () => env('NK_QWEN_MODEL') || 'qwen/qwen3-32b' },
};

async function openaiStyle(p, messages) {
  const d = await postJSON(p.url, { model: p.model(), messages }, { Authorization: `Bearer ${env(p.key)}` }, 60000);
  return d?.choices?.[0]?.message?.content?.replace(/<think>[\s\S]*?<\/think>/g, '').trim();
}

async function anthropicAsk(messages, system, image) {
  const msgs = messages.map((x) => ({ role: x.role, content: x.content }));
  if (image) {
    const last = msgs[msgs.length - 1];
    last.content = [
      { type: 'image', source: { type: 'base64', media_type: image.mime || 'image/jpeg', data: image.buffer.toString('base64') } },
      { type: 'text', text: last.content }
    ];
  }
  const d = await postJSON('https://api.anthropic.com/v1/messages', {
    model: env('NK_CLAUDE_MODEL') || 'claude-haiku-4-5-20251001', max_tokens: 1500, system: system || undefined, messages: msgs
  }, { 'x-api-key': env('ANTHROPIC_API_KEY'), 'anthropic-version': '2023-06-01' }, 60000);
  return d?.content?.map((c) => c.text || '').join('').trim();
}

async function geminiAsk(messages, system, image) {
  const model = env('NK_GEMINI_MODEL') || 'gemini-2.0-flash';
  const contents = messages.map((x) => ({ role: x.role === 'assistant' ? 'model' : 'user', parts: [{ text: x.content }] }));
  if (image) contents[contents.length - 1].parts.unshift({ inline_data: { mime_type: image.mime || 'image/jpeg', data: image.buffer.toString('base64') } });
  const d = await postJSON(`https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${env('GEMINI_API_KEY')}`,
    { contents, systemInstruction: system ? { parts: [{ text: system }] } : undefined }, {}, 60000);
  return d?.candidates?.[0]?.content?.parts?.map((p) => p.text || '').join('').trim();
}

// Free fallback services (no key). They answer with whatever model the service runs.
async function freeAsk(messages, system) {
  const msgs = (system ? [{ role: 'system', content: system }] : []).concat(messages);
  try {
    const d = await postJSON('https://text.pollinations.ai/openai', { model: 'openai', messages: msgs }, {}, 60000);
    const t = d?.choices?.[0]?.message?.content?.trim();
    if (t) return t;
  } catch (e) {}
  const { cod3api } = require('./cod3uchiha-api.js');
  const last = messages[messages.length - 1].content;
  const d = await cod3api('/ai/gpt5', { text: (system ? system + '\n\n' : '') + last }, 45000);
  return d?.result;
}

// provider: 'openai' | 'claude' | 'gemini' | 'deepseek' | ... | 'free'
async function askAI(provider, prompt, { system, history = [], image } = {}) {
  const messages = history.concat([{ role: 'user', content: prompt }]);
  let text, label = 'NIKOLA AI';
  if (provider === 'claude' && env('ANTHROPIC_API_KEY')) { text = await anthropicAsk(messages, system, image); label = 'Claude'; }
  else if (provider === 'gemini' && env('GEMINI_API_KEY')) { text = await geminiAsk(messages, system, image); label = 'Gemini'; }
  else if (PROVIDERS[provider] && env(PROVIDERS[provider].key)) {
    const p = PROVIDERS[provider];
    text = await openaiStyle(p, (system ? [{ role: 'system', content: system }] : []).concat(messages)); label = p.name;
  } else if (image) {
    // Vision needs a provider key.
    if (env('GEMINI_API_KEY')) { text = await geminiAsk(messages, system, image); label = 'Gemini'; }
    else if (env('ANTHROPIC_API_KEY')) { text = await anthropicAsk(messages, system, image); label = 'Claude'; }
    else if (env('OPENAI_API_KEY')) throw new Error('Image analysis needs GEMINI_API_KEY or ANTHROPIC_API_KEY');
    else throw new Error('Image analysis needs GEMINI_API_KEY or ANTHROPIC_API_KEY in your environment settings.');
  } else { text = await freeAsk(messages, system); }
  if (!text) throw new Error('No response received. Try again.');
  return { text, label };
}

module.exports = {
  FFMPEG, TMP_DIR, ASSETS, UA, tmpFile, unlink, ff, ffBuffer, getJSON, getBuf, postJSON,
  saveSettings, onOff, getMedia, quotedText, sleep, bare, groupGuard, pickTarget, uploadCatbox,
  askAI, loadUserDatabase, saveUserDatabase
};
