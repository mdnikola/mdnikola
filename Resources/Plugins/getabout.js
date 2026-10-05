const moment = require('moment-timezone');

module.exports = () => ({
  name: "Get someone's about Command",
  triggers: ["getabout"],
  react: "📝",
  description: "Displays someone's about.",
  category: "Utility",
  owner: true,

  run: async ({ m, Cypher }) => {

      if (!m.quoted) {
        return m.reply('Reply to a user to get their about/bio.');
      }

      const userId = m.quoted.sender;

      try {
        const { status, setAt } = await Cypher.fetchStatus(userId);
        const formattedDate = moment(setAt).format("MMMM Do YYYY, h:mm:ss A");

        await Cypher.sendMessage(m.chat, { 
          text: `🔹 *About of:* @${userId.split('@')[0]}\n\n"${status}"\n\n🕒 *Set at:* ${formattedDate}`,
          mentions: [userId] 
        }, { quoted: m });

      } catch {
        m.reply(`⚠️ Unable to fetch the user's about info. This may be due to their privacy settings.`);
      }

 }
});