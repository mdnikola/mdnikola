const { startPhonePairing } = require('../Functions/pairing.js');

module.exports = () => ({
  name: "Pair Command",
  triggers: ["pair", "connect"],
  description: "Pair a new session using a phone number",
  react: "🔗",
  category: "Utility",
  restricted: true,

  run: async ({ m, args, Cypher }) => {
    try {
      if (!args.length) {
        return await Cypher.sendMessage(m.chat, {
          text: "⚠️ *Usage:* .pair <phone number>\n\nExample:\n.pair 254712345678\n\nEnter the phone number with country code (no + or spaces)."
        }, { quoted: m });
      }

      const phone = args.join('').replace(/[^0-9]/g, '');

      if (phone.length < 7 || phone.length > 15) {
        return await Cypher.sendMessage(m.chat, {
          text: "⚠️ Invalid phone number. Use the full number with country code.\n\nExample: 254712345678"
        }, { quoted: m });
      }

      await Cypher.sendMessage(m.chat, {
        text: `🔄 Generating pairing code for *${phone}*...\n\nPlease wait...`
      }, { quoted: m });

      const result = await startPhonePairing(phone);

      await Cypher.sendMessage(m.chat, {
        text: `✅ *Pairing Code Generated!*\n\n📱 *Phone:* ${phone}\n🔑 *Code:* \`${result.code}\`\n\n*How to use:*\n1. Open WhatsApp on your phone\n2. Go to *Linked Devices* → *Link a Device*\n3. Choose *Link with phone number instead*\n4. Enter the code above\n\n⏳ Code expires in 2 minutes.`
      }, { quoted: m });

    } catch (error) {
      console.error(error);
      await Cypher.sendMessage(m.chat, {
        text: `❌ Failed to generate pairing code: ${error.message}`
      }, { quoted: m });
    }
  }
});
