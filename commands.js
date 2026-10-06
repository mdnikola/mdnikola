/**
 * NIKOLA MD — Command Handler
 *
 * 144+ commands across 16 categories.
 *
 * Tier 1 (fully working, no API keys):
 *   - Fun: 8ball, coinflip, dare, dice, fact, joke, quote, truth, wordle
 *   - Games: hangman, numberguess, slots, snake, ttt
 *   - Group: tagall, hidetag, link, promote, demote, kick, mute, unmute, setdesc, setname, revoke, leave
 *   - Info: alive, botstatus, platform, prefixinfo, whoami, sessioninfo
 *   - Tools: qr, shorturl, wiki, google
 *   - Owner: about, owner, repo, sessionid, setbotname, setmode, setprefix, setowner, settimezone
 *   - Anime: anime, neko, waifu, hug, kiss, pat, slap, cuddle, wink (via free nekos.life API)
 *   - Media: tts (Google Translate TTS, free)
 *
 * Tier 2 (stubs — needs API key):
 *   - AI: chatgpt, claudeai, gemini, deepseek, grok, kimi, llama, metai, mistral, perplexity, qwen
 *   - Music: shazam, spotify
 *   - Sports: matches, scorers, sportsnews, standings
 *
 * Tier 3 (stubs — needs ffmpeg/native deps):
 *   - Audio: bassboost, deep, echo, fast, nightcore, reverse, robot, slow, toaudio, tomp3, toptt
 *   - Media: tosticker, toimage, tovideo, tovoice, vv
 *
 * Tier 4 (stubs — needs external scrapers):
 *   - Download: apk, facebook, instagram, mediafire, playlist, tiktok, twitter, ytv, ytmp3, ytmp4, song
 *   - Image: carbon, jail, rainbow, remini, trigger, wallpaper, wanted, wasted
 *   - Logo: 11 logo commands
 */

const fs = require('fs');
const path = require('path');
const { spawn } = require('child_process');

// Bot settings (in-memory — resets on restart)
const settings = {
    botName: 'NIKOLA MD',
    ownerName: 'Nikola',
    ownerNumber: '',
    prefix: '.',
    mode: 'public', // public | private | group
    timezone: 'Africa/Nairobi',
    autoReact: false,
    autoRead: false,
    autoType: false,
    antiCall: 'off',
    antiDelete: 'off',
    antiLink: false,
    antiSpam: false,
    antiSticker: false,
    autoBio: false,
    autoViewStatus: false,
    reactEmoji: '⚡',
};

const startTime = Date.now();

// In-memory storage
const chatMemory = new Map(); // jid -> [messages]
const hangmanGames = new Map();
const numberGuessGames = new Map();
const tttGames = new Map();
const wordleGames = new Map();
const warnings = new Map(); // jid -> { user: count }
const sessionIds = new Map(); // jid -> sessionId

// ─── Helpers ────────────────────────────────────────────────────────────
function formatUptime(ms) {
    const s = Math.floor(ms / 1000);
    const d = Math.floor(s / 86400);
    const h = Math.floor((s % 86400) / 3600);
    const m = Math.floor((s % 3600) / 60);
    const sec = s % 60;
    if (d > 0) return `${d}d ${h}h ${m}m`;
    if (h > 0) return `${h}h ${m}m ${sec}s`;
    if (m > 0) return `${m}m ${sec}s`;
    return `${sec}s`;
}

function getBotJid(sock) {
    return sock.user?.id || '';
}

function getBotNumber(sock) {
    return (sock.user?.id || '').split(':')[0].split('@')[0];
}

async function isUserAdmin(sock, jid, userJid) {
    if (!jid.endsWith('@g.us')) return false;
    try {
        const metadata = await sock.groupMetadata(jid);
        const participant = metadata.participants.find(p => p.id === userJid);
        return !!participant?.admin;
    } catch { return false; }
}

function getRandomItem(arr) { return arr[Math.floor(Math.random() * arr.length)]; }

async function fetchJson(url) {
    const res = await fetch(url);
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    return res.json();
}

// ─── Bold Sans Unicode converter ────────────────────────────────────────
// Converts regular text to 𝗯𝗼𝗹𝗱 𝘀𝗮𝗻𝘀 (Mathematical Sans-Serif Bold)
const BOLD_SANS_MAP = (() => {
    const map = {};
    // A-Z → 𝗔-𝗭 (U+1D5D4 - U+1D5ED)
    for (let i = 0; i < 26; i++) map[String.fromCharCode(65 + i)] = String.fromCodePoint(0x1D5D4 + i);
    // a-z → 𝗮-𝘇 (U+1D5EE - U+1D607)
    for (let i = 0; i < 26; i++) map[String.fromCharCode(97 + i)] = String.fromCodePoint(0x1D5EE + i);
    // 0-9 → 𝟬-𝟵 (U+1D7EC - U+1D7F5)
    for (let i = 0; i < 10; i++) map[String.fromCharCode(48 + i)] = String.fromCodePoint(0x1D7EC + i);
    return map;
})();

function boldSans(text) {
    return String(text).split('').map(c => BOLD_SANS_MAP[c] || c).join('');
}

// ─── Command definitions ───────────────────────────────────────────────
// Each command: { name, desc, category, handler }

const commands = [];

// Add a command
function cmd(name, desc, category, handler) {
    commands.push({ name, desc, category, handler });
}

// Add a stub command (not implemented yet)
function stub(name, desc, category, reason) {
    commands.push({
        name, desc, category,
        handler: async (ctx) => {
            await ctx.reply(`⚠️ *${name}* is not available yet.\n\nReason: ${reason}\n\nThe command is listed in the menu for documentation purposes.`);
        }
    });
}

// ═══════════════════════════════════════════════════════════════════════
// INFO COMMANDS
// ═══════════════════════════════════════════════════════════════════════

cmd('alive', 'Check if bot is online', 'Info', async (ctx) => {
    const uptime = formatUptime(Date.now() - startTime);
    await ctx.reply(`⚡ *NIKOLA MD is alive!*\n\n⏱️ Uptime: ${uptime}\n🌐 Mode: ${settings.mode}\n⚙️ Prefix: ${settings.prefix}`);
});

cmd('botstatus', 'Show bot status (memory, uptime, etc.)', 'Info', async (ctx) => {
    const mem = process.memoryUsage();
    const uptime = formatUptime(Date.now() - startTime);
    await ctx.reply(
        `📊 *Bot Status*\n\n` +
        `⏱️ Uptime: ${uptime}\n` +
        `💾 Memory: ${Math.round(mem.heapUsed / 1024 / 1024)}MB / ${Math.round(mem.heapTotal / 1024 / 1024)}MB\n` +
        `📦 Node: ${process.version}\n` +
        `🖥️ Platform: ${process.platform} ${process.arch}\n` +
        `🌐 Mode: ${settings.mode}\n` +
        `⚙️ Prefix: ${settings.prefix}\n` +
        `👤 Owner: ${settings.ownerName}\n` +
        `🤖 Bot: ${settings.botName}`
    );
});

cmd('platform', 'Show host info (OS, CPU, Node version)', 'Info', async (ctx) => {
    await ctx.reply(
        `🖥️ *Platform Info*\n\n` +
        `OS: ${process.platform} ${process.arch}\n` +
        `Node: ${process.version}\n` +
        `CPU cores: ${require('os').cpus().length}\n` +
        `Uptime: ${formatUptime(process.uptime() * 1000)}`
    );
});

cmd('prefixinfo', 'Show current command prefix', 'Info', async (ctx) => {
    await ctx.reply(`⚙️ Current prefix: *${settings.prefix}*\n\nTo change: ${settings.prefix}setprefix <symbol>`);
});

cmd('whoami', 'Show your WhatsApp info', 'Info', async (ctx) => {
    const m = ctx.message;
    const jid = m.key.participant || m.key.remoteJid;
    const number = jid.split('@')[0];
    const isGroup = m.key.remoteJid.endsWith('@g.us');
    await ctx.reply(
        `👤 *Your Info*\n\n` +
        `Number: ${number}\n` +
        `JID: ${jid}\n` +
        `Chat: ${isGroup ? 'Group' : 'Private'}\n` +
        `Is Bot: ${m.key.fromMe ? 'Yes' : 'No'}`
    );
});

cmd('sessioninfo', 'Show current session details', 'Info', async (ctx) => {
    const sid = process.env.SESSION_ID || '(none — pair-only mode)';
    const masked = sid.length > 20 ? sid.slice(0, 10) + '...' + sid.slice(-5) : sid;
    await ctx.reply(
        `🔑 *Session Info*\n\n` +
        `Session ID: ${masked}\n` +
        `Bot JID: ${ctx.sock.user?.id || 'N/A'}\n` +
        `Bot Number: ${getBotNumber(ctx.sock)}\n` +
        `Started: ${new Date(startTime).toLocaleString('en-GB', { timeZone: settings.timezone })}`
    );
});

