'use strict';
const { getJSON } = require('../Functions/nk-utils.js');

const LEAGUES = { epl: 'eng.1', laliga: 'esp.1', seriea: 'ita.1', bundesliga: 'ger.1', ligue1: 'fra.1', ucl: 'uefa.champions', mls: 'usa.1', kpl: 'ken.1', europa: 'uefa.europa' };
const NAMES = { epl: 'Premier League', laliga: 'La Liga', seriea: 'Serie A', bundesliga: 'Bundesliga', ligue1: 'Ligue 1', ucl: 'Champions League', mls: 'MLS', kpl: 'Kenyan Premier League', europa: 'Europa League' };

function pickLeague(args) {
  const k = (args[0] || 'epl').toLowerCase();
  return LEAGUES[k] ? k : null;
}

module.exports = () => ({
  name: 'Sports Pack',
  triggers: ['sportsnews', 'matches', 'standings', 'scorers'],
  menu: ['sportsnews', 'matches', 'standings', 'scorers'],
  description: 'Football news, fixtures and tables',
  category: 'Sports',
  react: '⚽',

  run: async ({ m, args, prefix, command }) => {
    const cmd = command.toLowerCase();
    const key = pickLeague(args);
    if (!key) return m.reply(`Unknown league. Choose one of:\n${Object.keys(LEAGUES).join(', ')}\n\nExample: *${prefix}${cmd} laliga*`);
    const lg = LEAGUES[key];
    try {
      if (cmd === 'sportsnews') {
        const d = await getJSON(`https://site.api.espn.com/apis/site/v2/sports/soccer/${lg}/news`);
        const items = (d.articles || []).slice(0, 6);
        if (!items.length) return m.reply('😕 No news right now.');
        return m.reply(`📰 *${NAMES[key]} news*\n\n${items.map((a, i) => `${i + 1}. ${a.headline}\n${a.links?.web?.href || ''}`).join('\n\n')}`);
      }
      if (cmd === 'matches') {
        const d = await getJSON(`https://site.api.espn.com/apis/site/v2/sports/soccer/${lg}/scoreboard`);
        const ev = (d.events || []).slice(0, 15);
        if (!ev.length) return m.reply(`😕 No ${NAMES[key]} matches on the schedule right now.`);
        const lines = ev.map((e) => {
          const c = e.competitions?.[0]?.competitors || [];
          const h = c.find((x) => x.homeAway === 'home') || c[0], a = c.find((x) => x.homeAway === 'away') || c[1];
          const st = e.status?.type;
          const score = st?.state === 'pre' ? 'vs' : `${h?.score ?? 0} - ${a?.score ?? 0}`;
          const when = st?.state === 'pre' ? new Date(e.date).toUTCString().slice(5, 22) + ' UTC' : (st?.shortDetail || st?.description || '');
          return `${h?.team?.displayName} ${score} ${a?.team?.displayName}\n   _${when}_`;
        });
        return m.reply(`⚽ *${NAMES[key]} matches*\n\n${lines.join('\n')}`);
      }
      if (cmd === 'standings') {
        const d = await getJSON(`https://site.api.espn.com/apis/v2/sports/soccer/${lg}/standings`);
        const entries = d?.children?.[0]?.standings?.entries || [];
        if (!entries.length) return m.reply('😕 Standings are not available for this league right now.');
        const stat = (e, n) => (e.stats || []).find((s) => s.name === n)?.displayValue ?? '-';
        const rows = entries.slice(0, 20).map((e, i) => `${String(i + 1).padStart(2)}. ${e.team.displayName.padEnd(18).slice(0, 18)} P${stat(e, 'gamesPlayed')} Pts ${stat(e, 'points')}`);
        return m.reply(`🏆 *${NAMES[key]} table*\n\n\`\`\`\n${rows.join('\n')}\n\`\`\``);
      }
      if (cmd === 'scorers') {
        const token = (process.env.FOOTBALL_DATA_KEY || '').trim();
        const codes = { epl: 'PL', laliga: 'PD', seriea: 'SA', bundesliga: 'BL1', ligue1: 'FL1', ucl: 'CL' };
        if (!token || !codes[key]) return m.reply(`🔑 Top scorers need a free key from football-data.org.\nAdd it as *FOOTBALL_DATA_KEY* in your environment settings (works for epl, laliga, seriea, bundesliga, ligue1, ucl).`);
        const d = await getJSON(`https://api.football-data.org/v4/competitions/${codes[key]}/scorers?limit=10`, { headers: { 'X-Auth-Token': token } });
        const rows = (d.scorers || []).map((s, i) => `${i + 1}. ${s.player.name} (${s.team.shortName}) — ${s.goals} goals`);
        return m.reply(`🥇 *${NAMES[key]} top scorers*\n\n${rows.join('\n')}`);
      }
    } catch (err) { return m.reply(`❌ Could not load sports data: ${err.message}`); }
  }
});
