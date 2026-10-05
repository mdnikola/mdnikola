const performance = require('perf_hooks').performance;

module.exports = () => ({
  name: "Ping Command",
  triggers: ["ping", "p", "speed"],
  react: "🚀",
  description: "Checks the bot speed.",
  category: "Utility",
  
  run: async ({ m, Cypher, sessionId }) => {
const startTime = performance.now();

    try {
      const sentMessage = await Cypher.sendMessage(m.chat, {
        text: "🔸Pong!",
        contextInfo: { quotedMessage: m.message }
      });
      
      const endTime = performance.now();
      const latency = `${(endTime - startTime).toFixed(2)} ms`;
      
      await Cypher.sendMessage(m.chat, {
        text: `*🔹 NIKOLA Speed:* ${latency}`,
        edit: sentMessage.key, 
        contextInfo: { quotedMessage: m.message }
      });

    } catch (error) {
      console.error('Error sending ping message:', error);
      await Cypher.sendMessage(m.chat, {
        text: 'An error occurred while trying to ping.',
        contextInfo: { quotedMessage: m.message }
      });
    }
  }
});