

const { cod3api, downloadBuffer } = require('../Functions/cod3uchiha-api.js');

module.exports = () => ({
  name: 'TikTok Downloader',
  triggers: ['tiktok', 'tiktokdl', 'tt'],
  description: 'Download TikTok videos without watermark',
  category: 'Downloader',
  react: '🎵',

  run: async ({ m, Cypher, text, prefix, command }) => {
    if (!text) {
      return m.reply(
        `*Usage:* ${prefix}${command} <TikTok URL>\n` +
        `*Example:* ${prefix}${command} https://www.tiktok.com/@user/video/123456789`
      );
    }

    if (!/tiktok\.com/i.test(text)) {
      return m.reply(
        `❌ Please provide a valid TikTok URL.\n` +
        `*Example:* ${prefix}${command} https://www.tiktok.com/@user/video/123456789`
      );
    }

    try {
      await m.reply('⬇️ _Fetching TikTok video..._');

      const data = await cod3api('/downloaders/tiktokdl', { url: text }, 60_000);
      const result = data.result || data.data || data;

      // Keys exactly as the API returns them (camelCase noWatermark)
      const videoUrl =
        result?.noWatermark ||
        result?.standard   ||
        result?.watermark  ||
        result?.video      ||
        result?.play       ||
        result?.url        ||
        (typeof result === 'string' ? result : null);

      if (!videoUrl) {
        return m.reply('❌ Could not extract video from this TikTok link. The URL may be private or invalid.');
      }

      const videoBuffer = await downloadBuffer(videoUrl, 90_000);

      const caption = [
        `🎵 *TikTok Video*`,
        result?.title                           ? `📝 ${result.title}`                           : '',
        result?.author || result?.nickname      ? `👤 @${result.author || result.nickname}`      : '',
      ].filter(Boolean).join('\n');

      await Cypher.sendMessage(
        m.chat,
        {
          video: videoBuffer,
          mimetype: 'video/mp4',
          fileName: 'tiktok.mp4',
          caption,
        },
        { quoted: m }
      );
    } catch (err) {
      return m.reply(
        `❌ *TikTok Error:* ${err.message || 'Request failed. Try again later.'}\n` +
        `_Tip: Make sure the video is public and the URL is correct._`
      );
    }
  },
});