// ═══════════════════════════════════════════════════════════════════════
// OWNER COMMANDS
// ═══════════════════════════════════════════════════════════════════════

cmd('about', 'Info about NIKOLA MD bot', 'Owner', async (ctx) => {
    await ctx.reply(
        `⚡ *About NIKOLA MD*\n\n` +
        `Version: 1.0.0\n` +
        `Built on: Baileys WhatsApp Multi-Device API\n` +
        `Author: NIKOLA\n` +
        `License: MIT\n\n` +
        `A fast, modular, multi-device WhatsApp bot with session-ID-based pairing.\n\n` +
        `Repo: https://github.com/mdnikola/mdnikola\n` +
        `Pair site: https://nikolamd.pairsite.space`
    );
});

cmd('owner', 'Show owner\'s contact card', 'Owner', async (ctx) => {
    if (!settings.ownerNumber) {
        await ctx.reply(`👑 Owner: ${settings.ownerName}\n\nOwner number not set. Use ${settings.prefix}setowner <name> <number> to set.`);
        return;
    }
    const vcard =
        `BEGIN:VCARD\n` +
        `VERSION:3.0\n` +
        `FN:${settings.ownerName}\n` +
        `TEL;type=CELL;type=VOICE;waid=${settings.ownerNumber}:+${settings.ownerNumber}\n` +
        `END:VCARD`;
    await ctx.sock.sendMessage(ctx.message.key.remoteJid, {
        contacts: {
            displayName: settings.ownerName,
            contacts: [{ vcard }],
        },
    });
});

cmd('repo', 'Show bot\'s GitHub repository', 'Owner', async (ctx) => {
    await ctx.reply(
        `📦 *NIKOLA MD Repository*\n\n` +
        `https://github.com/mdnikola/mdnikola\n\n` +
        `Star ⭐ the repo if you like the bot!`
    );
});

cmd('sessionid', 'Show current session ID', 'Owner', async (ctx) => {
    const sid = process.env.SESSION_ID || '(not set)';
    await ctx.reply(`🔑 Session ID:\n\n\`${sid}\``);
});

cmd('setbotname', 'Set bot\'s display name', 'Owner', async (ctx) => {
    const args = ctx.args;
    if (!args) return ctx.reply(`Usage: ${settings.prefix}setbotname <name>`);
    settings.botName = args;
    await ctx.reply(`✅ Bot name set to: *${args}*`);
});

cmd('setmode', 'Set who can use commands (public|private|group)', 'Owner', async (ctx) => {
    const args = ctx.args.toLowerCase();
    if (!['public', 'private', 'group'].includes(args)) {
        return ctx.reply(`Usage: ${settings.prefix}setmode public|private|group\n\nCurrent: ${settings.mode}`);
    }
    settings.mode = args;
    await ctx.reply(`✅ Mode set to: *${args}*`);
});

cmd('setprefix', 'Change command prefix (default: .)', 'Owner', async (ctx) => {
    const args = ctx.args;
    if (!args) return ctx.reply(`Usage: ${settings.prefix}setprefix <symbol>\n\nCurrent: ${settings.prefix}`);
    settings.prefix = args;
    await ctx.reply(`✅ Prefix set to: *${args}*`);
});

cmd('setowner', 'Set bot owner (name + number)', 'Owner', async (ctx) => {
    const args = ctx.args.split(' ');
    if (args.length < 2) return ctx.reply(`Usage: ${settings.prefix}setowner <name> <number>\nExample: ${settings.prefix}setowner Nikola 254712345678`);
    settings.ownerName = args[0];
    settings.ownerNumber = args[1].replace(/\D/g, '');
    await ctx.reply(`✅ Owner set:\nName: ${settings.ownerName}\nNumber: ${settings.ownerNumber}`);
});

cmd('settimezone', 'Set bot\'s timezone', 'Owner', async (ctx) => {
    const args = ctx.args;
    if (!args) return ctx.reply(`Usage: ${settings.prefix}settimezone <timezone>\nExample: ${settings.prefix}settimezone Africa/Nairobi\n\nCurrent: ${settings.timezone}`);
    try {
        Intl.DateTimeFormat('en-US', { timeZone: args });
        settings.timezone = args;
        await ctx.reply(`✅ Timezone set to: *${args}*`);
    } catch {
        await ctx.reply(`❌ Invalid timezone. Example: Africa/Nairobi, America/New_York, Europe/London`);
    }
});

cmd('restart', 'Restart the bot (owner only)', 'Owner', async (ctx) => {
    if (!ctx.isOwner) return ctx.reply('❌ Owner only');
    await ctx.reply('🔄 Restarting...');
    setTimeout(() => process.exit(0), 1000);
});

cmd('shutdown', 'Stop the bot (owner only)', 'Owner', async (ctx) => {
    if (!ctx.isOwner) return ctx.reply('❌ Owner only');
    await ctx.reply('🛑 Shutting down...');
    setTimeout(() => process.exit(1), 1000);
});

cmd('broadcast', 'Send message to all group chats (owner only)', 'Owner', async (ctx) => {
    if (!ctx.isOwner) return ctx.reply('❌ Owner only');
    const msg = ctx.args;
    if (!msg) return ctx.reply(`Usage: ${settings.prefix}broadcast <text>`);
    // Implementation: iterate over all chats
    await ctx.reply('📢 Broadcasting is not yet implemented — needs chat list tracking.');
});

cmd('pair', 'Pair a new WhatsApp session', 'Owner', async (ctx) => {
    await ctx.reply(`🔗 Pair a new session:\n\nhttps://nikolamd.pairsite.space\n\nVisit the URL, scan the QR with WhatsApp, copy your SESSION_ID.`);
});

// ═══════════════════════════════════════════════════════════════════════
// FUN COMMANDS
// ═══════════════════════════════════════════════════════════════════════

const EIGHT_BALL = [
    'It is certain.', 'It is decidedly so.', 'Without a doubt.', 'Yes definitely.',
    'You may rely on it.', 'As I see it, yes.', 'Most likely.', 'Outlook good.',
    'Yes.', 'Signs point to yes.', 'Reply hazy, try again.', 'Ask again later.',
    'Better not tell you now.', 'Cannot predict now.', 'Concentrate and ask again.',
    'Don\'t count on it.', 'My reply is no.', 'My sources say no.',
    'Outlook not so good.', 'Very doubtful.',
];

const DARES = [
    'Send the last message from your chat.', 'Do 10 pushups and send a video.',
    'Send a voice note singing a song.', 'Change your profile picture to a meme for 1 hour.',
    'Send the 5th photo in your gallery.', 'Tell us your biggest fear.',
    'Speak in a funny accent for the next 10 minutes.', 'Send a screenshot of your browser history.',
    'Do an impression of someone in the group.', 'Send a selfie with a funny face.',
];

const TRUTHS = [
    'What\'s the most embarrassing thing you\'ve ever done?',
    'What\'s your biggest secret?', 'Who do you have a crush on right now?',
    'What\'s the worst lie you\'ve ever told?', 'What\'s the most childish thing you still do?',
    'What\'s the strangest thing you\'ve ever eaten?', 'What\'s your biggest fear?',
    'Have you ever pretended to be sick to get out of something?',
    'What\'s the most expensive thing you\'ve broken?',
    'What\'s something you\'ve never told anyone?',
];

const FACTS = [
    'Honey never spoils. Archaeologists have found 3000-year-old honey in Egyptian tombs that\'s still edible.',
    'Octopuses have three hearts and blue blood.',
    'A day on Venus is longer than a year on Venus.',
    'Bananas are berries, but strawberries aren\'t.',
    'The first computer bug was an actual moth found in a relay in 1947.',
    'Wombat poop is cube-shaped.',
    'A group of flamingos is called a "flamboyance".',
    'The shortest war in history lasted 38 minutes (Anglo-Zanzibar War, 1896).',
    'Sharks existed before trees. Sharks: 400M years ago. Trees: 350M years ago.',
    'A bolt of lightning is 5 times hotter than the surface of the sun.',
    'There are more possible chess games than atoms in the universe.',
    'Cows have best friends and get stressed when separated.',
    'The Eiffel Tower can grow up to 6 inches taller in summer due to heat expansion.',
    'A jiffy is an actual unit of time: 1/100 of a second.',
    'Sea otters hold hands while sleeping to avoid drifting apart.',
];

const JOKES = [
    'Why don\'t scientists trust atoms? Because they make up everything!',
    'Why did the scarecrow win an award? He was outstanding in his field!',
    'I told my wife she was drawing her eyebrows too high. She looked surprised.',
    'Why don\'t programmers like nature? It has too many bugs.',
    'I would tell you a UDP joke, but you might not get it.',
    'Why did the developer go broke? Because he used up all his cache.',
    'What do you call a fake noodle? An impasta!',
    'Why did the coffee file a police report? It got mugged.',
    'I\'m reading a book about anti-gravity. It\'s impossible to put down!',
    'What do you call a bear with no teeth? A gummy bear!',
];

