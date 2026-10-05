# NIKOLA Pair Site

A clean, standalone WhatsApp pairing site. Visitors enter their phone number + master password, get an 8-character pairing code, and link their WhatsApp to a bot instance running on your server.

## How it works

1. Visitor opens your site (e.g. `https://your-app.herokuapp.com`)
2. They enter their phone number (with country code) and the master password
3. The site displays an 8-character pairing code
4. They open WhatsApp → Settings → Linked Devices → Link with phone number → enter the code
5. The site shows "Pairing successful" — the bot is now online for their number
6. The bot stays alive and responds to `.ping` and `.menu`

## What's inside

```
pair-site/
├── server.js          # Express + Baileys pairing logic
├── package.json
├── Procfile           # Heroku
├── app.json           # Heroku one-click deploy
├── .env.example
├── .gitignore
├── public/
│   ├── index.html     # Pair UI
│   ├── styles.css     # Modern dark UI
│   └── script.js      # Pairing flow + status polling
└── sessions/          # Baileys session storage (gitignored)
```

## Deploy

### Heroku (one-click)
1. Push this folder to a GitHub repo
2. Open: `https://heroku.com/deploy?template=https://github.com/<your-user>/<your-repo>`
3. Set `MASTER_PASSWORD` to something only you know
4. Deploy → open app → your pair site is live

### Render
1. New → Web Service → connect your GitHub repo
2. Build command: `npm install`
3. Start command: `npm start`
4. Add env var `MASTER_PASSWORD=your-secret`
5. Deploy

### Railway
1. New project → deploy from GitHub repo
2. Add env var `MASTER_PASSWORD=your-secret`
3. Deploy

### Local
```bash
npm install
cp .env.example .env
# Edit .env to set your master password
npm start
# Open http://localhost:3000
```

## Environment variables

| Variable           | Default              | Description                                    |
|--------------------|----------------------|------------------------------------------------|
| `MASTER_PASSWORD`  | `nikola-md-internal` | Password visitors must enter. **Change this.** |
| `PORT`             | `3000`               | Auto-set by Heroku/Render/Railway.             |

## Bot commands (after pairing)

| Command | Response                                |
|---------|-----------------------------------------|
| `.ping` | `🏓 Pong! Bot is alive.`                |
| `.menu` | Shows available commands                |

Add your own commands by editing the `messages.upsert` handler in `server.js`.

## Security notes

- **Change `MASTER_PASSWORD`** before deploying — otherwise anyone can pair a WhatsApp number to your server.
- Sessions are stored in `sessions/<phone>/` on the server. On Heroku free tier, these are wiped on restart — pair numbers will need to re-pair after dyno restart. For persistent sessions, upgrade to a paid dyno or use an external storage backend.
- WhatsApp may ban numbers that send too many messages too fast. Be careful with broadcast/spam commands.
- This is a minimal proof-of-concept. For a full-featured bot, use the complete NIKOLA MD bot instead.

## License

MIT — do whatever you want with this.
