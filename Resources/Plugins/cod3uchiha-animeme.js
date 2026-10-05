
const { cod3apiBuffer } = require('../Functions/cod3uchiha-api.js');

module.exports = () => ({
  name: 'Anime Meme',
  triggers: ['animeme', 'ameme2', 'anifunny'],
  description: 'Get a random anime meme image',
  category: 'Fun',
  react: '😹',

  run: async ({ m, Cypher }) => {
    try {
      const imageBuffer = await cod3apiBuffer('/fun/ameme', {}, 20_000);

      await Cypher.sendMessage(
        m.chat,
        { image: imageBuffer, caption: '😹 *Anime Meme*' },
        { quoted: m }
      );
    } catch (err) {
      return m.reply(`❌ *Anime Meme Error:* ${err.message || 'Failed to fetch. Try again later.'}`);
    }
  },
});