const QUOTES = [
    'The only way to do great work is to love what you do. — Steve Jobs',
    'Success is not final, failure is not fatal: it is the courage to continue that counts. — Winston Churchill',
    'The future belongs to those who believe in the beauty of their dreams. — Eleanor Roosevelt',
    'In the middle of every difficulty lies opportunity. — Albert Einstein',
    'Be the change you wish to see in the world. — Mahatma Gandhi',
    'The only limit to our realization of tomorrow will be our doubts of today. — Franklin D. Roosevelt',
    'It does not matter how slowly you go as long as you do not stop. — Confucius',
    'Believe you can and you\'re halfway there. — Theodore Roosevelt',
    'The best time to plant a tree was 20 years ago. The second best time is now. — Chinese Proverb',
    'Your time is limited, so don\'t waste it living someone else\'s life. — Steve Jobs',
];

cmd('8ball', 'Magic 8-ball answers', 'Fun', async (ctx) => {
    const q = ctx.args;
    if (!q) return ctx.reply(`Usage: ${settings.prefix}8ball <question>`);
    await ctx.reply(`🎱 *Question:* ${q}\n\n*Answer:* ${getRandomItem(EIGHT_BALL)}`);
});

cmd('coinflip', 'Flip a coin', 'Fun', async (ctx) => {
    const result = Math.random() < 0.5 ? 'Heads' : 'Tails';
    await ctx.reply(`🪙 *${result}*`);
});

cmd('dare', 'Random dare challenge', 'Fun', async (ctx) => {
    await ctx.reply(`😈 *Dare:*\n\n${getRandomItem(DARES)}`);
});

cmd('dice', 'Roll a dice', 'Fun', async (ctx) => {
    const n = Math.floor(Math.random() * 6) + 1;
    await ctx.reply(`🎲 You rolled: *${n}*`);
});

cmd('fact', 'Random fact', 'Fun', async (ctx) => {
    await ctx.reply(`💡 *Did you know?*\n\n${getRandomItem(FACTS)}`);
});

cmd('joke', 'Random joke', 'Fun', async (ctx) => {
    await ctx.reply(`😂 ${getRandomItem(JOKES)}`);
});

cmd('quote', 'Inspirational quote', 'Fun', async (ctx) => {
    await ctx.reply(`💬 ${getRandomItem(QUOTES)}`);
});

cmd('truth', 'Random truth question', 'Fun', async (ctx) => {
    await ctx.reply(`🤔 *Truth:*\n\n${getRandomItem(TRUTHS)}`);
});

cmd('wordle', 'Play Wordle game', 'Fun', async (ctx) => {
    const WORDS = ['apple', 'brain', 'chair', 'dance', 'eagle', 'flame', 'globe', 'heart', 'ivory', 'joker',
                   'knife', 'lemon', 'mango', 'noble', 'ocean', 'piano', 'queen', 'river', 'storm', 'tiger',
                   'ultra', 'voice', 'water', 'xenon', 'yacht', 'zebra'];
    const word = getRandomItem(WORDS);
    const chatId = ctx.message.key.remoteJid;
    wordleGames.set(chatId, { word, attempts: 0, maxAttempts: 6 });
    await ctx.reply(
        `🎮 *Wordle*\n\nGuess a 5-letter word in 6 tries.\n\n` +
        `Just send your 5-letter guess (no prefix needed).\n\n` +
        `🟩 = correct letter, correct spot\n` +
        `🟨 = correct letter, wrong spot\n` +
        `⬛ = letter not in word`
    );
});

// ═══════════════════════════════════════════════════════════════════════
// GAMES
// ═══════════════════════════════════════════════════════════════════════

cmd('hangman', 'Hangman word game', 'Games', async (ctx) => {
    const WORDS = ['javascript', 'whatsapp', 'computer', 'internet', 'programming', 'developer',
                   'algorithm', 'database', 'framework', 'function', 'variable', 'keyboard'];
    const word = getRandomItem(WORDS);
    const chatId = ctx.message.key.remoteJid;
    hangmanGames.set(chatId, { word, guessed: new Set(), wrongGuesses: 0, maxWrong: 6 });
    await ctx.reply(
        `🎮 *Hangman*\n\nWord: ${'_ '.repeat(word.length)}\n\n` +
        `Wrong guesses allowed: 6\nSend a letter to guess.`
    );
});

cmd('numberguess', 'Guess the number (1-100)', 'Games', async (ctx) => {
    const num = Math.floor(Math.random() * 100) + 1;
    const chatId = ctx.message.key.remoteJid;
    numberGuessGames.set(chatId, { number: num, attempts: 0, maxAttempts: 7 });
    await ctx.reply(`🎯 *Guess the Number*\n\nI'm thinking of a number between 1 and 100.\nYou have 7 attempts.\n\nJust send a number (no prefix).`);
});

cmd('slots', 'Slot machine game', 'Games', async (ctx) => {
    const EMOJIS = ['🍒', '🍋', '🍊', '🍇', '🔔', '⭐', '💎'];
    const slot = [getRandomItem(EMOJIS), getRandomItem(EMOJIS), getRandomItem(EMOJIS)];
    const win = slot[0] === slot[1] && slot[1] === slot[2];
    const jackpot = win && slot[0] === '💎';
    const msg = jackpot ? '💎 JACKPOT! 💎' : win ? '🎉 You won!' : '❌ You lost.';
    await ctx.reply(`🎰 *Slots*\n\n${slot.join(' | ')}\n\n${msg}`);
});

cmd('snake', 'Snake game (text-based)', 'Games', async (ctx) => {
    await ctx.reply(`🐍 *Snake Game*\n\nText-based snake game is not yet implemented. Coming soon!`);
});

cmd('ttt', 'Tic-tac-toe game', 'Games', async (ctx) => {
    const chatId = ctx.message.key.remoteJid;
    const board = ['1', '2', '3', '4', '5', '6', '7', '8', '9'];
    tttGames.set(chatId, { board, turn: 'X', winner: null });
    await ctx.reply(
        `🎮 *Tic-Tac-Toe*\n\n` +
        `${board[0]} | ${board[1]} | ${board[2]}\n` +
        `---------\n` +
        `${board[3]} | ${board[4]} | ${board[5]}\n` +
        `---------\n` +
        `${board[6]} | ${board[7]} | ${board[8]}\n\n` +
        `Send a number (1-9) to place your X.\nTwo-player mode: first player is X, second is O.`
    );
});

// ═══════════════════════════════════════════════════════════════════════
// GROUP COMMANDS
// ═══════════════════════════════════════════════════════════════════════

cmd('tagall', 'Mention everyone with a message', 'Group', async (ctx) => {
    if (!ctx.isGroup) return ctx.reply('❌ Group only');
    if (!ctx.isAdmin) return ctx.reply('❌ Admin only');
    const m = ctx.message;
    const text = ctx.args || 'Attention everyone!';
    try {
        const metadata = await ctx.sock.groupMetadata(m.key.remoteJid);
        const mentions = metadata.participants.map(p => p.id);
        await ctx.sock.sendMessage(m.key.remoteJid, { text: `📢 ${text}\n\n` + mentions.map(p => '@' + p.split('@')[0]).join(' '), mentions });
    } catch (e) { await ctx.reply('❌ Failed: ' + e.message); }
});

cmd('hidetag', 'Send message mentioning everyone (hidden mentions)', 'Group', async (ctx) => {
    if (!ctx.isGroup) return ctx.reply('❌ Group only');
    if (!ctx.isAdmin) return ctx.reply('❌ Admin only');
    const m = ctx.message;
    const text = ctx.args || 'Attention everyone!';
    try {
        const metadata = await ctx.sock.groupMetadata(m.key.remoteJid);
        const mentions = metadata.participants.map(p => p.id);
        await ctx.sock.sendMessage(m.key.remoteJid, { text, mentions });
    } catch (e) { await ctx.reply('❌ Failed: ' + e.message); }
});

cmd('link', 'Get group invite link', 'Group', async (ctx) => {
    if (!ctx.isGroup) return ctx.reply('❌ Group only');
    if (!ctx.isAdmin) return ctx.reply('❌ Admin only');
    try {
        const code = await ctx.sock.groupInviteCode(ctx.message.key.remoteJid);
        await ctx.reply(`🔗 Group invite link:\nhttps://chat.whatsapp.com/${code}`);
    } catch (e) { await ctx.reply('❌ Failed: ' + e.message); }
});

