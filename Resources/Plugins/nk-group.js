'use strict';
const { groupGuard, pickTarget, saveSettings, bare } = require('../Functions/nk-utils.js');
const { ensureChatSettings } = require('../Functions/group-antis.js');

module.exports = () => ({
  name: 'Group Pack',
  triggers: ['add', 'hidetag', 'leave', 'link', 'mute', 'unmute', 'revoke', 'setdesc', 'setname', 'tagall', 'warn', 'welcome'],
  menu: ['add', 'demote', 'hidetag', 'kick', 'leave', 'link', 'mute', 'promote', 'revoke', 'setdesc', 'setname', 'tagall', 'unmute', 'warn', 'welcome'],
  description: 'Group management',
  category: 'Group',
  react: '👥',

  run: async ({ m, Cypher, text, args, prefix, command, db, sessionId }) => {
    const cmd = command.toLowerCase();
    const input = (text || '').trim();
    try {
      if (cmd === 'leave') {
        if (!m.isGroup) return m.reply('⚠️ This command only works in groups.');
        const owners = [sessionId, db?.ownernumber, ...String(db?.sudo || '').split(',')].map((x) => String(x || '').replace(/[^0-9]/g, '')).filter(Boolean);
        if (!owners.includes(bare(m.sender)) && !m.key?.fromMe) return m.reply('⚠️ Only the bot owner can make me leave.');
        await m.reply('👋 Goodbye!');
        return Cypher.groupLeave(m.chat);
      }

      const needBot = !['tagall', 'hidetag', 'welcome', 'link'].includes(cmd) || cmd === 'link';
      const roles = await groupGuard(Cypher, m, { needBotAdmin: needBot });
      if (!roles) return;
      const meta = await Cypher.groupMetadata(m.chat);
      const everyone = meta.participants.map((p) => p.id);

      if (cmd === 'tagall') {
        const lines = everyone.map((j) => `➽ @${bare(j)}`).join('\n');
        return Cypher.sendMessage(m.chat, { text: `📣 *${input || 'Attention everyone!'}*\n\n${lines}`, mentions: everyone }, { quoted: m });
      }
      if (cmd === 'hidetag') {
        const body = input || (m.quoted && (m.quoted.text || m.quoted.body)) || '📣';
        return Cypher.sendMessage(m.chat, { text: body, mentions: everyone });
      }
      if (cmd === 'link') return m.reply(`🔗 https://chat.whatsapp.com/${await Cypher.groupInviteCode(m.chat)}`);
      if (cmd === 'revoke') { await Cypher.groupRevokeInvite(m.chat); return m.reply(`✅ Old link revoked.\n🔗 https://chat.whatsapp.com/${await Cypher.groupInviteCode(m.chat)}`); }
      if (cmd === 'mute') { await Cypher.groupSettingUpdate(m.chat, 'announcement'); return m.reply('🔇 Group muted — only admins can send messages.'); }
      if (cmd === 'unmute') { await Cypher.groupSettingUpdate(m.chat, 'not_announcement'); return m.reply('🔊 Group unmuted — everyone can send messages.'); }
      if (cmd === 'setname') {
        if (!input) return m.reply(`*Usage:* ${prefix}setname <new group name>`);
        await Cypher.groupUpdateSubject(m.chat, input.slice(0, 100)); return m.reply('✅ Group name updated.');
      }
      if (cmd === 'setdesc') {
        if (!input) return m.reply(`*Usage:* ${prefix}setdesc <new description>`);
        await Cypher.groupUpdateDescription(m.chat, input.slice(0, 500)); return m.reply('✅ Group description updated.');
      }
      if (cmd === 'add') {
        const num = input.replace(/[^0-9]/g, '');
        if (num.length < 7) return m.reply(`*Usage:* ${prefix}add <number with country code>`);
        const res = await Cypher.groupParticipantsUpdate(m.chat, [num + '@s.whatsapp.net'], 'add');
        const status = String(res?.[0]?.status || '');
        if (status === '200') return m.reply(`✅ Added @${num}`.replace('@' + num, num));
        if (status === '403') {
          const code = await Cypher.groupInviteCode(m.chat);
          await Cypher.sendMessage(num + '@s.whatsapp.net', { text: `You are invited to join *${meta.subject}*:\nhttps://chat.whatsapp.com/${code}` });
          return m.reply('📨 That user’s privacy settings block adds — I sent them the invite link instead.');
        }
        return m.reply(status === '409' ? 'ℹ️ That user is already in the group.' : `⚠️ Could not add the user (status ${status || 'unknown'}).`);
      }
      if (cmd === 'welcome') {
        const cs = ensureChatSettings(db, m.chat);
        const v = (args[0] || '').toLowerCase();
        if (!/^(on|off)$/.test(v)) return m.reply(`Welcome messages are *${cs.welcome ? 'ON' : 'OFF'}*\n*Usage:* ${prefix}welcome on | off`);
        cs.welcome = v === 'on'; await saveSettings(db, sessionId);
        return m.reply(`✅ Welcome messages ${cs.welcome ? 'enabled' : 'disabled'}.`);
      }
      if (cmd === 'warn') {
        const target = pickTarget(m, input);
        if (!target) return m.reply(`*Usage:* ${prefix}warn @user (or reply to their message)`);
        if (meta.participants.some((p) => bare(p.id) === bare(target) && p.admin)) return m.reply('⚠️ I can’t warn an admin.');
        const cs = ensureChatSettings(db, m.chat);
        cs.warnings = cs.warnings || {};
        const limit = cs.warnlimit || 5;
        cs.warnings[target] = (cs.warnings[target] || 0) + 1;
        const count = cs.warnings[target];
        if (count >= limit) {
          delete cs.warnings[target]; await saveSettings(db, sessionId);
          await Cypher.groupParticipantsUpdate(m.chat, [target], 'remove');
          return Cypher.sendMessage(m.chat, { text: `🚫 @${bare(target)} reached ${limit} warnings and was removed.`, mentions: [target] }, { quoted: m });
        }
        await saveSettings(db, sessionId);
        return Cypher.sendMessage(m.chat, { text: `⚠️ @${bare(target)} warned (${count}/${limit}).`, mentions: [target] }, { quoted: m });
      }
    } catch (err) { return m.reply(`❌ Error: ${err.message}`); }
  }
});
