'use strict';
const { getJSON, getBuf, ffBuffer, bare } = require('../Functions/nk-utils.js');

const ACTIONS = { cuddle: 'cuddles', hug: 'hugs', kiss: 'kisses', pat: 'pats', slap: 'slaps', wink: 'winks at' };
const PICS = ['waifu', 'neko', 'shinobu', 'megumin'];

module.exports = () => ({
  name: 'Anime Pack',
  triggers: ['anime', 'cuddle', 'hug', 'kiss', 'neko', 'pat', 'slap', 'waifu', 'wink'],
  menu: ['anime', 'cuddle', 'hug', 'kiss', 'neko', 'pat', 'slap', 'waifu', 'wink'],
  description: 'Anime pictures and reaction GIFs',
  category: 'Anime',
  react: '🌸',

  run: async ({ m, Cypher, command }) => {
    const cmd = command.toLowerCase();
    try {
      const type = cmd === 'anime' ? PICS[Math.floor(Math.random() * PICS.length)] : cmd;
      const data = await getJSON(`https://api.waifu.pics/sfw/${type}`);
      if (!data?.url) throw new Error('No image returned');

      let caption = '';
      let mentions = [];
      if (ACTIONS[cmd]) {
        const target = (m.mentionedJid && m.mentionedJid[0]) || (m.quoted && m.quoted.sender) || null;
        caption = target ? `@${bare(m.sender)} ${ACTIONS[cmd]} @${bare(target)}` : `@${bare(m.sender)} ${ACTIONS[cmd]} everyone`;
        mentions = target ? [m.sender, target] : [m.sender];
      }

      if (/\.gif$/i.test(data.url)) {
        try {
          const gif = await getBuf(data.url);
          const mp4 = await ffBuffer(gif, 'gif', 'mp4', (i, o) => ['-i', i, '-movflags', 'faststart', '-pix_fmt', 'yuv420p', '-vf', 'scale=trunc(iw/2)*2:trunc(ih/2)*2', o]);
          return Cypher.sendMessage(m.chat, { video: mp4, gifPlayback: true, caption, mentions }, { quoted: m });
        } catch (e) { /* fall through to a plain image */ }
      }
      return Cypher.sendMessage(m.chat, { image: { url: data.url }, caption, mentions }, { quoted: m });
    } catch (err) {
      return m.reply(`❌ Could not fetch the image: ${err.message}`);
    }
  }
});
