<p align="center">
  <img src="banner.jpg" width="350" alt="NIKOLA-MD">
</h1>

<h1 align="center">𝐍𝐈𝐊𝐎𝐋𝐀-𝐌𝐃</h1>

<p align="center"><em>A fast, modular, multi-device WhatsApp bot.</em></p>

<p align="center">
  <a href="https://nikolamd.pairsite.space">
    <img src="https://img.shields.io/badge/Pair-Get_Session-blue?style=flat-square" alt="Pair">
  </a>
  <a href="https://dashboard.heroku.com/new?template=https://github.com/mdnikola/mdnikola">
    <img src="https://img.shields.io/badge/Heroku-Deploy-red?style=flat-square" alt="Heroku">
  </a>
  <a href="https://render.com/deploy">
    <img src="https://img.shields.io/badge/Render-Deploy-orange?style=flat-square" alt="Render">
  </a>
  <a href="https://github.com/mdnikola/mdnikola">
    <img src="https://img.shields.io/badge/Repo-GitHub-green?style=flat-square" alt="Repo">
  </a>
  <a href="https://chat.whatsapp.com/">
    <img src="https://img.shields.io/badge/Group-WhatsApp-blue?style=flat-square" alt="Group">
  </a>
</p>

---

### Setup

1. **Pair** — click <kbd>Pair</kbd> above, scan the QR with WhatsApp, copy the `NIKOLA MD:...` session ID
2. **Fork** — click <kbd>Repo</kbd> above, then **Fork** the repo to your account
3. **Deploy** — click <kbd>Heroku</kbd> or <kbd>Render</kbd> above, paste your `SESSION_ID` when prompted

> ⚠️ Session ID format: `NIKOLA MD:<20-char-code>` (exactly 30 characters total)

---

### How it works

```
┌──────────────────────────────────────────────────────────┐
│  1. PAIR SITE  (https://nikolamd.pairsite.space)         │
│     • User opens site → WebSocket connects               │
│     • Server creates Baileys session, emits QR           │
│     • User scans QR with WhatsApp                        │
│     • Server captures creds, gzips + base64-encodes      │
│     • Server generates 20-char code, stores full session │
│     • Server returns "NIKOLA MD:<20-char-code>" to user  │
└──────────────────────────────────────────────────────────┘
                          │
                          ▼
┌──────────────────────────────────────────────────────────┐
│  2. DEPLOY  (Heroku / Render)                            │
│     • User pastes SESSION_ID = "NIKOLA MD:<code>"        │
│     • User sets SELF_URL = https://their-app.herokuapp.com│
│     • App boots → reads SESSION_ID env var               │
│     • Bot fetches full session via GET /session/<code>   │
│     • Bot decompresses creds → writes creds.json         │
│     • Bot connects to WhatsApp as the paired user        │
│     • ✅ Bot online — responds to .ping and .menu        │
└──────────────────────────────────────────────────────────┘
```

### Endpoints

| Endpoint | Purpose |
|----------|---------|
| `GET /` | Pair site UI (QR code + session ID display) |
| `WS /ws` | WebSocket — receives QR updates, returns session ID |
| `GET /session/:code` | Bot fetches full session string by 20-char code |
| `GET /health` | Health check — returns status, active sessions, uptime |

### Environment variables

| Variable | Required | Description |
|----------|----------|-------------|
| `SESSION_ID` | Yes (bot mode) | `NIKOLA MD:<20-char-code>` from the pair site |
| `SELF_URL` | Yes (bot mode) | Your app's public URL — used to fetch the full session |
| `MASTER_PASSWORD` | No | Pair site password (default: `nikola-md-internal`) |
| `PORT` | No | Auto-set by Heroku/Render (defaults to 3000) |

### Bot commands

| Command | Response |
|---------|----------|
| `.ping` | `🏓 Pong! NIKOLA MD is alive.` |
| `.menu` | Shows available commands |

Add your own commands by editing the `messages.upsert` handler in `server.js`.

---

<p align="center"><sub>Built by NIKOLA · MIT License</sub></p>