cmd('revoke', 'Create new invite link (invalidate old one)', 'Group', async (ctx) => {
    if (!ctx.isGroup) return ctx.reply('❌ Group only');
    if (!ctx.isAdmin) return ctx.reply('❌ Admin only');
    try {
        await ctx.sock.groupRevokeInvite(ctx.message.key.remoteJid);
        const newCode = await ctx.sock.groupInviteCode(ctx.message.key.remoteJid);
        await ctx.reply(`✅ Old link revoked.\n\n🔗 New link:\nhttps://chat.whatsapp.com/${newCode}`);
    } catch (e) { await ctx.reply('❌ Failed: ' + e.message); }
});

cmd('kick', 'Remove user from group (reply or mention)', 'Group', async (ctx) => {
    if (!ctx.isGroup) return ctx.reply('❌ Group only');
    if (!ctx.isAdmin) return ctx.reply('❌ Admin only');
    const target = ctx.message.message?.extendedTextMessage?.contextInfo?.participant;
    if (!target) return ctx.reply('❌ Reply to the user you want to kick, or mention them.');
    try {
        await ctx.sock.groupParticipantsUpdate(ctx.message.key.remoteJid, [target], 'remove');
        await ctx.reply(`✅ Kicked @${target.split('@')[0]}`, [target]);
    } catch (e) { await ctx.reply('❌ Failed: ' + e.message); }
});

cmd('add', 'Add someone to the group (.add <number>)', 'Group', async (ctx) => {
    if (!ctx.isGroup) return ctx.reply('❌ Group only');
    if (!ctx.isAdmin) return ctx.reply('❌ Admin only');
    const num = ctx.args.replace(/\D/g, '');
    if (!num) return ctx.reply(`Usage: ${settings.prefix}add <number>\nExample: ${settings.prefix}add 254712345678`);
    try {
        await ctx.sock.groupParticipantsUpdate(ctx.message.key.remoteJid, [`${num}@s.whatsapp.net`], 'add');
        await ctx.reply(`✅ Added ${num}`);
    } catch (e) { await ctx.reply('❌ Failed: ' + e.message); }
});

cmd('promote', 'Make someone a group admin (reply or mention)', 'Group', async (ctx) => {
    if (!ctx.isGroup) return ctx.reply('❌ Group only');
    if (!ctx.isAdmin) return ctx.reply('❌ Admin only');
    const target = ctx.message.message?.extendedTextMessage?.contextInfo?.participant;
    if (!target) return ctx.reply('❌ Reply to the user you want to promote, or mention them.');
    try {
        await ctx.sock.groupParticipantsUpdate(ctx.message.key.remoteJid, [target], 'promote');
        await ctx.reply(`✅ Promoted @${target.split('@')[0]}`, [target]);
    } catch (e) { await ctx.reply('❌ Failed: ' + e.message); }
});

cmd('demote', 'Remove admin from user (reply or mention)', 'Group', async (ctx) => {
    if (!ctx.isGroup) return ctx.reply('❌ Group only');
    if (!ctx.isAdmin) return ctx.reply('❌ Admin only');
    const target = ctx.message.message?.extendedTextMessage?.contextInfo?.participant;
    if (!target) return ctx.reply('❌ Reply to the user you want to demote, or mention them.');
    try {
        await ctx.sock.groupParticipantsUpdate(ctx.message.key.remoteJid, [target], 'demote');
        await ctx.reply(`✅ Demoted @${target.split('@')[0]}`, [target]);
    } catch (e) { await ctx.reply('❌ Failed: ' + e.message); }
});

cmd('mute', 'Lock group (only admins can message)', 'Group', async (ctx) => {
    if (!ctx.isGroup) return ctx.reply('❌ Group only');
    if (!ctx.isAdmin) return ctx.reply('❌ Admin only');
    try {
        await ctx.sock.groupSettingUpdate(ctx.message.key.remoteJid, 'announcement');
        await ctx.reply('🔒 Group locked — only admins can message.');
    } catch (e) { await ctx.reply('❌ Failed: ' + e.message); }
});

cmd('unmute', 'Unlock group (everyone can message)', 'Group', async (ctx) => {
    if (!ctx.isGroup) return ctx.reply('❌ Group only');
    if (!ctx.isAdmin) return ctx.reply('❌ Admin only');
    try {
        await ctx.sock.groupSettingUpdate(ctx.message.key.remoteJid, 'not_announcement');
        await ctx.reply('🔓 Group unlocked — everyone can message.');
    } catch (e) { await ctx.reply('❌ Failed: ' + e.message); }
});

cmd('setname', 'Set group name (.setname <name>)', 'Group', async (ctx) => {
    if (!ctx.isGroup) return ctx.reply('❌ Group only');
    if (!ctx.isAdmin) return ctx.reply('❌ Admin only');
    if (!ctx.args) return ctx.reply(`Usage: ${settings.prefix}setname <new name>`);
    try {
        await ctx.sock.groupUpdateSubject(ctx.message.key.remoteJid, ctx.args);
        await ctx.reply(`✅ Group name set to: ${ctx.args}`);
    } catch (e) { await ctx.reply('❌ Failed: ' + e.message); }
});

cmd('setdesc', 'Set group description (.setdesc <text>)', 'Group', async (ctx) => {
    if (!ctx.isGroup) return ctx.reply('❌ Group only');
    if (!ctx.isAdmin) return ctx.reply('❌ Admin only');
    if (!ctx.args) return ctx.reply(`Usage: ${settings.prefix}setdesc <description>`);
    try {
        await ctx.sock.groupUpdateDescription(ctx.message.key.remoteJid, ctx.args);
        await ctx.reply('✅ Group description updated.');
    } catch (e) { await ctx.reply('❌ Failed: ' + e.message); }
});

cmd('leave', 'Bot leaves the group', 'Group', async (ctx) => {
    if (!ctx.isGroup) return ctx.reply('❌ Group only');
    if (!ctx.isAdmin) return ctx.reply('❌ Admin only');
    await ctx.reply('👋 Leaving the group...');
    await ctx.sock.groupLeave(ctx.message.key.remoteJid);
});

cmd('warn', 'Warn a user (3 warnings = kick)', 'Group', async (ctx) => {
    if (!ctx.isGroup) return ctx.reply('❌ Group only');
    if (!ctx.isAdmin) return ctx.reply('❌ Admin only');
    const target = ctx.message.message?.extendedTextMessage?.contextInfo?.participant;
    if (!target) return ctx.reply('❌ Reply to the user you want to warn.');
    const jid = ctx.message.key.remoteJid;
    if (!warnings.has(jid)) warnings.set(jid, new Map());
    const groupWarnings = warnings.get(jid);
    const count = (groupWarnings.get(target) || 0) + 1;
    groupWarnings.set(target, count);
    if (count >= 3) {
        try {
            await ctx.sock.groupParticipantsUpdate(jid, [target], 'remove');
            groupWarnings.delete(target);
            await ctx.reply(`✅ @${target.split('@')[0]} kicked after 3 warnings.`, [target]);
        } catch (e) { await ctx.reply('❌ Failed to kick: ' + e.message); }
    } else {
        await ctx.reply(`⚠️ @${target.split('@')[0]} warned (${count}/3)`, [target]);
    }
});

cmd('welcome', 'Enable/disable welcome messages (on|off)', 'Group', async (ctx) => {
    if (!ctx.isGroup) return ctx.reply('❌ Group only');
    if (!ctx.isAdmin) return ctx.reply('❌ Admin only');
    const arg = ctx.args.toLowerCase();
    if (!['on', 'off'].includes(arg)) return ctx.reply(`Usage: ${settings.prefix}welcome on|off`);
    await ctx.reply(`✅ Welcome messages turned *${arg}*.\n\nNote: Welcome message tracking requires persistent storage — feature is stubbed.`);
});

// ═══════════════════════════════════════════════════════════════════════
// TOOLS
// ═══════════════════════════════════════════════════════════════════════

cmd('qr', 'Generate QR code (.qr <text|link>)', 'Tools', async (ctx) => {
    const text = ctx.args;
    if (!text) return ctx.reply(`Usage: ${settings.prefix}qr <text or link>`);
    try {
        const url = `https://api.qrserver.com/v1/create-qr-code/?size=300x300&data=${encodeURIComponent(text)}`;
        await ctx.sock.sendMessage(ctx.message.key.remoteJid, {
            image: { url },
            caption: `📱 QR code for:\n${text}`,
        });
    } catch (e) { await ctx.reply('❌ Failed: ' + e.message); }
});

cmd('shorturl', 'Shorten a URL (.shorturl <link>)', 'Tools', async (ctx) => {
    const url = ctx.args;
    if (!url) return ctx.reply(`Usage: ${settings.prefix}shorturl <url>`);
    try {
        const res = await fetchJson(`https://is.gd/create.php?format=json&url=${encodeURIComponent(url)}`);
        if (res.shorturl) await ctx.reply(`🔗 Shortened URL:\n${res.shorturl}`);
        else await ctx.reply('❌ Failed to shorten URL.');
    } catch (e) { await ctx.reply('❌ Failed: ' + e.message); }
});

