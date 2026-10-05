const fetch = require('node-fetch'); 

module.exports = () => ({
  name: "QR Code Generator",
  triggers: ["qrcode"],
  react: "🔳",
  description: "Generates QR code from text/URL",
  category: "Utility",

  run: async ({ m, Cypher, text }) => {
    if (!text) return m.reply("Enter text or URL");

    try {
      let res = await fetch(`https://api.qrserver.com/v1/create-qr-code/?data=${text}&size=200x200`);
      let qrCodeUrl = res.url;

      await Cypher.sendMessage(m.chat, { image: { url: qrCodeUrl } }, { quoted: m });
    } catch (error) {
      console.error('Error generating QR code:', error);
      m.reply('An error occurred while generating the QR code.');
    }
  }
});