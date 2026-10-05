'use strict';
const { ensurePoller } = require('../Functions/nk-hooks.js');

module.exports = () => {
  ensurePoller(); // starts the background feature loop when the bot loads
  return {
    name: 'NIKOLA Background Features',
    triggers: ['nkhooks'],
    menu: [],
    description: 'Background features status',
    category: 'Hidden',
    react: '⚙️',
    owner: true,
    run: async ({ m }) => m.reply('✅ Background features (antispam, antisticker, autobio) are active.')
  };
};
