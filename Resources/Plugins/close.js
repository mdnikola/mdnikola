const { ensureChatSettings, getGroupRoles } = require('../Functions/group-antis.js');

module.exports = () => ({
  name: "Close Group",
  triggers: ["close"],
  description: "Close the group (only admins can send messages)",
  category: "Group Admin",
  react: "🔒",
  owner: true,

  run: async ({ m, Cypher }) => {
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

      await Cypher.groupSettingUpdate(m.chat, "announcement");
      m.reply("✅ *Group closed by admin. Only admins can send messages.*");
    } catch (error) {
      console.error("Error closing group:", error);
      m.reply("❌ *Failed to close the group. Please try again.*");
    }
  }
});