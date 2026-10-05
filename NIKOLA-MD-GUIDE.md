# NIKOLA MD – command pack guide

Based on CypherX-Ultra by Tylor. This pack adds readable plugins (`Resources/Plugins/nk-*.js`)
and helpers (`Resources/Functions/nk-*.js`). The menu (`menu.js`) builds itself from the plugins.

## First run
1. `npm install` (adds `chess.js`), then `npm start`, pair your number.
2. Send `.menu`. The bot name/owner are set to NIKOLA MD / Nikola automatically.
3. Owner commands: `.setowner Nikola 254711815459`, `.setprefix`, `.setmode public|private|group`,
   `.settimezone Africa/Nairobi`, `.setbotname`.

## Optional keys (set as environment variables / Heroku config vars)
| Variable | Unlocks |
|---|---|
| `ANTHROPIC_API_KEY` | `.claudeai`, `.analyze` (images) |
| `OPENAI_API_KEY` | `.chatgpt`, `.gpt` |
| `GEMINI_API_KEY` | `.gemini`, `.analyze` (images) |
| `DEEPSEEK_API_KEY`, `XAI_API_KEY`, `MISTRAL_API_KEY`, `PERPLEXITY_API_KEY` | `.deepseek`, `.grok`, `.mistral`, `.perplexity` |
| `GROQ_API_KEY` | `.llama`, `.metai`, `.kimi`, `.qwen` |
| `AUDD_API_TOKEN` | `.shazam` |
| `FOOTBALL_DATA_KEY` | `.scorers` |

Without a key, AI commands fall back to a free service and the reply is labelled "NIKOLA AI".

## Notes
- Needs `ffmpeg` (the bundled `@ffmpeg-installer/ffmpeg` is used automatically) for audio, image and logo commands.
- `antispam`, `antisticker`, `autobio` flags are stored in `Resources/nk-data.json` (reset on Heroku restarts).
- Downloaders for Facebook / Instagram / Twitter use the same backend as the TikTok command; if a route changes they may need updating.
- `.lyrics` returns a search link, not the full lyrics.
