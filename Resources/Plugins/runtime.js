const { runtime } = require("../Functions/mains.js");

module.exports = () => ({
  name: "Uptime Command",
  triggers: ["uptime", "runtime"],
  react: "🚀",
  description: "Displays the total time the bot has been up.",
  category: "Utility",

  run: async ({ m, Cypher, sessionId, db }) => {
const botUptime = runtime(process.uptime());
  m.reply(`*🔹 ${botUptime}*`);
 }
});