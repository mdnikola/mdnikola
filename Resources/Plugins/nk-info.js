'use strict';
const os = require('os');
const { bare, saveSettings } = require('../Functions/nk-utils.js');
const { bootstrapBrand, attachHooks, ensurePoller } = require('../Functions/nk-hooks.js');

const fmt = (s) => { const d = Math.floor(s / 86400), h = Math.floor(s % 86400 / 3600), mi = Math.floor(s % 3600 / 60); return `${d ? d + 'd ' : ''}${h}h ${mi}m`; };

module.exports = () => ({
  name: 'Info Pack',
  triggers: ['alive', 'botstatus', 'platform', 'prefixinfo', 'sessioninfo', 'whoami'],
  menu: ['alive', 'botstatus', 'platform', 'prefixinfo', 'sessioninfo', 'whoami'],
  description: 'Bot and session information',
  category: 'Info',
  react: 'ℹ️',

  run: async ({ m, Cypher, command, prefix, db, sessionId, pushname }) => {
    ensurePoller(); attachHooks(Cypher, sessionId);
    if (bootstrapBrand(db)) { try { await saveSettings(db, sessionId); } catch (e) {} }
    const name = db?.botname || 'NIKOLA MD';
    const cmd = command.toLowerCase();
    if (cmd === 'alive') return m.reply(`✅ *${name}* is online!\n⏱️ Uptime: ${fmt(process.uptime())}\n👤 Owner: ${db?.ownername || 'Nikola'}`);
    if (cmd === 'prefixinfo') return m.reply(`🔣 Current prefix: *${prefix}*\nExample: *${prefix}menu*`);
    if (cmd === 'platform') return m.reply(`🖥️ *Platform*\nHost: ${process.env.DYNO ? 'Heroku' : os.platform()}\nOS: ${os.type()} ${os.arch()}\nNode: ${process.version}\nCPU cores: ${os.cpus().length}`);
    if (cmd === 'sessioninfo') return m.reply(`📱 *Session*\nID: ${sessionId}\nMode: ${db?.mode || 'public'}\nTimezone: ${db?.timezone || 'UTC'}\nCommand react: ${db?.cmdreact ? 'on' : 'off'}`);
    if (cmd === 'whoami') return m.reply(`🙋 *You*\nName: ${pushname || 'Unknown'}\nNumber: ${bare(m.sender)}\nChat: ${m.isGroup ? 'Group' : 'Private'}`);
    const mem = process.memoryUsage();
    return m.reply(`📊 *${name} Status*\nMode: ${db?.mode || 'public'}\nPrefix: ${prefix}\nUptime: ${fmt(process.uptime())}\nMemory: ${(mem.rss / 1048576).toFixed(0)} MB\nAuto-read: ${db?.autoread ? 'on' : 'off'} • Auto-react: ${db?.autoreact ? 'on' : 'off'}`);
  }
});
