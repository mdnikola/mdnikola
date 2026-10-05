const { ensureChatSettings, getGroupRoles } = require('../Functions/group-antis.js'); 

module.exports = () => ({
  name: "Promote User",
  triggers: ["promote"],
  description: "Promote a user to admin",
  category: "Group Admin",
  react: "⬆️",
  owner: true,

  run: async ({ m, Cypher, text }) => {
    if (!m.isGroup) {
      return m.reply("⚠️ *This command can only be used in groups!*");
    }

    try {
      const { isSenderAdmin, isBotAdmin } = await getGroupRoles(Cypher, m);

      if (!isSenderAdmin) {
        return m.reply("⚠️ *This command requires admin privileges!*");
      }

      if (!isBotAdmin) {
        return m.reply("⚠️ *Bot needs to be an admin to perform this action!*");
      }

      let target = m.mentionedJid?.[0] 
        ?? (m.quoted ? m.quoted.sender : null)
        ?? (text.replace(/\D/g, "") ? text.replace(/\D/g, "") + "@s.whatsapp.net" : null);

      if (!target) {
        return m.reply("⚠️ *Mention or reply to a user to promote!*");
      }

      await Cypher.groupParticipantsUpdate(m.chat, [target], "promote");
      m.reply(`✅ *User promoted successfully!*`);

    } catch (error) {
      console.error("Error promoting user:", error);
      m.reply("❌ *Failed to promote user. They might already be an admin or the bot lacks permissions.*");
    }
  }
});