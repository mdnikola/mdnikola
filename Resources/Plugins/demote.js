const { ensureChatSettings, getGroupRoles } = require('../Functions/group-antis.js');

module.exports = () => ({
  name: "Demote Admin",
  triggers: ["demote"],
  description: "Demote a user from admin to member",
  category: "Group Admin",
  react: "⬇️",
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

      let target = m.mentionedJid[0] 
        ? m.mentionedJid[0] 
        : m.quoted 
        ? m.quoted.sender 
        : text.replace(/\D/g, "") 
        ? text.replace(/\D/g, "") + "@s.whatsapp.net" 
        : null;

      if (!target) {
        return m.reply("⚠️ *Mention or reply to a user to demote!*");
      }

      await Cypher.groupParticipantsUpdate(m.chat, [target], "demote");
      m.reply(`✅ *User demoted successfully!*`);
    } catch (error) {
      console.error("Error demoting user:", error);
      m.reply("❌ *Failed to demote user. They might already be a member or the bot lacks permissions.*");
    }
  }
});