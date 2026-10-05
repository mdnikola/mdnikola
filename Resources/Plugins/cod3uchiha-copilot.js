
const { cod3api } = require('../Functions/cod3uchiha-api.js');

module.exports = () => ({
  name: 'Microsoft Copilot Chat',
  triggers: ['copilot', 'bing', 'msai'],
  description: 'Chat with Microsoft Copilot AI',
  category: 'AI',
  react: '🪁',

  run: async ({ m, text, prefix, command }) => {
    if (!text) {
      return m.reply(
        `*Usage:* ${prefix}${command} <your question>\n` +
        `*Example:* ${prefix}${command} Explain black holes simply`
      );
    }

    try {
      const data = await cod3api('/ai/copilot', { text }, 45_000);
      const answer = data.result || 'No response received.';
      return m.reply(` *Microsoft Copilot*\n\n${answer}`);
    } catch (err) {
      return m.reply(`❌ *Copilot Error:* ${err.message || 'Request failed. Try again later.'}`);
    }
  },
});