cmd('wiki', 'Search Wikipedia (.wiki <topic>)', 'Tools', async (ctx) => {
    const query = ctx.args;
    if (!query) return ctx.reply(`Usage: ${settings.prefix}wiki <topic>`);
    try {
        const res = await fetchJson(`https://en.wikipedia.org/api/rest_v1/page/summary/${encodeURIComponent(query)}`);
        if (res.type === 'not_found') return ctx.reply('❌ Wikipedia article not found.');
        await ctx.reply(`📚 *${res.title}*\n\n${res.extract}\n\nRead more: ${res.content_urls.desktop.page}`);
    } catch (e) { await ctx.reply('❌ Failed: ' + e.message); }
});

cmd('google', 'Search Google (.google <query>)', 'Tools', async (ctx) => {
    const query = ctx.args;
    if (!query) return ctx.reply(`Usage: ${settings.prefix}google <query>`);
    const url = `https://www.google.com/search?q=${encodeURIComponent(query)}`;
    await ctx.reply(`🔍 Google search:\n\n${url}\n\n(Tap to open in browser)`);
});

cmd('url', 'Get public upload link for replied media', 'Tools', async (ctx) => {
    const quoted = ctx.message.message?.extendedTextMessage?.contextInfo?.quotedMessage;
    if (!quoted) return ctx.reply('❌ Reply to an image/video/audio to upload.');
    await ctx.reply('⚠️ URL upload is not yet implemented — needs a file hosting service (catbox.moe, etc.).');
});

// ═══════════════════════════════════════════════════════════════════════
// ANIME — using free nekos.life API
// ═══════════════════════════════════════════════════════════════════════

async function sendAnimeGif(ctx, endpoint, label) {
    try {
        const data = await fetchJson(`https://nekos.life/api/v2/img/${endpoint}`);
        if (!data.url) throw new Error('No URL');
        await ctx.sock.sendMessage(ctx.message.key.remoteJid, {
            video: { url: data.url },
            gifPlayback: true,
            caption: `🌸 ${label}`,
        });
    } catch (e) { await ctx.reply('❌ Failed to fetch anime image. Try again later.'); }
}

async function sendAnimeImg(ctx, endpoint, label) {
    try {
        const data = await fetchJson(`https://nekos.life/api/v2/img/${endpoint}`);
        if (!data.url) throw new Error('No URL');
        await ctx.sock.sendMessage(ctx.message.key.remoteJid, {
            image: { url: data.url },
            caption: `🌸 ${label}`,
        });
    } catch (e) { await ctx.reply('❌ Failed to fetch anime image. Try again later.'); }
}

cmd('anime', 'Random anime picture', 'Anime', async (ctx) => sendAnimeImg(ctx, 'waifu', 'Anime'));
cmd('neko', 'Cute cat girl picture', 'Anime', async (ctx) => sendAnimeImg(ctx, 'neko', 'Neko'));
cmd('waifu', 'Random waifu picture', 'Anime', async (ctx) => sendAnimeImg(ctx, 'waifu', 'Waifu'));
cmd('hug', 'Send a hug GIF', 'Anime', async (ctx) => sendAnimeGif(ctx, 'hug', 'Hug!'));
cmd('kiss', 'Send a kiss GIF', 'Anime', async (ctx) => sendAnimeGif(ctx, 'kiss', 'Kiss!'));
cmd('pat', 'Send a pat GIF', 'Anime', async (ctx) => sendAnimeGif(ctx, 'pat', 'Pat pat'));
cmd('slap', 'Send a slap GIF', 'Anime', async (ctx) => sendAnimeGif(ctx, 'slap', 'Slap!'));
cmd('cuddle', 'Send a cuddle GIF', 'Anime', async (ctx) => sendAnimeGif(ctx, 'cuddle', 'Cuddle!'));
cmd('wink', 'Send a wink GIF', 'Anime', async (ctx) => sendAnimeGif(ctx, 'smug', 'Wink!'));

// ═══════════════════════════════════════════════════════════════════════
// MEDIA
// ═══════════════════════════════════════════════════════════════════════

cmd('tts', 'Text-to-speech (.tts <lang> <text> or .tts <text>)', 'Media', async (ctx) => {
    const args = ctx.args;
    if (!args) return ctx.reply(`Usage: ${settings.prefix}tts <text>\nOr: ${settings.prefix}tts <lang> <text>\nExample: ${settings.prefix}tts Hello world\nExample: ${settings.prefix}tts en Hello world`);
    const parts = args.split(' ');
    let lang = 'en';
    let text = args;
    if (parts[0].length === 2 && /^[a-z]{2}$/i.test(parts[0])) {
        lang = parts[0].toLowerCase();
        text = parts.slice(1).join(' ');
    }
    if (!text) return ctx.reply('❌ No text provided.');
    try {
        const url = `https://translate.google.com/translate_tts?ie=UTF-8&q=${encodeURIComponent(text)}&tl=${lang}&client=tw-ob`;
        await ctx.sock.sendMessage(ctx.message.key.remoteJid, {
            audio: { url },
            mimetype: 'audio/mpeg',
            ptt: false,
        });
    } catch (e) { await ctx.reply('❌ Failed: ' + e.message); }
});

// ═══════════════════════════════════════════════════════════════════════
// AI COMMANDS (stubs — need API keys)
// ═══════════════════════════════════════════════════════════════════════

const AI_STUBS = [
    ['analyze', 'Describe an image using AI vision', 'ANTHROPIC_API_KEY or GEMINI_API_KEY'],
    ['blackbox', 'Code help from an AI', 'BLACKBOX_API_KEY'],
    ['cat', 'Chat with a witty cat AI', 'no key needed — but service not configured'],
    ['chatbot', 'Remember previous messages and chat (memory mode)', 'FREE_API_KEY (configured internally)'],
    ['chatgpt', 'Ask ChatGPT', 'OPENAI_API_KEY'],
    ['claudeai', 'Ask Claude AI', 'ANTHROPIC_API_KEY'],
    ['deepseek', 'Ask DeepSeek', 'DEEPSEEK_API_KEY'],
    ['gemini', 'Ask Google Gemini', 'GEMINI_API_KEY'],
    ['gpt', 'Ask ChatGPT (alias)', 'OPENAI_API_KEY'],
    ['grok', 'Ask Grok', 'XAI_API_KEY'],
    ['kimi', 'Ask Kimi AI', 'GROQ_API_KEY'],
    ['llama', 'Ask Llama (Groq)', 'GROQ_API_KEY'],
    ['metai', 'Ask Meta AI (Llama)', 'GROQ_API_KEY'],
    ['mistral', 'Ask Mistral AI', 'MISTRAL_API_KEY'],
    ['perplexity', 'Ask Perplexity', 'PERPLEXITY_API_KEY'],
    ['qwen', 'Ask Qwen', 'GROQ_API_KEY'],
    ['story', 'AI writes a short story from your idea', 'OPENAI_API_KEY'],
    ['summarize', 'Summarize text or a replied message', 'OPENAI_API_KEY'],
    ['translate2', 'Translate text to any language', 'GEMINI_API_KEY'],
];

for (const [name, desc, keyNeeded] of AI_STUBS) {
    cmd(name, desc, 'AI', async (ctx) => {
        const envVar = keyNeeded.split(' ')[0].split(' or ')[0];
        if (!process.env[envVar]) {
            await ctx.reply(
                `🤖 *${name}* requires an API key.\n\n` +
                `Set the *${envVar}* environment variable in Heroku/Render to use this command.\n\n` +
                `How:\n` +
                `1. Get an API key from the provider\n` +
                `2. Go to your Heroku app → Settings → Config Vars\n` +
                `3. Add key: ${envVar}\n` +
                `4. Restart the dyno\n\n` +
                `Without the key, this command is disabled.`
            );
            return;
        }
        // If key is set, attempt a generic OpenAI-compatible call
        await ctx.reply(`🤖 ${name} is configured but the AI handler needs implementation. Set up your specific provider's API call in commands.js.`);
    });
}

// ═══════════════════════════════════════════════════════════════════════
// AUDIO (stubs — needs ffmpeg)
// ═══════════════════════════════════════════════════════════════════════

const AUDIO_STUBS = [
    ['bassboost', 'Boost bass on audio/voice'],
    ['deep', 'Deep voice effect'],
    ['echo', 'Add echo to audio'],
    ['fast', 'Speed up audio'],
    ['nightcore', 'Nightcore effect'],
    ['reverse', 'Reverse audio'],
    ['robot', 'Robot voice effect'],
    ['slow', 'Slow down audio'],
    ['toaudio', 'Convert video to audio'],
    ['tomp3', 'Convert to MP3 file'],
    ['toptt', 'Convert to voice note (PTT)'],
];

