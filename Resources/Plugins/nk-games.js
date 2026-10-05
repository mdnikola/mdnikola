'use strict';
const { bare } = require('../Functions/nk-utils.js');

const pick = (a) => a[Math.floor(Math.random() * a.length)];
const HANG_WORDS = ['whatsapp','keyboard','elephant','mountain','computer','football','chocolate','umbrella','dolphin','bicycle','sunshine','airplane','library','kangaroo','rainbow','pyramid','volcano','notebook','festival','telephone','butterfly','adventure','champion','universe'];
const HANG_ART = ['😐', '😟', '😨', '😰', '😱', '💀'];
const hang = new Map(), memory = new Map(), snake = new Map(), guess = new Map(), chess = new Map();

// ---------- hangman ----------
function hangView(g) {
  const word = [...g.word].map((c) => (g.letters.has(c) ? c.toUpperCase() : '_')).join(' ');
  return `${HANG_ART[Math.min(g.wrong, 5)]}  Lives: ${'❤️'.repeat(6 - g.wrong)}${'🖤'.repeat(g.wrong)}\n\n*${word}*\n\nTried: ${[...g.letters].join(' ').toUpperCase() || '-'}`;
}
// ---------- memory ----------
const EMOJI = ['🍎', '🚗', '🐶', '⚽', '🎸', '🌙', '🍕', '🚀'];
function memView(g, flip = []) {
  let out = '';
  for (let i = 0; i < 16; i++) {
    const shown = g.matched.has(i) || flip.includes(i);
    out += shown ? g.board[i] + '  ' : String(i + 1).padStart(2, '0') + ' ';
    if (i % 4 === 3) out += '\n';
  }
  return out;
}
// ---------- snake ----------
const N = 8;
function newFood(g) { let p; do { p = [Math.floor(Math.random() * N), Math.floor(Math.random() * N)]; } while (g.body.some((b) => b[0] === p[0] && b[1] === p[1])); return p; }
function snakeView(g) {
  let out = '';
  for (let y = 0; y < N; y++) {
    for (let x = 0; x < N; x++) {
      if (g.body[0][0] === x && g.body[0][1] === y) out += '🐍';
      else if (g.body.some((b) => b[0] === x && b[1] === y)) out += '🟩';
      else if (g.food[0] === x && g.food[1] === y) out += '🍎';
      else out += '⬛';
    }
    out += '\n';
  }
  return out + `\nScore: ${g.body.length - 3}`;
}
// ---------- chess ----------
const PIECES = { p: '♟', n: '♞', b: '♝', r: '♜', q: '♛', k: '♚', P: '♙', N: '♘', B: '♗', R: '♖', Q: '♕', K: '♔' };
function chessView(c) {
  const rows = c.board().map((row, r) => `${8 - r} ` + row.map((sq, f) => (sq ? PIECES[sq.color === 'w' ? sq.type.toUpperCase() : sq.type] : ((r + f) % 2 ? '·' : '▫'))).join(' '));
  return rows.join('\n') + '\n  a b c d e f g h';
}

