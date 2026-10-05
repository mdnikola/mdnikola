'use strict';
const axios = require('axios');
const yts = require('yt-search');
const FormData = require('form-data');
const { downloadYtAudio } = require('../Functions/media-dl.js');
const { getJSON, getMedia, FFMPEG, ffBuffer } = require('../Functions/nk-utils.js');

module.exports = () => ({
  name: 'Music Pack',
  triggers: ['lyrics', 'shazam', 'spotify', 'musicmenu'],
  menu: ['lyrics', 'shazam', 'spotify', 'musicmenu'],
  description: 'Music search and recognition',
  category: 'Music',
  react: '🎶',

  run: async ({ m, Cypher, text, prefix, command }) => {
    const cmd = command.toLowerCase();
    const input = (text || '').trim();
    try {
      if (cmd === 'musicmenu') {
        return m.reply(`🎶 *MUSIC MENU*\n\n➽ ${prefix}play <song>\n➽ ${prefix}song <song>\n➽ ${prefix}spotify <song or Spotify link>\n➽ ${prefix}lyrics <artist - title>\n➽ ${prefix}shazam (reply to audio)\n➽ ${prefix}playlist <link>`);
      }

      if (cmd === 'lyrics') {
        if (!input) return m.reply(`*Usage:* ${prefix}lyrics <song name>\n*Example:* ${prefix}lyrics blinding lights`);
        const q = encodeURIComponent(input);
        const r = (await yts(input + ' official audio'))?.videos?.[0];
        return m.reply(`🎤 *${input}*\n\nI don't copy full lyrics into chat. Read them here:\n🔎 https://genius.com/search?q=${q}\n${r ? `▶️ Listen: ${r.url}` : ''}`);
      }

      if (cmd === 'spotify') {
        if (!input) return m.reply(`*Usage:* ${prefix}spotify <song name or Spotify link>`);
        let query = input;
        if (/open\.spotify\.com/i.test(input)) {
          const o = await getJSON(`https://open.spotify.com/oembed?url=${encodeURIComponent(input)}`);
          query = o?.title || input;
        }
        await m.reply(`🎧 _Finding "${query}"…_`);
        const v = (await yts(query))?.videos?.[0];
        if (!v) return m.reply('❌ Song not found.');
        const { buffer, mimetype, ext } = await downloadYtAudio(v.url);
        return Cypher.sendMessage(m.chat, { audio: buffer, mimetype, fileName: `${v.title.replace(/[^\w\s]/g, '')}.${ext}` , ptt: false }, { quoted: m });
      }

      if (cmd === 'shazam') {
        const token = (process.env.AUDD_API_TOKEN || '').trim();
        if (!token) return m.reply('🔑 Song recognition needs a free API token from audd.io.\nAdd it as *AUDD_API_TOKEN* in your environment settings, then try again.');
        const media = await getMedia(m);
        if (!media || !/audio|video/.test(media.mime || '')) return m.reply(`Reply to a song/voice note/video with *${prefix}shazam*`);
        const clip = await ffBuffer(media.buffer, 'bin', 'mp3', (i, o) => ['-i', i, '-vn', '-t', '20', '-c:a', 'libmp3lame', '-q:a', '5', o]);
        const form = new FormData();
        form.append('api_token', token); form.append('return', 'apple_music,spotify');
        form.append('file', clip, { filename: 'clip.mp3' });
        const { data } = await axios.post('https://api.audd.io/', form, { headers: form.getHeaders(), timeout: 60000 });
        if (!data?.result) return m.reply('😕 I couldn\'t recognise that song. Try a clearer, longer clip.');
        const r = data.result;
        return m.reply(`🎵 *${r.title}*\n👤 ${r.artist}\n💿 ${r.album || '-'}\n📅 ${r.release_date || '-'}\n${r.song_link ? '🔗 ' + r.song_link : ''}`);
      }
    } catch (err) { return m.reply(`❌ Error: ${err.message}`); }
  }
});
