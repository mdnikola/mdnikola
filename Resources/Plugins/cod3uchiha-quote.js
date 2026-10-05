
const { cod3api } = require('../Functions/cod3uchiha-api.js');


const quotePlugin = () => ({
  name: 'Inspirational Quote',
  triggers: ['inspire', 'cquote', 'wisdomquote'],
  description: 'Get a random inspirational quote',
  category: 'Fun',
  react: '💡',

  run: async ({ m }) => {
    try {
      const data = await cod3api('/tools/quotes', {}, 15_000);
      const r = data.result || data;

      const quote  = r.quote  || r.result || 'No quote returned.';
      const author = r.author || 'Unknown';
      const tags   = Array.isArray(r.tags) && r.tags.length ? r.tags.join(', ') : '';

      let reply = `💡 *Quote of the Moment*\n\n"${quote}"\n\n— _${author}_`;
      if (tags) reply += `\n\n🏷️ _${tags}_`;

      return m.reply(reply);
    } catch (err) {
      return m.reply(`❌ *Quote Error:* ${err.message || 'Failed to fetch a quote. Try again later.'}`);
    }
  },
});

module.exports = quotePlugin;
