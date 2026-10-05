'use strict';
module.exports = () => ({
  name: 'Owner Info Pack',
  triggers: ['about', 'owner', 'repo'],
  menu: ['about', 'owner', 'repo'],
  description: 'About the bot and its owner',
  category: 'Owner',
  react: '👑',

  run: async ({ m, Cypher, command, db }) => {
    const cmd = command.toLowerCase();
    const owner = db?.ownername || 'Nikola';
    const number = String(db?.ownernumber || '').replace(/[^0-9]/g, '');
    if (cmd === 'about') return m.reply(`🤖 *${db?.botname || 'NIKOLA MD'}*\nA WhatsApp multi-device bot.\n👑 Owner: ${owner}\n📚 Based on CypherX-Ultra by Tylor.`);
    if (cmd === 'repo') {
      const gh = (() => { try { return require('../../settings.js').GITHUB_USERNAME; } catch (e) { return ''; } })();
      return m.reply(gh ? `📦 https://github.com/${gh}/CypherX-Ultra` : '📦 Repo link is not set (add GITHUB_USERNAME in your settings).');
    }
    if (number.length < 7) return m.reply(`👑 Owner: *${owner}*\n(Number not set yet. Owner can run *.setowner ${owner} <number>*)`);
    const vcard = `BEGIN:VCARD\nVERSION:3.0\nFN:${owner}\nTEL;type=CELL;type=VOICE;waid=${number}:+${number}\nEND:VCARD`;
    return Cypher.sendMessage(m.chat, { contacts: { displayName: owner, contacts: [{ vcard }] } }, { quoted: m });
  }
});
