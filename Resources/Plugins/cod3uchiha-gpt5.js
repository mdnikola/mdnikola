

const { cod3api } = require('../Functions/cod3uchiha-api.js');

module.exports = () => ({
  name: 'GPT-5 AI Chat',
  triggers: ['gpt5', 'ai', 'ask'],
  description: 'Chat with the GPT-5 AI model',
  category: 'AI',
  react: '🤖',

  run: async ({ m, text, prefix, command }) => {
    if (!text) {
      return m.reply(
        `*Usage:* ${prefix}${command} <your question>\n` +
        `*Example:* ${prefix}${command} What is quantum computing?`
      );
    }

    try {
     
      const data = await cod3api('/ai/gpt5', { text }, 45_000);
      const answer = data.result || 'No response received.';
      return m.reply(`🤖 *GPT-5*\n\n${answer}`);
    } catch (err) {
      return m.reply(`❌ *AI Error:* ${err.message || 'Request failed. Try again later.'}`);
    }
  },
});
