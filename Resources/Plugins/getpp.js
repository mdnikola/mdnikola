module.exports = () => ({
  name: "Get profile picture Command",
  triggers: ["getpp", "getprofilepic"],
  react: "📸",
  description: "Downloads profile picture of someone.",
  category: "Utility",
  owner: true,

  run: async ({ m, Cypher }) => {
      if (!m.quoted) {
        return m.reply('Reply to a user to get their profile picture.');
      }

      const userId = m.quoted.sender;

      try {
        const ppUrl = await Cypher.profilePictureUrl(userId, 'image');

        await Cypher.sendMessage(m.chat, 
          { 
            image: { url: ppUrl }, 
            caption: `🔹 *Profile Picture of:* @${userId.split('@')[0]}`,
            mentions: [ userId ]
          }, { quoted: m }); 
      } catch {
        await Cypher.sendMessage(m.chat, { image: { url: 'https://cdn.pixabay.com/photo/2015/10/05/22/37/blank-profile-picture-973460_960_720.png?q=60' }, caption: '⚠️ No profile picture found.' }, { quoted: m });
      }
 }
});