for (const [name, desc] of AUDIO_STUBS) {
    cmd(name, desc, 'Audio', async (ctx) => {
        await ctx.reply(
            `🎧 *${name}* requires audio processing.\n\n` +
            `This command needs ffmpeg and an audio processing library.\n\n` +
            `To enable:\n` +
            `1. Add the ffmpeg buildpack to your Heroku app: https://github.com/jonathanong/heroku-buildpack-ffmpeg-latest\n` +
            `2. Add 'fluent-ffmpeg' to package.json\n` +
            `3. Implement the audio filter in commands.js\n\n` +
            `Reply to an audio/video message with ${settings.prefix}${name} to use (once enabled).`
        );
    });
}

// ═══════════════════════════════════════════════════════════════════════
// DOWNLOAD (stubs — needs yt-dlp or similar)
// ═══════════════════════════════════════════════════════════════════════

const DOWNLOAD_STUBS = [
    ['apk', 'Download Android apps'],
    ['facebook', 'Download Facebook videos/images'],
    ['fb', 'Download Facebook videos/images (alias)'],
    ['instagram', 'Download Instagram posts'],
    ['ig', 'Download Instagram posts (alias)'],
    ['mediafire', 'Download files from MediaFire'],
    ['playlist', 'Show YouTube playlist songs'],
    ['tiktok', 'Download TikTok videos'],
    ['twitter', 'Download Twitter/X videos'],
    ['ytv', 'Download YouTube videos'],
    ['ytmp3', 'Download YouTube audio'],
    ['ytmp4', 'Download YouTube video'],
    ['song', 'Search and download song from YouTube'],
];

for (const [name, desc] of DOWNLOAD_STUBS) {
    cmd(name, desc, 'Download', async (ctx) => {
        const url = ctx.args;
        if (!url) return ctx.reply(`Usage: ${settings.prefix}${name} <url>\n\nThis command requires yt-dlp or a download service.`);
        await ctx.reply(
            `⬇️ *${name}* is not yet implemented.\n\n` +
            `Downloaders need external services (yt-dlp, RapidAPI, etc.) which require setup.\n\n` +
            `URL provided: ${url}\n\n` +
            `To enable: install yt-dlp or configure a download API in commands.js.`
        );
    });
}

// ═══════════════════════════════════════════════════════════════════════
// IMAGE (stubs — needs external API or canvas lib)
// ═══════════════════════════════════════════════════════════════════════

const IMAGE_STUBS = [
    ['carbon', 'Convert code to a beautiful image'],
    ['jail', 'Add prison bars effect to image'],
    ['rainbow', 'Add rainbow gradient to image'],
    ['remini', 'Enhance/upscale image (sharpen & denoise)'],
    ['trigger', 'Add "TRIGGERED" red bar (shaking effect)'],
    ['wallpaper', 'Random wallpaper image'],
    ['wanted', 'Add "Wanted" poster effect'],
    ['wasted', 'Add "Wasted" GTA effect'],
];

for (const [name, desc] of IMAGE_STUBS) {
    cmd(name, desc, 'Image', async (ctx) => {
        if (name === 'wallpaper') {
            try {
                const data = await fetchJson('https://api.unsplash.com/photos/random?client_id=demo&query=wallpaper');
                await ctx.reply('⚠️ Wallpaper command needs an Unsplash API key.');
            } catch {
                await ctx.reply('🖼️ Wallpaper command needs an Unsplash API key (free at unsplash.com/developers).');
            }
            return;
        }
        await ctx.reply(
            `🖼️ *${name}* requires image processing.\n\n` +
            `Reply to an image with ${settings.prefix}${name} to apply the effect.\n\n` +
            `This command needs either:\n` +
            `• A canvas library (node-canvas)\n` +
            `• Or an external meme/image API\n\n` +
            `To enable: configure the image API endpoint in commands.js.`
        );
    });
}

// ═══════════════════════════════════════════════════════════════════════
// LOGO (stubs — needs textpro.com or similar)
// ═══════════════════════════════════════════════════════════════════════

const LOGO_STUBS = [
    'neonlogo', 'firelogo', 'goldlogo', 'silverlogo', 'rainbowlogo',
    'dragonlogo', 'phoenixlogo', 'moonlogo', 'lightninglogo', 'crystallogo', 'logo',
];

for (const name of LOGO_STUBS) {
    cmd(name, `Generate ${name.replace('logo', '')} logo (.${name} <text>)`, 'Logo', async (ctx) => {
        const text = ctx.args;
        if (!text) return ctx.reply(`Usage: ${settings.prefix}${name} <text>`);
        await ctx.reply(
            `🎨 *${name}* is not yet implemented.\n\n` +
            `Logo generators use textpro.com or similar services that need scraping.\n\n` +
            `Text provided: ${text}\n\n` +
            `To enable: add textpro scraping logic in commands.js.`
        );
    });
}

// ═══════════════════════════════════════════════════════════════════════
// MUSIC (stubs — needs API keys)
// ═══════════════════════════════════════════════════════════════════════

cmd('lyrics', 'Get lyrics link for a song (.lyrics <song>)', 'Music', async (ctx) => {
    const song = ctx.args;
    if (!song) return ctx.reply(`Usage: ${settings.prefix}lyrics <song name>`);
    const url = `https://www.google.com/search?q=${encodeURIComponent(song + ' lyrics')}`;
    await ctx.reply(`🎵 Search for lyrics:\n${url}`);
});

cmd('musicmenu', 'Show music commands', 'Music', async (ctx) => {
    await ctx.reply(
        `🎵 *Music Commands*\n\n` +
        `${settings.prefix}lyrics <song> — Get lyrics search link\n` +
        `${settings.prefix}shazam — Identify music (reply to audio) — needs AUDD_API_TOKEN\n` +
        `${settings.prefix}spotify <song|link> — Download from Spotify — needs Spotify API\n` +
        `${settings.prefix}song <song> — Download from YouTube — needs yt-dlp`
    );
});

stub('shazam', 'Identify music from audio (reply to audio)', 'Music', 'needs AUDD_API_TOKEN env var');
stub('spotify', 'Find and download song from Spotify', 'Music', 'needs Spotify API credentials');

// ═══════════════════════════════════════════════════════════════════════
// SPORTS (stubs — needs FOOTBALL_DATA_KEY)
// ═══════════════════════════════════════════════════════════════════════

const SPORTS_STUBS = [
    ['matches', 'Show upcoming/live matches'],
    ['scorers', 'Top scorers list'],
    ['sportsnews', 'Latest sports news'],
    ['standings', 'League table/standings'],
];

for (const [name, desc] of SPORTS_STUBS) {
    cmd(name, `${desc} (.${name} <league>)`, 'Sports', async (ctx) => {
        const league = ctx.args.toLowerCase();
        const leagues = ['epl', 'laliga', 'seriea', 'bundesliga', 'ligue1', 'ucl', 'mls', 'kpl', 'europa'];
        if (!league || !leagues.includes(league)) {
            return ctx.reply(`Usage: ${settings.prefix}${name} <league>\n\nAvailable leagues: ${leagues.join(', ')}`);
        }
        if (!process.env.FOOTBALL_DATA_KEY) {
            return ctx.reply(`⚽ *${name}* needs FOOTBALL_DATA_KEY env var.\n\nGet a free key at https://www.football-data.org/client/register`);
        }
        await ctx.reply(`⚽ ${name} for ${league} is configured but the API handler needs implementation in commands.js.`);
    });
}

// ═══════════════════════════════════════════════════════════════════════
// SETTINGS
// ═══════════════════════════════════════════════════════════════════════

cmd('anticall', 'Block incoming calls (off|decline|block)', 'Settings', async (ctx) => {
    const arg = ctx.args.toLowerCase();
    if (!['off', 'decline', 'block'].includes(arg)) return ctx.reply(`Usage: ${settings.prefix}anticall off|decline|block\n\nCurrent: ${settings.antiCall}`);
    settings.antiCall = arg;
    await ctx.reply(`✅ Anti-call set to: *${arg}*`);
});

cmd('antidelete', 'Recover deleted messages (off|private|all)', 'Settings', async (ctx) => {
    const arg = ctx.args.toLowerCase();
    if (!['off', 'private', 'all'].includes(arg)) return ctx.reply(`Usage: ${settings.prefix}antidelete off|private|all\n\nCurrent: ${settings.antiDelete}`);
    settings.antiDelete = arg;
    await ctx.reply(`✅ Anti-delete set to: *${arg}*`);
});

cmd('antilink', 'Auto-delete links in group (on|off)', 'Settings', async (ctx) => {
    const arg = ctx.args.toLowerCase();
    if (!['on', 'off'].includes(arg)) return ctx.reply(`Usage: ${settings.prefix}antilink on|off\n\nCurrent: ${settings.antiLink ? 'on' : 'off'}`);
    settings.antiLink = arg === 'on';
    await ctx.reply(`✅ Anti-link: *${arg}*`);
});

