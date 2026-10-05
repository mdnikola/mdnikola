'use strict';
const axios = require('axios');
const cheerio = require('cheerio');
const { getJSON, getBuf, getMedia, uploadCatbox } = require('../Functions/nk-utils.js');

module.exports = () => ({
  name: 'Tools Pack',
  triggers: ['google', 'qr', 'shorturl', 'url', 'wiki'],
  menu: ['calc', 'define', 'google', 'iplookup', 'ping', 'qr', 'shorturl', 'speed', 'translate', 'uptime', 'url', 'weather', 'wiki'],
  description: 'Handy tools',
  category: 'Tools',
  react: '🧰',

  run: async ({ m, Cypher, text, prefix, command }) => {
    const cmd = command.toLowerCase();
    const input = (text || '').trim();
    try {
      if (cmd === 'url') {
        const media = await getMedia(m);
        if (!media) return m.reply(`Reply to an image/video/audio/file with *${prefix}url* to get a public link.`);
        const ext = (media.mime || '').split('/')[1]?.split(';')[0] || 'bin';
        return m.reply(`🔗 ${await uploadCatbox(media.buffer, 'upload.' + ext)}`);
      }
      if (!input && cmd !== 'qr') return m.reply(`*Usage:* ${prefix}${cmd} <${cmd === 'shorturl' ? 'link' : cmd === 'wiki' ? 'topic' : 'text'}>`);

      if (cmd === 'qr') {
        const body = input || (m.quoted && (m.quoted.text || m.quoted.body));
        if (!body) return m.reply(`*Usage:* ${prefix}qr <text or link>`);
        const img = await getBuf(`https://api.qrserver.com/v1/create-qr-code/?size=600x600&margin=10&data=${encodeURIComponent(body)}`);
        return Cypher.sendMessage(m.chat, { image: img, caption: '🔳 QR code' }, { quoted: m });
      }
      if (cmd === 'shorturl') {
        if (!/^https?:\/\//i.test(input)) return m.reply('⚠️ Send a full link starting with http:// or https://');
        const r = await axios.get(`https://tinyurl.com/api-create.php?url=${encodeURIComponent(input)}`, { timeout: 20000 });
        return m.reply(`🔗 ${r.data}`);
      }
      if (cmd === 'wiki') {
        const s = await getJSON(`https://en.wikipedia.org/w/api.php?action=opensearch&search=${encodeURIComponent(input)}&limit=1&format=json`);
        const title = s?.[1]?.[0];
        if (!title) return m.reply(`❌ No Wikipedia article found for "${input}".`);
        const d = await getJSON(`https://en.wikipedia.org/api/rest_v1/page/summary/${encodeURIComponent(title)}`);
        const caption = `📚 *${d.title}*\n\n${(d.extract || '').slice(0, 900)}\n\n🔗 ${d.content_urls?.mobile?.page || ''}`;
        if (d.thumbnail?.source) return Cypher.sendMessage(m.chat, { image: { url: d.thumbnail.source }, caption }, { quoted: m });
        return m.reply(caption);
      }
      if (cmd === 'google') {
        const html = (await axios.get(`https://html.duckduckgo.com/html/?q=${encodeURIComponent(input)}`, { timeout: 25000, headers: { 'User-Agent': 'Mozilla/5.0 (Linux; Android 12) Chrome/124 Mobile Safari/537.36' } })).data;
        const $ = cheerio.load(html);
        const rows = [];
        $('.result').each((i, el) => {
          if (rows.length >= 6) return;
          const a = $(el).find('.result__a').first();
          let href = a.attr('href') || '';
          const u = href.match(/uddg=([^&]+)/); if (u) href = decodeURIComponent(u[1]);
          const title = a.text().trim(), snip = $(el).find('.result__snippet').first().text().trim();
          if (title && href) rows.push(`*${rows.length + 1}. ${title}*\n${snip.slice(0, 140)}\n${href}`);
        });
        if (!rows.length) return m.reply('😕 No results found. Try different words.');
        return m.reply(`🔎 *${input}*\n\n${rows.join('\n\n')}`);
      }
    } catch (err) { return m.reply(`❌ Error: ${err.message}`); }
  }
});
