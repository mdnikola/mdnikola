

const { cod3apiBuffer } = require('../Functions/cod3uchiha-api.js');

module.exports = () => ({
  name: 'AI Handwriting',
  triggers: ['write', 'handwriting', 'handwrite'],
  description: 'Generate a handwritten-style image of your text',
  category: 'Tools',
  react: '✍️',

  run: async ({ m, Cypher, text, prefix, command }) => {
    if (!text) {
      return m.reply(
        `*Usage:* ${prefix}${command} <text or prompt>\n` +
        `*Example:* ${prefix}${command} Hello from NIKOLA MD!`
      );
    }

    try {
      await m.reply('✍️ _Writing..._');

      const imageBuffer = await cod3apiBuffer('/tools/write', { prompt: text }, 30_000);

      await Cypher.sendMessage(
        m.chat,
        {
          image: imageBuffer,
          caption: `✍️ *Handwriting*\n_"${text}"_`,
        },
        { quoted: m }
      );
    } catch (err) {
      return m.reply(`❌ *Handwriting Error:* ${err.message || 'Generation failed. Try again.'}`);
    }
  },
});
