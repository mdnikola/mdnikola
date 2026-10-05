
const { addExif } = require('../Functions/exif');
module.exports = () => ({
  name: "Sticker Watermark",
  triggers: ["take", "wm", "steal"],
  react: "🏷️",
  description: "Adds watermark/metadata to stickers",
  category: "Media",

  run: async ({ Cypher, m, args, pushname, db }) => {
    if (!m.quoted) return m.reply('Please reply to a sticker to add watermark or metadata.');

    try {
      let stick = args.join(" ").split("|");
      let packName = stick[0] && stick[0].trim() !== "" ? stick[0] : pushname || db.packname;
      let authorName = stick[1] ? stick[1].trim() : "";
      let mime = m.quoted.mimetype || '';
      if (!/webp/.test(mime)) return m.reply('Please reply to a sticker.');

      let stickerBuffer = await m.quoted.download();
      if (!stickerBuffer) return m.reply('Failed to download the sticker. Please try again.');

      let stickerWithExif = await addExif(stickerBuffer, packName, authorName);

      if (stickerWithExif) {
        await Cypher.sendFile(
          m.chat,
          stickerWithExif,
          'sticker.webp',
          '',
          m,
          null,
          { mentions: [m.sender] }
        );
      } else {
        throw new Error('Failed to process the sticker with metadata.');
      }
    } catch (error) {
      console.error('Error in watermark/sticker metadata plugin:', error);
      m.reply('An error occurred while processing the sticker.');
    }
  }
});