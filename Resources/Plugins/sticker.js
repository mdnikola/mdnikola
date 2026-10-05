module.exports = () => ({
  name: "Sticker Creator",
  triggers: ["sticker", "s"],
  react: "🖼️",
  description: "Converts images/videos to stickers",
  category: "Media",

  run: async ({ m, Cypher, args, prefix, command, db }) => {
    const quoted = m.quoted || m.msg?.quoted;
    if (!quoted) {
      return m.reply(`Send or reply to images, videos, or gifs with captions ${prefix + command}`);
    }

    const mime = quoted.mimetype || quoted.msg?.mimetype;
    if (!mime) {
      return m.reply(`The quoted message does not contain media. Please send or reply to an image, video, or gif.`);
    }

    const swns = args.join(" ");
    const pcknms = swns.split("|")[0];
    const atnms = swns.split("|")[1];

    try {
      if (/image/.test(mime)) {
        const media = await quoted.download();
        await Cypher.sendImageAsSticker(m.chat, media, m, {
          packname: pcknms ? pcknms : db.packname,
          author: atnms ? atnms : db.author,
        });
      }
      else if (/video/.test(mime)) {
        if ((quoted.msg || quoted).seconds > 10) {
          return m.reply("The video length must be 10 seconds or less. Please try again.");
        }
        const media = await quoted.download();
        await Cypher.sendVideoAsSticker(m.chat, media, m, {
          packname: pcknms ? pcknms : db.packname,
          author: atnms ? atnms : db.author,
        });
      }
      else {
        return m.reply(`Send or reply to images, videos, or gifs with captions ${prefix + command}`);
      }
    } catch (error) {
      console.error('Error processing sticker:', error);
      m.reply('An error occurred while processing the sticker.');
    }
  }
});