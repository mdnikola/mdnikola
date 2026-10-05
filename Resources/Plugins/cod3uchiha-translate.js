

const { cod3api } = require('../Functions/cod3uchiha-api.js');

module.exports = () => ({
  name: 'Text Translator',
  triggers: ['translate', 'tr', 'trl', 'trt'],
  description: 'Translate text to any language. Usage: .translate <lang> <text>',
  category: 'Tools',
  react: '🌐',

  run: async ({ m, args, prefix, command }) => {
    if (args.length < 2) {
      return m.reply(
        `*Usage:* ${prefix}${command} <language> <text>\n\n` +
        `*Examples:*\n` +
        `  ${prefix}${command} es Hello, how are you?\n` +
        `  ${prefix}${command} French I love programming\n` +
        `  ${prefix}${command} ar Good morning\n\n` +
        `_Supports most language codes (es, fr, de, zh, ar, sw, pt, hi…) and full names._`
      );
    }

    const language = args[0];
    const textToTranslate = args.slice(1).join(' ');

    try {
      const data = await cod3api('/tools/trt', { text: textToTranslate, language }, 20_000);

      const { from, to, language: langName, original, result } = data;

      return m.reply(
        `🌐 *Translation*\n\n` +
        `🔤 *From:* ${from || '?'} → *To:* ${langName || to || language}\n\n` +
        `📝 *Original:*\n${original || textToTranslate}\n\n` +
        `✅ *Translated:*\n${result}`
      );
    } catch (err) {
      return m.reply(`❌ *Translation Error:* ${err.message || 'Request failed. Check your language code and try again.'}`);
    }
  },
});