module.exports = () => ({
  name: 'Games Pack',
  triggers: ['hangman', 'memory', 'slots', 'snake', 'numberguess', 'chess'],
  menu: ['chess', 'hangman', 'memory', 'slots', 'snake', 'ttt', 'numberguess'],
  description: 'Play games in chat',
  category: 'Games',
  react: '🎮',

  run: async ({ m, Cypher, args, text, prefix, command }) => {
    const cmd = command.toLowerCase();
    const a0 = (args[0] || '').toLowerCase();
    const key = m.chat;
    try {
      if (cmd === 'slots') {
        const s = ['🍒', '🍋', '🍇', '🔔', '💎', '7️⃣'];
        const r = [pick(s), pick(s), pick(s)];
        const win = r[0] === r[1] && r[1] === r[2] ? '🎉 JACKPOT!' : (r[0] === r[1] || r[1] === r[2] || r[0] === r[2]) ? '✨ Two of a kind — small win!' : '😅 No luck. Try again!';
        return m.reply(`🎰 *SLOTS*\n\n| ${r.join(' | ')} |\n\n${win}`);
      }

      if (cmd === 'numberguess') {
        let g = guess.get(key);
        const n = parseInt(a0, 10);
        if (!g || a0 === 'new') { g = { num: 1 + Math.floor(Math.random() * 100), tries: 0 }; guess.set(key, g); return m.reply(`🔢 I'm thinking of a number from 1 to 100.\nYou have 7 tries: *${prefix}numberguess <number>*`); }
        if (isNaN(n)) return m.reply(`Send a number: *${prefix}numberguess 50*`);
        g.tries++;
        if (n === g.num) { guess.delete(key); return m.reply(`🎉 Correct! It was *${g.num}* (${g.tries} tries).`); }
        if (g.tries >= 7) { guess.delete(key); return m.reply(`❌ Out of tries. The number was *${g.num}*.`); }
        return m.reply(`${n < g.num ? '⬆️ Higher' : '⬇️ Lower'}! (${7 - g.tries} tries left)`);
      }

      if (cmd === 'hangman') {
        let g = hang.get(key);
        if (!g || a0 === 'new') { g = { word: pick(HANG_WORDS), letters: new Set(), wrong: 0 }; hang.set(key, g); return m.reply(`🪢 *HANGMAN*\n\n${hangView(g)}\n\nGuess with *${prefix}hangman <letter>*`); }
        if (a0 === 'giveup') { hang.delete(key); return m.reply(`The word was *${g.word.toUpperCase()}*.`); }
        if (!/^[a-z]$/.test(a0)) return m.reply(`Send one letter: *${prefix}hangman e*\n\n${hangView(g)}`);
        if (g.letters.has(a0)) return m.reply(`You already tried *${a0.toUpperCase()}*.\n\n${hangView(g)}`);
        g.letters.add(a0);
        if (!g.word.includes(a0)) g.wrong++;
        if ([...g.word].every((c) => g.letters.has(c))) { hang.delete(key); return m.reply(`🎉 You got it: *${g.word.toUpperCase()}*`); }
        if (g.wrong >= 6) { hang.delete(key); return m.reply(`💀 Game over! The word was *${g.word.toUpperCase()}*.`); }
        return m.reply(hangView(g));
      }

      if (cmd === 'memory') {
        let g = memory.get(key);
        if (!g || a0 === 'new') {
          const board = [...EMOJI, ...EMOJI].sort(() => Math.random() - 0.5);
          g = { board, matched: new Set(), moves: 0 }; memory.set(key, g);
          return m.reply(`🧠 *MEMORY*\nFind all the pairs. Flip two cards: *${prefix}memory 3 11*\n\n${memView(g)}`);
        }
        const i = parseInt(args[0], 10) - 1, j = parseInt(args[1], 10) - 1;
        if (![i, j].every((x) => x >= 0 && x < 16) || i === j) return m.reply(`Pick two different cards (1-16): *${prefix}memory 3 11*\n\n${memView(g)}`);
        if (g.matched.has(i) || g.matched.has(j)) return m.reply('Those cards are already matched.\n\n' + memView(g));
        g.moves++;
        if (g.board[i] === g.board[j]) {
          g.matched.add(i); g.matched.add(j);
          if (g.matched.size === 16) { memory.delete(key); return m.reply(`🎉 All pairs found in ${g.moves} moves!`); }
          return m.reply(`✅ Match! ${g.board[i]}\n\n${memView(g)}`);
        }
        return m.reply(`❌ ${g.board[i]} and ${g.board[j]} don't match. Remember them!\n\n${memView(g, [i, j])}\nMoves: ${g.moves}\n_(Next board hides them again — use *${prefix}memory new* to restart)_`);
      }

      if (cmd === 'snake') {
        let g = snake.get(key);
        const dirs = { w: [0, -1], up: [0, -1], s: [0, 1], down: [0, 1], a: [-1, 0], left: [-1, 0], d: [1, 0], right: [1, 0] };
        if (!g || a0 === 'new') { g = { body: [[3, 4], [2, 4], [1, 4]], food: [5, 4] }; snake.set(key, g); return m.reply(`🐍 *SNAKE*\nMove with *${prefix}snake w/a/s/d* (up/left/down/right)\n\n${snakeView(g)}`); }
        const d = dirs[a0];
        if (!d) return m.reply(`Use w / a / s / d\n\n${snakeView(g)}`);
        const head = [g.body[0][0] + d[0], g.body[0][1] + d[1]];
        if (head[0] < 0 || head[1] < 0 || head[0] >= N || head[1] >= N || g.body.slice(0, -1).some((b) => b[0] === head[0] && b[1] === head[1])) {
          snake.delete(key); return m.reply(`💥 Game over! Score: ${g.body.length - 3}\nPlay again: *${prefix}snake new*`);
        }
        g.body.unshift(head);
        if (head[0] === g.food[0] && head[1] === g.food[1]) g.food = newFood(g); else g.body.pop();
        return m.reply(snakeView(g));
      }

      if (cmd === 'chess') {
        let Chess;
        try { ({ Chess } = require('chess.js')); } catch (e) { return m.reply('♟️ Chess needs the "chess.js" package. Run: npm install chess.js'); }
        let g = chess.get(key);
        if (a0 === 'resign' && g) { chess.delete(key); return m.reply('🏳️ Game ended by resignation.'); }
        if (!g || a0 === 'new') {
          const opp = (m.mentionedJid && m.mentionedJid[0]) || null;
          g = { c: new Chess(), white: m.sender, black: opp };
          chess.set(key, g);
          return Cypher.sendMessage(m.chat, { text: `♟️ *CHESS*\nWhite: @${bare(m.sender)}\nBlack: ${opp ? '@' + bare(opp) : 'the next person who moves'}\n\n${chessView(g.c)}\n\nMove with *${prefix}chess e4* (or Nf3, O-O). *${prefix}chess resign* to quit.`, mentions: [m.sender, ...(opp ? [opp] : [])] }, { quoted: m });
        }
        if (!a0 || a0 === 'board') return m.reply(`${chessView(g.c)}\n\nTurn: ${g.c.turn() === 'w' ? 'White' : 'Black'}`);
        const turnJid = g.c.turn() === 'w' ? g.white : g.black;
        if (!turnJid && g.c.turn() === 'b' && bare(m.sender) !== bare(g.white)) g.black = m.sender;
        else if (turnJid && bare(turnJid) !== bare(m.sender)) return m.reply('⏳ It is not your turn.');
        else if (!turnJid && bare(m.sender) === bare(g.white)) return m.reply('⏳ Waiting for Black to move.');
        try { g.c.move(args[0]); } catch (e) { return m.reply('⚠️ Illegal move. Examples: e4, Nf3, O-O, exd5, e8=Q'); }
        let status = '';
        if (g.c.isCheckmate()) { status = `\n\n🏆 Checkmate! ${g.c.turn() === 'w' ? 'Black' : 'White'} wins.`; chess.delete(key); }
        else if (g.c.isStalemate() || g.c.isDraw()) { status = '\n\n🤝 Draw.'; chess.delete(key); }
        else if (g.c.isCheck()) status = '\n\n⚠️ Check!';
        else status = `\n\nTurn: ${g.c.turn() === 'w' ? 'White' : 'Black'}`;
        return m.reply(chessView(g.c) + status);
      }
    } catch (err) { return m.reply(`❌ Error: ${err.message}`); }
  }
});
