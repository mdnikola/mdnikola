

const { cod3api } = require('../Functions/cod3uchiha-api.js');

module.exports = () => ({
  name: 'Morse Code',
  triggers: ['morse', 'morseencode', 'morsedecode'],
  description: 'Convert text to/from Morse code',
  category: 'Tools',
  react: '📡',

  run: async ({ m, text, prefix, command }) => {
    if (!text) {
      return m.reply(
        `*Usage:* ${prefix}${command} <text or morse code>\n\n` +
        `*Examples:*\n` +
        `  ${prefix}${command} Hello World\n` +
        `  ${prefix}${command} .... . .-.. .-.. ---`
      );
    }

    try {
      const data = await cod3api('/tools/morse', { input: text }, 15_000);
      const r = data.result || data;

      const input  = r.input  || text;
      const output = r.output || r.result || data.result;

      return m.reply(
        `📡 *Morse Code*\n\n` +
        `📝 *Input:*\n${input}\n\n` +
        `🔁 *Output:*\n${output}`
      );
    } catch (err) {
      return m.reply(`❌ *Morse Error:* ${err.message || 'Conversion failed. Try again.'}`);
    }
  },
});