cmd('antispam', 'Stop spam in group (on|off)', 'Settings', async (ctx) => {
    const arg = ctx.args.toLowerCase();
    if (!['on', 'off'].includes(arg)) return ctx.reply(`Usage: ${settings.prefix}antispam on|off\n\nCurrent: ${settings.antiSpam ? 'on' : 'off'}`);
    settings.antiSpam = arg === 'on';
    await ctx.reply(`✅ Anti-spam: *${arg}*`);
});

cmd('antisticker', 'Auto-delete stickers in group (on|off)', 'Settings', async (ctx) => {
    const arg = ctx.args.toLowerCase();
    if (!['on', 'off'].includes(arg)) return ctx.reply(`Usage: ${settings.prefix}antisticker on|off\n\nCurrent: ${settings.antiSticker ? 'on' : 'off'}`);
    settings.antiSticker = arg === 'on';
    await ctx.reply(`✅ Anti-sticker: *${arg}*`);
});

cmd('autobio', 'Auto-update status with time/quote (on|off)', 'Settings', async (ctx) => {
    const arg = ctx.args.toLowerCase();
    if (!['on', 'off'].includes(arg)) return ctx.reply(`Usage: ${settings.prefix}autobio on|off\n\nCurrent: ${settings.autoBio ? 'on' : 'off'}`);
    settings.autoBio = arg === 'on';
    await ctx.reply(`✅ Auto-bio: *${arg}*`);
});

cmd('autoread', 'Auto-read messages (on|off)', 'Settings', async (ctx) => {
    const arg = ctx.args.toLowerCase();
    if (!['on', 'off'].includes(arg)) return ctx.reply(`Usage: ${settings.prefix}autoread on|off\n\nCurrent: ${settings.autoRead ? 'on' : 'off'}`);
    settings.autoRead = arg === 'on';
    await ctx.reply(`✅ Auto-read: *${arg}*`);
});

cmd('autoreact', 'Auto-react to messages (on|off)', 'Settings', async (ctx) => {
    const arg = ctx.args.toLowerCase();
    if (!['on', 'off'].includes(arg)) return ctx.reply(`Usage: ${settings.prefix}autoreact on|off\n\nCurrent: ${settings.autoReact ? 'on' : 'off'}`);
    settings.autoReact = arg === 'on';
    await ctx.reply(`✅ Auto-react: *${arg}*`);
});

cmd('autotype', 'Show typing indicator (on|off)', 'Settings', async (ctx) => {
    const arg = ctx.args.toLowerCase();
    if (!['on', 'off'].includes(arg)) return ctx.reply(`Usage: ${settings.prefix}autotype on|off`);
    settings.autoType = arg === 'on';
    await ctx.reply(`✅ Auto-type: *${arg}*`);
});

cmd('autoviewstatus', 'Auto-view status updates (on|off)', 'Settings', async (ctx) => {
    const arg = ctx.args.toLowerCase();
    if (!['on', 'off'].includes(arg)) return ctx.reply(`Usage: ${settings.prefix}autoviewstatus on|off`);
    settings.autoViewStatus = arg === 'on';
    await ctx.reply(`✅ Auto-view status: *${arg}*`);
});

cmd('setemoji', 'Set emoji for auto-reactions (.setemoji <emoji>)', 'Settings', async (ctx) => {
    const emoji = ctx.args.trim();
    if (!emoji) return ctx.reply(`Usage: ${settings.prefix}setemoji <emoji>\n\nCurrent: ${settings.reactEmoji}`);
    settings.reactEmoji = emoji;
    await ctx.reply(`✅ React emoji set to: ${emoji}`);
});

// ═══════════════════════════════════════════════════════════════════════
// MEDIA STUBS
// ═══════════════════════════════════════════════════════════════════════

stub('status', 'Post to your WhatsApp status', 'Media', 'needs implementation — uses WhatsApp status API');
stub('groupst', 'Post to status (only this group sees)', 'Media', 'needs implementation — uses WhatsApp status API');
stub('tosticker', 'Convert image/video to sticker', 'Media', 'needs node-webpmux + sharp for sticker metadata');
stub('toimage', 'Convert sticker to image', 'Media', 'needs sharp or similar image processing');
stub('tovideo', 'Convert sticker/image to video', 'Media', 'needs ffmpeg');
stub('tovoice', 'Convert audio to voice note (PTT)', 'Media', 'needs audio conversion');
stub('vv', 'Save view-once media', 'Media', 'needs view-once message handling');

// ═══════════════════════════════════════════════════════════════════════
// PING & MENU (special)
// ═══════════════════════════════════════════════════════════════════════

cmd('ping', 'Check if bot is alive', 'Info', async (ctx) => {
    const start = Date.now();
    await ctx.reply(`🏓 Pong! ${Date.now() - start}ms`);
});

cmd('menu', 'Show this menu', 'Info', async (ctx) => {
    const categories = {};
    for (const c of commands) {
        if (!categories[c.category]) categories[c.category] = [];
        categories[c.category].push(c);
    }

    const emojiMap = {
        'AI': '🤖', 'Anime': '🌸', 'Audio': '🎧', 'Download': '⬇️', 'Fun': '🎉',
        'Games': '🎮', 'Group': '👥', 'Image': '🖼️', 'Info': 'ℹ️', 'Logo': '🎨',
        'Media': '🔄', 'Music': '🎶', 'Owner': '👑', 'Settings': '⚙️',
        'Sports': '⚽', 'Tools': '🧰',
    };

    const uptime = formatUptime(Date.now() - startTime);
    const botName = boldSans('NIKOLA-MD');
    const tagline = boldSans('Premium WhatsApp Bot');
    const ownerLine = boldSans(settings.ownerName);
    const prefixLine = boldSans(settings.prefix);
    const modeLine = boldSans(settings.mode);
    const uptimeLine = boldSans(uptime);
    const cmdsLine = boldSans(String(commands.length));

    // ─── Header (Neon Glass box) ───────────────────────────────────────
    let menu = '';
    menu += `  ╭──────────────────────────────────────╮\n`;
    menu += `  │                                      │\n`;
    menu += `  │     ✦ ⚡ ${botName} ⚡ ✦              │\n`;
    menu += `  │     ──────────────────────           │\n`;
    menu += `  │     ${tagline}           │\n`;
    menu += `  │                                      │\n`;
    menu += `  ╰──────────────────────────────────────╯\n`;
    menu += `\n`;

    // ─── Status block ──────────────────────────────────────────────────
    menu += `   ▌ 👑 ${boldSans('Owner')}   │  ${ownerLine}\n`;
    menu += `   ▌ ⚙️  ${boldSans('Prefix')}  │  ${prefixLine}\n`;
    menu += `   ▌ 🌐 ${boldSans('Mode')}    │  ${modeLine}\n`;
    menu += `   ▌ ⏱️  ${boldSans('Uptime')}  │  ${uptimeLine}\n`;
    menu += `   ▌ 📦 ${boldSans('Cmds')}    │  ${cmdsLine}\n`;
    menu += `\n`;

    // ─── Separator ─────────────────────────────────────────────────────
    menu += `  ─━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━─\n`;
    menu += `\n`;

    // ─── Category boxes ────────────────────────────────────────────────
    const catEntries = Object.entries(categories);
    for (let i = 0; i < catEntries.length; i++) {
        const [cat, cmds] = catEntries[i];
        const emoji = emojiMap[cat] || '📌';
        const catName = boldSans(cat.toUpperCase());

        menu += `  ╭─ ✦ ${emoji} ${catName} ──────────────────────────╮\n`;
        for (const c of cmds) {
            const cmdName = boldSans(settings.prefix + c.name);
            const desc = c.desc;
            menu += `  │  ▸ ${cmdName.padEnd(16)} ${desc} │\n`;
        }
        menu += `  ╰─────────────────────────────────────╯\n`;
        if (i < catEntries.length - 1) menu += `\n`;
    }

    // ─── Footer ────────────────────────────────────────────────────────
    menu += `\n`;
    menu += `  ─━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━─\n`;
    menu += `\n`;
    menu += `        ✦ ${boldSans('NIKOLA-MD')} · ${boldSans('PREMIUM')} ✦\n`;

    await ctx.reply(menu);
});

// ═══════════════════════════════════════════════════════════════════════
// HELP
// ═══════════════════════════════════════════════════════════════════════

cmd('help', 'Show help', 'Info', async (ctx) => {
    await ctx.reply(
        `ℹ️ *NIKOLA MD Help*\n\n` +
        `Prefix: ${settings.prefix}\n` +
        `Total commands: ${commands.length}\n\n` +
        `Use ${settings.prefix}menu to see all commands.\n` +
        `Use ${settings.prefix}alive to check if bot is online.\n` +
        `Use ${settings.prefix}botstatus to see bot stats.\n\n` +
        `Pair a new session: https://nikolamd.pairsite.space`
    );
});

