'use strict';
const { saveSettings, sleep, bare } = require('../Functions/nk-utils.js');

module.exports = () => ({
  name: 'Owner Controls',
  triggers: ['broadcast', 'restart', 'sessionid', 'setbotname', 'setmode', 'setprefix', 'settimezone', 'shutdown', 'setowner'],
  menu: ['broadcast', 'restart', 'sessionid', 'setbotname', 'setmode', 'setowner', 'setprefix', 'settimezone', 'shutdown'],
  description: 'Owner-only bot controls',
  category: 'Owner',
  react: '🔧',
  owner: true,

  run: async ({ m, Cypher, args, text, prefix, command, db, sessionId }) => {
    const cmd = command.toLowerCase();
    const input = (text || '').trim();
    try {
      if (cmd === 'sessionid') return m.reply(`🆔 Session ID: *${sessionId}*`);

      if (cmd === 'setbotname') {
        if (!input) return m.reply(`*Usage:* ${prefix}setbotname <name>`);
        db.botname = input.slice(0, 40); await saveSettings(db, sessionId);
        return m.reply(`✅ Bot name set to *${db.botname}*`);
      }
      if (cmd === 'setowner') {
        const num = (args[args.length - 1] || '').replace(/[^0-9]/g, '');
        const name = args.slice(0, num.length >= 7 ? -1 : undefined).join(' ').trim();
        if (!name && num.length < 7) return m.reply(`*Usage:* ${prefix}setowner <name> <number>\n*Example:* ${prefix}setowner Nikola 254712345678`);
        if (name) db.ownername = name.slice(0, 40);
        if (num.length >= 7) db.ownernumber = num;
        await saveSettings(db, sessionId);
        return m.reply(`✅ Owner set: *${db.ownername}* ${db.ownernumber ? '(' + db.ownernumber + ')' : ''}`);
      }
      if (cmd === 'setmode') {
        const v = input.toLowerCase();
        if (!['public', 'private', 'group'].includes(v)) return m.reply(`*Usage:* ${prefix}setmode public | private | group\n(public = everyone, private = owner only, group = groups only)`);
        db.mode = v; await saveSettings(db, sessionId);
        return m.reply(`✅ Mode is now *${v}*`);
      }
      if (cmd === 'setprefix') {
        if (!input || /\s/.test(input) || input.length > 3) return m.reply(`*Usage:* ${prefix}setprefix <symbol>\n*Example:* ${prefix}setprefix !`);
        db.prefix = input; await saveSettings(db, sessionId);
        return m.reply(`✅ Prefix changed to *${input}*  — use it like *${input}menu*`);
      }
      if (cmd === 'settimezone') {
        try { new Intl.DateTimeFormat('en', { timeZone: input }); } catch (e) { return m.reply(`⚠️ Unknown timezone. Example: *${prefix}settimezone Africa/Nairobi*`); }
        db.timezone = input; await saveSettings(db, sessionId);
        return m.reply(`✅ Timezone set to *${input}*`);
      }
      if (cmd === 'restart') { await m.reply('♻️ Restarting…'); setTimeout(() => process.exit(0), 1500); return; }
      if (cmd === 'shutdown') { await m.reply('🛑 Shutting down. (On Heroku the dyno may start again automatically.)'); setTimeout(() => process.exit(0), 1500); return; }

      if (cmd === 'broadcast') {
        const body = input || (m.quoted && (m.quoted.text || m.quoted.body));
        if (!body) return m.reply(`*Usage:* ${prefix}broadcast <message>`);
        const groups = Object.keys(await Cypher.groupFetchAllParticipating());
        await m.reply(`📢 Sending to ${groups.length} group(s)…`);
        let ok = 0;
        for (const g of groups) {
          try { await Cypher.sendMessage(g, { text: `📢 *Broadcast from ${db.ownername || 'Owner'}*\n\n${body}` }); ok++; } catch (e) {}
          await sleep(2000);
        }
        return m.reply(`✅ Broadcast delivered to ${ok}/${groups.length} groups.`);
      }
    } catch (err) { return m.reply(`❌ Error: ${err.message}`); }
  }
});
