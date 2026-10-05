
const { cod3apiBuffer } = require('../Functions/cod3uchiha-api.js');

module.exports = () => ({
  name: 'Flux AI Image Generator',
  triggers: ['imagine', 'fluximage', 'aiimage', 'fluxai'],
  description: 'Generate an AI image from a text prompt using Flux LoRA',
  category: 'AI',
  react: '🎨',

  run: async ({ m, Cypher, text, prefix, command }) => {
    if (!text) {
      return m.reply(
        `*Usage:* ${prefix}${command} <description>\n` +
        `*Example:* ${prefix}${command} a futuristic city in Zimbabwe at sunset`
      );
    }

    try {
      await m.reply('🎨 _Generating your image — this may take a moment..._');

      const imageBuffer = await cod3apiBuffer('/ai/FluxLora', { prompt: text }, 90_000);

      await Cypher.sendMessage(
        m.chat,
        {
          image: imageBuffer,
          caption: `🎨 *AI Image*\n_Prompt: ${text}_`,
        },
        { quoted: m }
      );
    } catch (err) {
      return m.reply(`❌ *Image Generation Error:* ${err.message || 'Request failed. Try again later.'}`);
    }
  },
});
