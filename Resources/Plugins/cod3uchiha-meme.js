

const { cod3apiBuffer } = require('../Functions/cod3uchiha-api.js');

module.exports = () => ({
  name: 'Random Meme',
  triggers: ['cmeme', 'randmeme', 'meme2'],
  description: 'Get a random meme image from Cod3Uchiha API',
  category: 'Fun',
  react: '😂',

  run: async ({ m, Cypher }) => {
    try {
      const imageBuffer = await cod3apiBuffer('/fun/meme', {}, 20_000);

      await Cypher.sendMessage(
        m.chat,
        { image: imageBuffer, caption: '😂 *Random Meme*' },
        { quoted: m }
      );
    } catch (err) {
      return m.reply(`❌ *Meme Error:* ${err.message || 'Failed to fetch a meme. Try again later.'}`);
    }
  },
});