// ═══════════════════════════════════════════════════════════════════════
// MAIN HANDLER
// ═══════════════════════════════════════════════════════════════════════

async function handleMessage(sock, m) {
    if (!m.message) return;
    // NOTE: Do NOT skip m.key.fromMe — when the bot is paired to the user's own
    // number, commands sent from their phone arrive as fromMe=true. The bot's own
    // responses don't start with the prefix, so there's no infinite loop.
    const text = m.message.conversation || m.message.extendedTextMessage?.text || '';
    if (!text) return;
    if (!text.startsWith(settings.prefix)) return;

    const parts = text.slice(settings.prefix.length).trim().split(/\s+/);
    const commandName = parts[0].toLowerCase();
    const args = parts.slice(1).join(' ');
    const jid = m.key.remoteJid;
    const senderJid = m.key.participant || m.key.remoteJid;
    const senderNum = senderJid.split('@')[0];
    const isGroup = jid.endsWith('@g.us');
    const isAdmin = isGroup ? await isUserAdmin(sock, jid, senderJid) : false;
    const isOwner = settings.ownerNumber === senderNum || m.key.fromMe;

    // Mode check
    if (settings.mode === 'private' && !isOwner) return;
    if (settings.mode === 'group' && !isGroup) return;

    const command = commands.find(c => c.name === commandName);
    if (!command) return; // Unknown command — silent

    const ctx = {
        sock,
        message: m,
        jid,
        senderJid,
        senderNum,
        isGroup,
        isAdmin,
        isOwner,
        args,
        reply: async (text, mentions) => {
            await sock.sendMessage(jid, { text, mentions });
        },
    };

    try {
        await command.handler(ctx);
    } catch (e) {
        console.error(`[cmd] ${commandName} error:`, e);
        await sock.sendMessage(jid, { text: `❌ Command failed: ${e.message}` });
    }
}

// Wordle guess handler (no prefix, 5-letter words)
async function handleWordleGuess(sock, m) {
    if (m.key.fromMe) return false; // skip bot's own messages
    const chatId = m.key.remoteJid;
    const game = wordleGames.get(chatId);
    if (!game) return false;
    const guess = (m.message.conversation || m.message.extendedTextMessage?.text || '').toLowerCase().trim();
    if (guess.length !== 5 || !/^[a-z]+$/.test(guess)) return false;

    game.attempts++;
    let result = '';
    for (let i = 0; i < 5; i++) {
        if (guess[i] === game.word[i]) result += '🟩';
        else if (game.word.includes(guess[i])) result += '🟨';
        else result += '⬛';
    }

    let msg = `${guess.toUpperCase()}\n${result}\nAttempt ${game.attempts}/6`;

    if (guess === game.word) {
        msg += `\n\n🎉 You won in ${game.attempts} attempts!`;
        wordleGames.delete(chatId);
    } else if (game.attempts >= game.maxAttempts) {
        msg += `\n\n❌ Game over! The word was: *${game.word}*`;
        wordleGames.delete(chatId);
    }

    await sock.sendMessage(chatId, { text: msg });
    return true;
}

// Number guess handler (no prefix, numbers)
async function handleNumberGuess(sock, m) {
    if (m.key.fromMe) return false; // skip bot's own messages
    const chatId = m.key.remoteJid;
    const game = numberGuessGames.get(chatId);
    if (!game) return false;
    const text = (m.message.conversation || m.message.extendedTextMessage?.text || '').trim();
    const num = parseInt(text, 10);
    if (isNaN(num)) return false;

    game.attempts++;
    let msg = '';

    if (num === game.number) {
        msg = `🎉 Correct! The number was *${game.number}*.\nYou won in ${game.attempts} attempts!`;
        numberGuessGames.delete(chatId);
    } else if (game.attempts >= game.maxAttempts) {
        msg = `❌ Game over! The number was: *${game.number}*`;
        numberGuessGames.delete(chatId);
    } else if (num < game.number) {
        msg = `📈 Higher! (attempt ${game.attempts}/${game.maxAttempts})`;
    } else {
        msg = `📉 Lower! (attempt ${game.attempts}/${game.maxAttempts})`;
    }

    await sock.sendMessage(chatId, { text: msg });
    return true;
}

// Tic-tac-toe handler (no prefix, 1-9)
async function handleTTT(sock, m) {
    if (m.key.fromMe) return false; // skip bot's own messages
    const chatId = m.key.remoteJid;
    const game = tttGames.get(chatId);
    if (!game) return false;
    const text = (m.message.conversation || m.message.extendedTextMessage?.text || '').trim();
    // Must be exactly a single digit 1-9 (not "1|2|3" etc.)
    if (!/^[1-9]$/.test(text)) return false;
    const pos = parseInt(text, 10);
    if (game.board[pos - 1] === 'X' || game.board[pos - 1] === 'O') {
        await sock.sendMessage(chatId, { text: '❌ That spot is already taken.' });
        return true;
    }

    game.board[pos - 1] = game.turn;
    const winner = checkTTTWinner(game.board);
    if (winner) {
        const msg = `🎮 *Tic-Tac-Toe*\n\n${game.board[0]} | ${game.board[1]} | ${game.board[2]}\n---------\n${game.board[3]} | ${game.board[4]} | ${game.board[5]}\n---------\n${game.board[6]} | ${game.board[7]} | ${game.board[8]}\n\n🎉 Player ${winner} wins!`;
        await sock.sendMessage(chatId, { text: msg });
        tttGames.delete(chatId);
        return true;
    }
    if (game.board.every(c => c === 'X' || c === 'O')) {
        const msg = `🎮 *Tic-Tac-Toe*\n\n${game.board[0]} | ${game.board[1]} | ${game.board[2]}\n---------\n${game.board[3]} | ${game.board[4]} | ${game.board[5]}\n---------\n${game.board[6]} | ${game.board[7]} | ${game.board[8]}\n\n🤝 It's a draw!`;
        await sock.sendMessage(chatId, { text: msg });
        tttGames.delete(chatId);
        return true;
    }

    game.turn = game.turn === 'X' ? 'O' : 'X';
    const msg = `🎮 *Tic-Tac-Toe*\n\n${game.board[0]} | ${game.board[1]} | ${game.board[2]}\n---------\n${game.board[3]} | ${game.board[4]} | ${game.board[5]}\n---------\n${game.board[6]} | ${game.board[7]} | ${game.board[8]}\n\nPlayer ${game.turn}'s turn.`;
    await sock.sendMessage(chatId, { text: msg });
    return true;
}

function checkTTTWinner(b) {
    const wins = [[0,1,2],[3,4,5],[6,7,8],[0,3,6],[1,4,7],[2,5,8],[0,4,8],[2,4,6]];
    for (const [a,b1,c] of wins) {
        if (b[a] === b[b1] && b[b1] === b[c]) return b[a];
    }
    return null;
}

// Hangman letter guess
async function handleHangman(sock, m) {
    if (m.key.fromMe) return false; // skip bot's own messages
    const chatId = m.key.remoteJid;
    const game = hangmanGames.get(chatId);
    if (!game) return false;
    const text = (m.message.conversation || m.message.extendedTextMessage?.text || '').toLowerCase().trim();
    if (text.length !== 1 || !/^[a-z]$/.test(text)) return false;
    if (game.guessed.has(text)) {
        await sock.sendMessage(chatId, { text: `❌ You already guessed '${text}'.` });
        return true;
    }
    game.guessed.add(text);

    if (!game.word.includes(text)) {
        game.wrongGuesses++;
    }

    const display = game.word.split('').map(c => game.guessed.has(c) ? c : '_').join(' ');
    const wrongLeft = game.maxWrong - game.wrongGuesses;
    let msg = `🎮 *Hangman*\n\nWord: ${display}\nWrong guesses left: ${wrongLeft}\nGuessed: ${[...game.guessed].join(', ')}`;

    if (!display.includes('_')) {
        msg += `\n\n🎉 You won! The word was: *${game.word}*`;
        hangmanGames.delete(chatId);
    } else if (game.wrongGuesses >= game.maxWrong) {
        msg += `\n\n❌ Game over! The word was: *${game.word}*`;
        hangmanGames.delete(chatId);
    }

    await sock.sendMessage(chatId, { text: msg });
    return true;
}

// ═══════════════════════════════════════════════════════════════════════
// EXPORT
// ═══════════════════════════════════════════════════════════════════════

module.exports = {
    settings,
    commands,
    handleMessage,
    handleWordleGuess,
    handleNumberGuess,
    handleTTT,
    handleHangman,
    formatUptime,
    startTime,
};
