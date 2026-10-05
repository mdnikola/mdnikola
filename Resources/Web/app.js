
let currentSessionPhone = null;
let currentSessionToken = null;
let currentGameCode = null;
let currentGameType = null; 
let gamePollingInterval = null;
let gamePlayerSymbol = null;
let gameCreatorPhone = null;
let gameOpponentPhone = null;
let pairingPollInterval = null;
let pairingPollTimeout = null;
let pairingStatusInterval = null;
let pairingStatusTimeout = null;

const elements = {
  authNav: document.getElementById('authNav'),
  loginForm: document.getElementById('loginForm'),
  registerForm: document.getElementById('registerForm'),
  loginAlert: document.getElementById('loginAlert'),
  registerAlert: document.getElementById('registerAlert'),
  pairCodeBox: document.getElementById('pairCodeBox'),
  loginPhone: document.getElementById('loginPhone'),
  accessCode: document.getElementById('accessCode'),
  accessCodeGroup: document.getElementById('accessCodeGroup'),
  verifyCodeBtn: document.getElementById('verifyCodeBtn'),
  pairPhone: document.getElementById('pairPhone'),
  masterPassword: document.getElementById('masterPassword'),

  settingsDashboard: document.getElementById('settingsDashboard'),
  sessionOwnerName: document.getElementById('sessionOwnerName'),
  sessionInfo: document.getElementById('sessionInfo'),
  settingsContainer: document.getElementById('settingsContainer'),
  settingsTab: document.getElementById('settingsTab'),
  gamesTab: document.getElementById('gamesTab'),

  pendingGamesContainer: document.getElementById('pendingGamesContainer'),
  pendingGameCode: document.getElementById('pendingGameCode'),
  joinGameForm: document.getElementById('joinGameForm'),
  gameCodeInput: document.getElementById('gameCodeInput'),
  gameBoard: document.getElementById('gameBoard'),
  gameInfo: document.getElementById('gameInfo'),
  board: document.getElementById('board')
};

function showAlert(alertDiv, message, type) {
  alertDiv.className = `alert alert-${type}`;
  alertDiv.textContent = message;
  alertDiv.classList.remove('hidden');
  alertDiv.style.animation = 'slideIn 0.3s ease-out';

  if (type === 'success') {
    setTimeout(() => {
      alertDiv.style.animation = 'slideOut 0.3s ease-out';
      setTimeout(() => alertDiv.classList.add('hidden'), 300);
    }, 3000);
  }
}

function showLoading(container, message = 'Loading...') {
  container.innerHTML = `
    <div class="loading">
      <div class="spinner"></div>
      <p>${message}</p>
    </div>
  `;
}

function formatValue(value) {
  if (typeof value === 'boolean') return value ? '✅ Enabled' : '❌ Disabled';
  if (typeof value === 'object') return JSON.stringify(value, null, 2);
  return String(value);
}

function debounce(func, wait) {
  let timeout;
  return function executedFunction(...args) {
    const later = () => {
      clearTimeout(timeout);
      func(...args);
    };
    clearTimeout(timeout);
    timeout = setTimeout(later, wait);
  };
}

function initAuthNavigation() {
  document.querySelectorAll('.nav-tab').forEach(btn => {
    btn.addEventListener('click', (e) => {
      document.querySelectorAll('.nav-tab').forEach(b => b.classList.remove('active'));
      e.target.classList.add('active');

      const mode = e.target.dataset.mode;
      elements.loginForm.classList.toggle('hidden', mode === 'register');
      elements.registerForm.classList.toggle('hidden', mode === 'login');
    });
  });
}

async function requestAccessCode() {
  const phone = elements.loginPhone.value.trim();

  if (!phone) {
    showAlert(elements.loginAlert, 'Please enter a phone number', 'error');
    return;
  }

  showAlert(elements.loginAlert, 'Requesting access code...', 'info');

  try {
    const response = await fetch('/api/request-access-code', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ phone })
    });

    const data = await response.json();

    if (response.ok) {
      showAlert(elements.loginAlert, 'Access code sent! Check your message myself', 'success');
      elements.accessCodeGroup.classList.remove('hidden');
      elements.verifyCodeBtn.classList.remove('hidden');
      currentSessionPhone = phone;
    } else {
      showAlert(elements.loginAlert, data.error || 'Failed to request access code', 'error');
    }
  } catch (error) {
    showAlert(elements.loginAlert, 'Error: ' + error.message, 'error');
  }
}

async function verifyAccessCode() {
  const code = elements.accessCode.value.trim();

  if (!code) {
    showAlert(elements.loginAlert, 'Please enter the access code', 'error');
    return;
  }

  showAlert(elements.loginAlert, 'Verifying code...', 'info');

  try {
    const response = await fetch('/api/verify-access-code', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ phone: currentSessionPhone, code })
    });

    const data = await response.json();

    if (response.ok) {
      currentSessionToken = data.token;
      localStorage.setItem('sessionToken', data.token);
      localStorage.setItem('sessionPhone', currentSessionPhone);
      loginSuccess();
    } else {
      showAlert(elements.loginAlert, data.error || 'Invalid access code', 'error');
    }
  } catch (error) {
    showAlert(elements.loginAlert, 'Error: ' + error.message, 'error');
  }
}

async function registerSession() {
  const phone = elements.pairPhone.value.trim();
  const password = elements.masterPassword.value;

  if (!phone) {
    showAlert(elements.registerAlert, 'Please enter your phone number', 'error');
    return;
  }

  if (!password) {
    showAlert(elements.registerAlert, 'Please enter the master password', 'error');
    return;
  }

  showAlert(elements.registerAlert, 'Verifying password and generating pairing code...', 'info');
  elements.pairCodeBox.classList.add('hidden');
  elements.pairCodeBox.textContent = '';

  try {
    const registerRes = await fetch('/api/register-session', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ password, phone })
    });

    const data = await registerRes.json();

    if (!registerRes.ok) {
      showAlert(elements.registerAlert, data.error || 'Registration failed', 'error');
      return;
    }

    showAlert(elements.registerAlert, data.message || 'Session registered successfully!', 'success');

    if (data.pairingCode) {
      elements.pairCodeBox.className = 'alert alert-info';
      elements.pairCodeBox.textContent = `Pairing Code: ${data.pairingCode}`;
      elements.pairCodeBox.classList.remove('hidden');
      startPairingCodePolling(phone, password);
      startPairingStatusPolling(phone, password);
    }

    elements.pairPhone.value = '';
    elements.masterPassword.value = '';
  } catch (error) {
    showAlert(elements.registerAlert, 'Error: ' + error.message, 'error');
  }
}

function startPairingCodePolling(phone, password) {
  if (!phone || !password) return;

  if (pairingPollInterval) clearInterval(pairingPollInterval);
  if (pairingPollTimeout) clearTimeout(pairingPollTimeout);

  const poll = async () => {
    try {
      const response = await fetch('/api/pairing-code', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ phone, password })
      });

      if (response.status === 404) {
        stopPairingCodePolling();
        return;
      }

      const data = await response.json();
      if (response.ok && data.code) {
        const currentText = elements.pairCodeBox.textContent || '';
        const nextText = `Pairing Code: ${data.code}`;
        if (currentText !== nextText) {
          elements.pairCodeBox.className = 'alert alert-info';
          elements.pairCodeBox.textContent = nextText;
          elements.pairCodeBox.classList.remove('hidden');
        }
      }
    } catch {}
  };

  pairingPollInterval = setInterval(poll, 5000);
  pairingPollTimeout = setTimeout(() => stopPairingCodePolling(), 2 * 60 * 1000);
  poll();
}

function stopPairingCodePolling() {
  if (pairingPollInterval) clearInterval(pairingPollInterval);
  if (pairingPollTimeout) clearTimeout(pairingPollTimeout);
  pairingPollInterval = null;
  pairingPollTimeout = null;
}

function startPairingStatusPolling(phone, password) {
  if (!phone || !password) return;

  if (pairingStatusInterval) clearInterval(pairingStatusInterval);
  if (pairingStatusTimeout) clearTimeout(pairingStatusTimeout);

  const poll = async () => {
    try {
      const response = await fetch('/api/pairing-status', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ phone, password })
      });

      const data = await response.json();
      if (response.ok && data.paired) {
        showAlert(elements.registerAlert, '✅ Pairing successful! You can now login.', 'success');
        stopPairingStatusPolling();
        stopPairingCodePolling();
        elements.pairCodeBox.classList.add('hidden');
        elements.pairCodeBox.textContent = '';
      }
    } catch {}
  };

  pairingStatusInterval = setInterval(poll, 3000);
  pairingStatusTimeout = setTimeout(() => stopPairingStatusPolling(), 2 * 60 * 1000);
  poll();
}

function stopPairingStatusPolling() {
  if (pairingStatusInterval) clearInterval(pairingStatusInterval);
  if (pairingStatusTimeout) clearTimeout(pairingStatusTimeout);
  pairingStatusInterval = null;
  pairingStatusTimeout = null;
}

function loginSuccess() {
  document.getElementById('authCard').classList.add('hidden');
  elements.settingsDashboard.classList.remove('hidden');

  loadSettings();
}

async function loadSettings() {
  showLoading(elements.settingsContainer, 'Loading settings...');

  try {
    const response = await fetch('/api/settings', {
      headers: { 'Authorization': `Bearer ${currentSessionToken}` }
    });

    const data = await response.json();

    if (response.ok) {
      displaySettings(data);
    } else {
      logout();
    }
  } catch (error) {
    console.error('Error loading settings:', error);
    showAlert(elements.loginAlert, 'Failed to load settings', 'error');
  }
}

function displaySettings(settings) {
  elements.sessionInfo.textContent = `Phone: ${currentSessionPhone}`;
  
  const META = {
    prefix:           { label: 'Command Prefix',       desc: 'Character that triggers bot commands (e.g. . / ! / #)', category: 'Bot' },
    mode:             { label: 'Bot Mode',             desc: 'public = all users | private = owner only | group = groups only', category: 'Bot' },
    botname:          { label: 'Bot Name',             desc: 'Display name of the bot', category: 'Bot' },
    ownername:        { label: 'Owner Name',           desc: 'Your personal display name', category: 'Bot' },
    authorname:       { label: 'Author Name',          desc: 'Author shown in sticker metadata', category: 'Bot' },
    packname:         { label: 'Pack Name',            desc: 'Sticker pack name', category: 'Bot' },
    ownernumber:      { label: 'Owner Number',         desc: 'Your WhatsApp number with country code', category: 'Bot' },
    timezone:         { label: 'Timezone',             desc: 'e.g. Africa/Nairobi, America/New_York', category: 'Bot' },
    sudo:             { label: 'Sudo Users',           desc: 'Comma-separated numbers with admin access', category: 'Access' },
    cmdreact:         { label: 'Command React',        desc: 'React with emoji when a command is used', category: 'Reactions' },
    autoreact:        { label: 'Auto React',           desc: 'Auto-react with emoji to all incoming messages', category: 'Reactions' },
    autoreactstatus:  { label: 'Auto React Status',   desc: 'Auto-react to contacts\' status updates', category: 'Status' },
    statusemoji:      { label: 'Status Emoji',         desc: 'Emoji used when reacting to statuses', category: 'Status' },
    autoviewstatus:   { label: 'Auto View Status',    desc: 'Automatically view all status updates', category: 'Status' },
    statusantidelete: { label: 'Status Anti-Delete',  desc: 'Recover deleted status updates', category: 'Status' },
    antibug:          { label: 'Anti-Bug',             desc: 'Block known WhatsApp exploit/crash messages', category: 'Protection' },
    antidelete:       { label: 'Anti-Delete',          desc: 'Recover deleted messages: private / all / false', category: 'Protection' },
    antiedit:         { label: 'Anti-Edit',            desc: 'Log edited messages: private / all / false', category: 'Protection' },
    autotype:         { label: 'Auto Typing',          desc: 'Show typing indicator while processing commands', category: 'Presence' },
    autoread:         { label: 'Auto Read',            desc: 'Automatically mark messages as read', category: 'Presence' },
    alwaysonline:     { label: 'Always Online',        desc: 'Keep your presence set to online', category: 'Presence' },
    autorecord:       { label: 'Auto Record',          desc: 'Show recording indicator in voice chats', category: 'Presence' },
    xp:               { label: 'Total XP',            desc: 'Earned through games — cannot be edited', category: 'Game Stats', readonly: true },
    wins:             { label: 'Wins',                 desc: 'Total multiplayer game wins', category: 'Game Stats', readonly: true },
    losses:           { label: 'Losses',               desc: 'Total multiplayer game losses', category: 'Game Stats', readonly: true },
    draws:            { label: 'Draws',                desc: 'Total multiplayer game draws', category: 'Game Stats', readonly: true },
  };

  const categories = {};
  for (const [key, value] of Object.entries(settings)) {
    const meta = META[key] || {
      label: key.replace(/([A-Z])/g, ' $1').replace(/^./, s => s.toUpperCase()),
      desc: '', category: 'Other'
    };
    if (!categories[meta.category]) categories[meta.category] = [];
    categories[meta.category].push({ key, value, meta });
  }

  let html = '';

  for (const [cat, items] of Object.entries(categories)) {
    html += `<div class="settings-section-header">${cat}</div>`;

    for (const { key, value, meta } of items) {
      const isBool     = typeof value === 'boolean';
      const isArray    = Array.isArray(value);
      const isReadonly = !!(meta.readonly);
      const displayVal = isArray ? value.join(', ') : String(value);
      const checked    = isBool && value ? 'checked' : '';

      if (isReadonly) {
        html += `
          <div class="setting-card" style="opacity:0.85">
            <div class="setting-top">
              <div style="min-width:0; flex:1">
                <div class="setting-label">${meta.label} <span style="font-size:10px;color:var(--text-muted);font-weight:400;margin-left:4px">🔒 Read-only</span></div>
                ${meta.desc ? `<div class="setting-desc">${meta.desc}</div>` : ''}
              </div>
              <div style="font-size:20px;font-weight:800;color:var(--brand-light);flex-shrink:0;padding-left:12px">${displayVal}</div>
            </div>
          </div>
        `;
        continue;
      }

      html += `
        <div class="setting-card">
          <div class="setting-top">
            <div style="min-width:0; flex:1">
              <div class="setting-label">${meta.label}</div>
              ${meta.desc ? `<div class="setting-desc">${meta.desc}</div>` : ''}
            </div>
            ${isBool ? `
            <div class="toggle-wrap" style="flex-shrink:0">
              <label class="toggle">
                <input type="checkbox" data-setting="${key}" ${checked} onchange="updateSetting('${key}', this)">
                <span class="toggle-track"></span>
              </label>
              <span class="toggle-label">${value ? 'Enabled' : 'Disabled'}</span>
            </div>` : ''}
          </div>
          ${!isBool ? `
          <div class="setting-controls">
            <input type="text" class="setting-input" data-setting="${key}"
                   value="${displayVal}" placeholder="${meta.label}">
            <button class="btn-update" onclick="updateSetting('${key}', this)">Save</button>
          </div>` : ''}
        </div>
      `;
    }
  }

  elements.settingsContainer.innerHTML = html;
}

const READONLY_SETTINGS = new Set(['xp','wins','losses','draws']);
async function updateSetting(key, element) {
  if (READONLY_SETTINGS.has(key)) { showNotification('This stat is managed by the games system and cannot be edited.', 'error'); return; }
  let value;

  if (element.type === 'checkbox') {
    value = element.checked;
    const wrap = element.closest('.toggle-wrap');
    if (wrap) {
      const lbl = wrap.querySelector('.toggle-label');
      if (lbl) lbl.textContent = value ? 'Enabled' : 'Disabled';
    }
  } else {
    const input = element.previousElementSibling;
    value = input ? input.value.trim() : '';
  }

  try {
    const response = await fetch('/api/update-setting', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${currentSessionToken}`
      },
      body: JSON.stringify({ key, value })
    });

    if (response.ok) {
      if (element.type !== 'checkbox') {
        element.classList.add('saved');
        element.textContent = '✓ Saved';
        setTimeout(() => {
          element.classList.remove('saved');
          element.textContent = 'Save';
        }, 2000);
      } else {
        showNotification(`${key} ${value ? 'enabled' : 'disabled'}`, 'success');
      }
    } else {
      const err = await response.json().catch(() => ({}));
      showNotification('Failed to save: ' + (err.error || 'Unknown error'), 'error');
      if (element.type === 'checkbox') {
        element.checked = !value;
        const wrap = element.closest('.toggle-wrap');
        if (wrap) {
          const lbl = wrap.querySelector('.toggle-label');
          if (lbl) lbl.textContent = !value ? 'Enabled' : 'Disabled';
        }
      }
    }
  } catch (error) {
    showNotification('Error: ' + error.message, 'error');
  }
}

function switchTab(tabName) {
  const lbTab = document.getElementById('leaderboardTab');
  elements.settingsTab.classList.add('hidden');
  elements.gamesTab.classList.add('hidden');
  if (lbTab) lbTab.classList.add('hidden');
  document.querySelectorAll('.nav-tab').forEach(btn => btn.classList.remove('active'));
  if (tabName === 'settings') {
    elements.settingsTab.classList.remove('hidden');
    document.querySelector('.nav-tab[onclick*="settings"]')?.classList.add('active');
  } else if (tabName === 'games') {
    elements.gamesTab.classList.remove('hidden');
    document.querySelector('.nav-tab[onclick*="games"]')?.classList.add('active');
  } else if (tabName === 'leaderboard') {
    if (lbTab) lbTab.classList.remove('hidden');
    document.querySelector('.nav-tab[onclick*="leaderboard"]')?.classList.add('active');
  }
}

// ── Game State ──────────────────────────────────────────────────────────────
let chatPollTs = 0;
let isRecordingVoice = false;
let mediaRecorder = null;
let audioChunks = [];

//─────────────────────────────────────────────────

async function createGame(type, extraBody = {}) {
  try {
    currentGameType = type;
    const response = await fetch(`/api/games/create-${type}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${currentSessionToken}` },
      body: JSON.stringify(extraBody)
    });
    const data = await response.json();
    if (!response.ok) { showNotification('Error: ' + data.error, 'error'); return; }
    currentGameCode = data.gameCode;
    gameCreatorPhone = currentSessionPhone;
    gamePlayerSymbol = type === 'tictactoe' ? 'X' : null;
    gameOpponentPhone = null;
    showPendingGame(data.gameCode);
  } catch (e) { showNotification('Error: ' + e.message, 'error'); }
}

function createTictactoeGame()  { createGame('tictactoe'); }
function createRpsGame()        { createGame('rps'); }
function createCoinGame()       { createGame('coin'); }
function createConnectFourGame(){ createGame('connectfour'); }
function createNumberGuessGame(){ createGame('numberguess'); }
function createMpMemoryGame() { createGame('mp-memory'); }
function createMpSnakeGame()  { createGame('mp-snake'); }
async function createWordGuessGame() {
  const word = prompt('Enter your secret word (3–8 letters):\nYour opponent will try to guess it!');
  if (!word) return;
  createGame('wordguess', { secretWord: word });
}

// ── Pending / Join / Board ──────────────────────────────────────────────────

function showPendingGame(gameCode) {
  elements.pendingGameCode.textContent = gameCode;
  const header = document.getElementById('pendingHeader');
  const NAMES = { tictactoe:'Tic Tac Toe', rps:'Rock Paper Scissors', coin:'Coin Flip',
                  connectfour:'Connect Four', numberguess:'Number Guess', wordguess:'Word Guess',
                  'mp-memory':'Multiplayer Memory', 'mp-snake':'Multiplayer Snake' };
  if (header) header.textContent = `🎮 Pending — ${NAMES[currentGameType] || 'Game'}`;
  elements.pendingGamesContainer.classList.remove('hidden');
  elements.joinGameForm.classList.add('hidden');
  elements.gameBoard.classList.add('hidden');
  if (gamePollingInterval) clearInterval(gamePollingInterval);
  gamePollingInterval = setInterval(checkForOpponent, 1500);
  setTimeout(() => elements.pendingGamesContainer.scrollIntoView({ behavior:'smooth', block:'start' }), 80);
}

function showJoinGameForm() {
  elements.pendingGamesContainer.classList.add('hidden');
  elements.gameBoard.classList.add('hidden');
  elements.joinGameForm.classList.remove('hidden');
  elements.gameCodeInput.focus();
}

async function checkForOpponent() {
  try {
    const r = await fetch(`/api/games/${currentGameCode}`, { headers: { 'Authorization': `Bearer ${currentSessionToken}` } });
    const game = await r.json();
    if (game.status === 'active' || game.opponentPhone) {
      clearInterval(gamePollingInterval); gamePollingInterval = null;
      gameOpponentPhone = game.opponentPhone;
      showGameBoard();
    }
  } catch {}
}

function copyGameCode() {
  const code = elements.pendingGameCode.textContent;
  navigator.clipboard.writeText(code).then(() => showNotification('Code copied!','success')).catch(() => {
    const t = document.createElement('textarea'); t.value = code; document.body.appendChild(t);
    t.select(); document.execCommand('copy'); document.body.removeChild(t);
    showNotification('Code copied!','success');
  });
}

async function cancelPendingGame() {
  try {
    await fetch(`/api/games/${currentGameCode}/cancel`, { method:'POST', headers:{ 'Authorization': `Bearer ${currentSessionToken}` }});
    backToGames(); showNotification('Game cancelled','info');
  } catch {}
}

async function joinGameWithCode() {
  const gameCode = elements.gameCodeInput.value.trim().toUpperCase();
  if (!gameCode) { showNotification('Enter a game code', 'error'); return; }
  try {
    const r = await fetch('/api/games/join', {
      method:'POST',
      headers:{ 'Content-Type':'application/json', 'Authorization': `Bearer ${currentSessionToken}` },
      body: JSON.stringify({ gameCode })
    });
    const data = await r.json();
    if (!r.ok) { showNotification('Error: ' + data.error, 'error'); return; }
    currentGameCode = gameCode; currentGameType = data.game.type;
    gameCreatorPhone = data.game.creatorPhone;
    gameOpponentPhone = currentSessionPhone;
    gamePlayerSymbol  = currentGameType === 'tictactoe' ? 'O' : null;
    elements.joinGameForm.classList.add('hidden');
    elements.gameCodeInput.value = '';
    showGameBoard();
  } catch (e) { showNotification('Error: ' + e.message, 'error'); }
}

async function showGameBoard() {
  elements.pendingGamesContainer.classList.add('hidden');
  elements.joinGameForm.classList.add('hidden');
  elements.gameBoard.classList.remove('hidden');
  const chatSection = document.getElementById('gameChat');
  if (chatSection) chatSection.classList.remove('hidden');
  chatPollTs = 0;
  await updateGameBoard();
  setTimeout(() => elements.gameBoard.scrollIntoView({ behavior:'smooth', block:'start' }), 80);
  if (gamePollingInterval) clearInterval(gamePollingInterval);
  gamePollingInterval = setInterval(updateGameBoard, 1500);
}

// ── Board Updat────────────────────────────────────────

async function updateGameBoard() {
  try {
    const r = await fetch(`/api/games/${currentGameCode}`, { headers:{ 'Authorization': `Bearer ${currentSessionToken}` }});
    const game = await r.json();

    if (!gameCreatorPhone) gameCreatorPhone = game.creatorPhone;
    if (!gameOpponentPhone && game.opponentPhone) gameOpponentPhone = game.opponentPhone;
    if (!gamePlayerSymbol && game.type === 'tictactoe') {
      gamePlayerSymbol = currentSessionPhone === game.creatorPhone ? 'X' : 'O';
    }

    const youAreCreator  = currentSessionPhone === game.creatorPhone;
    const youAreOpponent = currentSessionPhone === game.opponentPhone;
    const creatorLabel   = youAreCreator  ? 'You' : (game.creatorPhone  || 'Player 1');
    const opponentLabel  = youAreOpponent ? 'You' : (game.opponentPhone || 'Player 2');

    elements.board.style.display = 'none';

    if (game.type === 'tictactoe') {
      renderTictactoe(game, youAreCreator, creatorLabel, opponentLabel);
    } else if (game.type === 'rps') {
      renderRps(game, youAreCreator, creatorLabel, opponentLabel);
    } else if (game.type === 'coin') {
      renderCoin(game, youAreCreator, creatorLabel, opponentLabel);
    } else if (game.type === 'connectfour') {
      renderConnectFour(game, youAreCreator, creatorLabel, opponentLabel);
    } else if (game.type === 'numberguess') {
      renderNumberGuess(game, youAreCreator, creatorLabel, opponentLabel);
    } else if (game.type === 'wordguess') {
      renderWordGuess(game, youAreCreator, creatorLabel, opponentLabel);
    } else if (game.type === 'mp-memory') {
      renderMpMemory(game, youAreCreator, creatorLabel, opponentLabel);
    } else if (game.type === 'mp-snake') {
      renderMpSnake(game, youAreCreator, creatorLabel, opponentLabel);
    }

    renderChat(game, youAreCreator);

    if (game.status === 'finished') {
      clearInterval(gamePollingInterval); gamePollingInterval = null;
    }
  } catch (e) { console.error('updateGameBoard:', e); }
}

// ── Render helpers ──────────────────────────────────────────────────────────

function statusBanner(icon, title, sub='') {
  return `<div class="game-status waiting"><div style="text-align:center">
    <div style="font-size:36px;margin-bottom:8px">${icon}</div>
    <h3 style="margin:0 0 4px">${title}</h3>
    ${sub ? `<p style="color:var(--text-muted);margin:0;font-size:13px">${sub}</p>` : ''}
  </div></div>`;
}

function resultBanner(game, youAreCreator, extraHtml='') {
  const isWinner = (game.winner === 'creator' && youAreCreator) ||
                   (game.winner === 'opponent' && !youAreCreator) ||
                   (game.winner === 'X' && youAreCreator) ||
                   (game.winner === 'O' && !youAreCreator);
  const cls = game.winner === 'draw' ? 'draw' : isWinner ? 'win' : 'lose';
  const msg = game.winner === 'draw' ? '🤝 Draw!' : isWinner ? '🎉 You Win! +60 XP' : '😞 You Lose — +15 XP';
  return `<div class="game-status finished ${cls}">
    <div class="result-message"><h2>${msg}</h2></div>
    ${extraHtml}
  </div>`;
}

// ── Tic Tac Toe ─────────────────────────────────────────────────────────────

function renderTictactoe(game, youAreCreator, creatorLabel, opponentLabel) {
  const isYourTurn = (gamePlayerSymbol === 'X' && game.currentTurn === 'X') ||
                     (gamePlayerSymbol === 'O' && game.currentTurn === 'O');

  let info = '';
  if (game.status === 'waiting') {
    info = statusBanner('⭕', 'Waiting for opponent…', `Share code: ${currentGameCode}`);
  } else if (game.status === 'active') {
    info = `<div class="game-status active">
      <div class="players">
        <div class="player ${game.currentTurn==='X'?'active':''} ${game.winner==='X'?'winner':''}">
          <span class="symbol">❌</span><span class="name">${creatorLabel}</span>
        </div>
        <div class="vs">VS</div>
        <div class="player ${game.currentTurn==='O'?'active':''} ${game.winner==='O'?'winner':''}">
          <span class="symbol">⭕</span><span class="name">${opponentLabel}</span>
        </div>
      </div>
      <div class="turn-message ${isYourTurn?'your-turn':'opponent-turn'}">
        ${isYourTurn ? '🎯 Your Turn!' : "⏳ Opponent's Turn"}
      </div>
    </div>`;
  } else {
    const wonSym = game.winner === 'draw' ? null : game.winner;
    info = resultBanner(game, youAreCreator, `
      <div class="players" style="margin-top:12px">
        <div class="player ${game.winner==='X'?'winner':''}"><span class="symbol">❌</span><span class="name">${creatorLabel}</span></div>
        <div class="vs">VS</div>
        <div class="player ${game.winner==='O'?'winner':''}"><span class="symbol">⭕</span><span class="name">${opponentLabel}</span></div>
      </div>`);
  }

  elements.gameInfo.innerHTML = info;

  // Draw board
  const boardDiv = elements.board;
  boardDiv.style.display = 'grid';
  boardDiv.innerHTML = '';
  for (let i = 0; i < 9; i++) {
    const cell = document.createElement('div');
    cell.className = 'game-cell' + (game.board[i] === 'X' ? ' x' : game.board[i] === 'O' ? ' o' : '');
    cell.textContent = game.board[i] || '';
    if (!game.board[i] && game.status === 'active' && isYourTurn) {
      cell.classList.add('clickable');
      cell.onclick = () => submitMove({ position: i });
    }
    boardDiv.appendChild(cell);
  }
}

// ── Rock Paper Scissors ─────────────────────────────────────────────────────

function renderRps(game, youAreCreator, creatorLabel, opponentLabel) {
  const yourChosen   = youAreCreator ? game.creatorChosen  : game.opponentChosen;
  const theirChosen  = youAreCreator ? game.opponentChosen : game.creatorChosen;
  const yourChoice   = youAreCreator ? game.creatorChoice  : game.opponentChoice;
  const theirChoice  = youAreCreator ? game.opponentChoice : game.creatorChoice;
  const ICONS = { rock:'🪨', paper:'📄', scissors:'✂️' };

  let info = '';
  if (game.status === 'waiting') {
    info = statusBanner('🪨📄✂️', 'Waiting for opponent…', `Share code: ${currentGameCode}`);
  } else if (game.status === 'active') {
    const choiceBtns = !yourChosen ? `
      <div class="rps-choices">
        <button class="rps-btn" onclick="submitMove({choice:'rock'})">🪨<span>Rock</span></button>
        <button class="rps-btn" onclick="submitMove({choice:'paper'})">📄<span>Paper</span></button>
        <button class="rps-btn" onclick="submitMove({choice:'scissors'})">✂️<span>Scissors</span></button>
      </div>` : '';

    info = `<div class="game-status active">
      <div class="rps-status-row">
        <div class="rps-player-status ${yourChosen?'done':'pending'}">
          <span class="rps-status-icon">${yourChosen?'✅':'⌛'}</span>
          <span class="rps-status-name">You — ${yourChosen ? 'Ready!' : 'Choose…'}</span>
          ${yourChosen ? `<span class="rps-locked">${ICONS[yourChoice]} Locked</span>` : ''}
        </div>
        <div class="vs">VS</div>
        <div class="rps-player-status ${theirChosen?'done':'pending'}">
          <span class="rps-status-icon">${theirChosen?'✅':'⌛'}</span>
          <span class="rps-status-name">${youAreCreator?opponentLabel:creatorLabel} — ${theirChosen ? 'Ready!' : 'Choosing…'}</span>
        </div>
      </div>
      ${choiceBtns}
    </div>`;
  } else {
    const youWin = (game.winner === 'creator' && youAreCreator) || (game.winner === 'opponent' && !youAreCreator);
    info = resultBanner(game, youAreCreator, `
      <div class="rps-reveal">
        <div class="rps-reveal-player">
          <div class="rps-big-icon">${ICONS[youAreCreator ? game.creatorChoice : game.opponentChoice] || '❓'}</div>
          <div>You: ${(youAreCreator ? game.creatorChoice : game.opponentChoice) || 'N/A'}</div>
        </div>
        <div class="vs" style="font-size:24px">VS</div>
        <div class="rps-reveal-player">
          <div class="rps-big-icon">${ICONS[youAreCreator ? game.opponentChoice : game.creatorChoice] || '❓'}</div>
          <div>Them: ${(youAreCreator ? game.opponentChoice : game.creatorChoice) || 'N/A'}</div>
        </div>
      </div>`);
  }
  elements.gameInfo.innerHTML = info;
}

// ── Coin Flip ───────────────────────────────────────────────────────────────

function renderCoin(game, youAreCreator, creatorLabel, opponentLabel) {
  const yourChoice  = youAreCreator ? game.creatorChoice  : game.opponentChoice;
  const theirChoice = youAreCreator ? game.opponentChoice : game.creatorChoice;

  let info = '';
  if (game.status === 'waiting') {
    info = statusBanner('🪙', 'Waiting for opponent…', `Share code: ${currentGameCode}`);
  } else if (game.status === 'active') {
    const pickBtns = !yourChoice ? `
      <div class="rps-choices">
        <button class="rps-btn" onclick="submitMove({choice:'heads'})">🟡<span>Heads</span></button>
        <button class="rps-btn" onclick="submitMove({choice:'tails'})">⚫<span>Tails</span></button>
      </div>` : '';

    info = `<div class="game-status active">
      <p style="text-align:center;color:var(--text-muted);font-size:13px;margin-bottom:14px">
        Both players pick a side — then the bot flips the coin. Whoever matches wins!
      </p>
      <div class="rps-status-row">
        <div class="rps-player-status ${yourChoice?'done':'pending'}">
          <span class="rps-status-icon">${yourChoice?'✅':'⌛'}</span>
          <span class="rps-status-name">You — ${yourChoice ? '🔒 Locked' : 'Pick…'}</span>
        </div>
        <div class="vs">VS</div>
        <div class="rps-player-status ${theirChoice?'done':'pending'}">
          <span class="rps-status-icon">${theirChoice?'✅':'⌛'}</span>
          <span class="rps-status-name">${youAreCreator?opponentLabel:creatorLabel} — ${theirChoice?'🔒 Locked':'Picking…'}</span>
        </div>
      </div>
      ${pickBtns}
    </div>`;
  } else {
    info = resultBanner(game, youAreCreator, `
      <div class="coin-result-row">
        <div class="coin-result-cell"><div class="coin-big">🟡</div><strong>Coin Flipped</strong><span class="coin-landed">${game.coinResult || '?'}</span></div>
        <div class="coin-result-cell"><strong>You picked</strong><span>${yourChoice || 'N/A'}</span></div>
        <div class="coin-result-cell"><strong>They picked</strong><span>${theirChoice || 'N/A'}</span></div>
      </div>`);
  }
  elements.gameInfo.innerHTML = info;
}

// ── Connect Four ────────────────────────────────────────────────────────────

function renderConnectFour(game, youAreCreator, creatorLabel, opponentLabel) {
  const isYourTurn = game.currentTurn === (youAreCreator ? 'creator' : 'opponent');
  const yourPiece  = youAreCreator ? '🔴' : '🟡';
  const theirPiece = youAreCreator ? '🟡' : '🔴';

  let info = '';
  if (game.status === 'waiting') {
    info = statusBanner('🔴🟡', 'Waiting for opponent…', `Share code: ${currentGameCode}`);
  } else if (game.status === 'active') {
    info = `<div class="game-status active">
      <div class="players">
        <div class="player ${game.currentTurn==='creator'?'active':''} ${game.winner==='creator'?'winner':''}">
          <span class="symbol">🔴</span><span class="name">${creatorLabel}</span>
        </div>
        <div class="vs">VS</div>
        <div class="player ${game.currentTurn==='opponent'?'active':''} ${game.winner==='opponent'?'winner':''}">
          <span class="symbol">🟡</span><span class="name">${opponentLabel}</span>
        </div>
      </div>
      <div class="turn-message ${isYourTurn?'your-turn':'opponent-turn'}">
        ${isYourTurn ? `${yourPiece} Your Turn` : `${theirPiece} Opponent's Turn`}
      </div>
    </div>`;
  } else {
    info = resultBanner(game, youAreCreator, `
      <div class="players" style="margin-top:12px">
        <div class="player ${game.winner==='creator'?'winner':''}"><span class="symbol">🔴</span><span class="name">${creatorLabel}</span></div>
        <div class="vs">VS</div>
        <div class="player ${game.winner==='opponent'?'winner':''}"><span class="symbol">🟡</span><span class="name">${opponentLabel}</span></div>
      </div>`);
  }
  elements.gameInfo.innerHTML = info;

  // Draw Connect Four board (render rows top-to-bottom, row 5 = top visually)
  const boardDiv = elements.board;
  boardDiv.innerHTML = '';
  boardDiv.className = 'c4-board';
  boardDiv.style.display = 'block';

  // Column drop buttons
  if (game.status === 'active' && isYourTurn) {
    const colBtns = document.createElement('div');
    colBtns.className = 'c4-col-btns';
    for (let c = 0; c < 7; c++) {
      const btn = document.createElement('button');
      btn.className = 'c4-drop-btn';
      btn.textContent = '↓';
      btn.onclick = () => submitMove({ col: c });
      colBtns.appendChild(btn);
    }
    boardDiv.appendChild(colBtns);
  }

  const grid = document.createElement('div');
  grid.className = 'c4-grid';
  for (let r = 5; r >= 0; r--) {
    for (let c = 0; c < 7; c++) {
      const cell = document.createElement('div');
      const piece = game.board[r][c];
      cell.className = 'c4-cell' + (piece === 'R' ? ' c4-red' : piece === 'Y' ? ' c4-yellow' : '');
      grid.appendChild(cell);
    }
  }
  boardDiv.appendChild(grid);
}

// ── Number Guess ────────────────────────────────────────────────────────────

function renderNumberGuess(game, youAreCreator, creatorLabel, opponentLabel) {
  // Don't blow away the input while the user is typing
  const _ngFocused = document.activeElement?.id === 'ngInput';
  if (_ngFocused && game.status === 'active' && (youAreCreator ? game.creatorGuess : game.opponentGuess) === null) return;
  const yourGuess  = youAreCreator ? game.creatorGuess : game.opponentGuess;
  const theirGuess = youAreCreator ? game.opponentGuess : game.creatorGuess;

  let info = '';
  if (game.status === 'waiting') {
    info = statusBanner('🔢', 'Waiting for opponent…', `Share code: ${currentGameCode}`);
  } else if (game.status === 'active') {
    const guessFrm = yourGuess === null ? `
      <div class="ng-form">
        <p style="color:var(--text-muted);font-size:13px;margin-bottom:12px">
          Guess a number 1–100. The bot has a secret target — closest guess wins!
        </p>
        <div style="display:flex;gap:10px;justify-content:center">
          <input type="number" id="ngInput" class="form-input" style="max-width:120px" min="1" max="100" placeholder="1–100">
          <button class="btn btn-primary" onclick="submitMove({guess:parseInt(document.getElementById('ngInput').value)})">Lock In</button>
        </div>
      </div>` : `<p style="text-align:center;color:var(--brand-light);margin-top:12px">🔒 Your guess is locked in!</p>`;

    info = `<div class="game-status active">
      <div class="rps-status-row">
        <div class="rps-player-status ${yourGuess!==null?'done':'pending'}">
          <span class="rps-status-icon">${yourGuess!==null?'✅':'⌛'}</span>
          <span class="rps-status-name">You — ${yourGuess!==null?'Locked':'Guessing…'}</span>
        </div>
        <div class="vs">VS</div>
        <div class="rps-player-status ${theirGuess!==null?'done':'pending'}">
          <span class="rps-status-icon">${theirGuess!==null?'✅':'⌛'}</span>
          <span class="rps-status-name">${youAreCreator?opponentLabel:creatorLabel} — ${theirGuess!==null?'Locked':'Guessing…'}</span>
        </div>
      </div>
      ${guessFrm}
    </div>`;
  } else {
    info = resultBanner(game, youAreCreator, `
      <div class="ng-reveal">
        <div class="ng-reveal-cell"><span class="ng-big">🎯</span><strong>Target</strong><span>${game.target}</span></div>
        <div class="ng-reveal-cell"><span class="ng-big">🧑</span><strong>Your guess</strong><span>${yourGuess ?? 'N/A'}</span></div>
        <div class="ng-reveal-cell"><span class="ng-big">🤖</span><strong>Their guess</strong><span>${theirGuess ?? 'N/A'}</span></div>
      </div>`);
  }
  elements.gameInfo.innerHTML = info;
}

// ── Word Guess (Wordle-style) ───────────────────────────────────────────────

function renderWordGuess(game, youAreCreator, creatorLabel, opponentLabel) {
  const _wgFocused = document.activeElement?.id === 'wgInput';
  if (_wgFocused && game.status === 'active') return;
  let info = '';
  if (game.status === 'waiting') {
    const roleMsg = youAreCreator ? `You set the word (${game.wordLength || '?'} letters). Waiting for guesser…`
                                  : 'Waiting for game to start…';
    info = statusBanner('🔤', roleMsg, `Share code: ${currentGameCode}`);
  } else if (game.status === 'active') {
    const guessGrid = (game.guesses || []).map(g => {
      const tiles = g.word.split('').map((l, i) => `<div class="wg-tile ${g.result[i]}">${l}</div>`).join('');
      return `<div class="wg-row">${tiles}</div>`;
    }).join('');

    const remaining = game.maxGuesses - (game.guesses||[]).length;
    const hintLine = !youAreCreator && game.hint ? `
      <div class="wg-hint">💡 Hint — Scrambled: <strong style="letter-spacing:3px;color:var(--brand-light);font-size:15px">${game.hint}</strong></div>` : '';
    const guessFrm  = !youAreCreator ? `
      <div class="wg-input-row">
        <input type="text" id="wgInput" class="form-input" maxlength="${game.wordLength || 5}"
               placeholder="${game.wordLength || '?'}-letter word" style="text-transform:uppercase;letter-spacing:3px;max-width:180px"
               onkeydown="if(event.key==='Enter')submitWordGuess()">
        <button class="btn btn-primary" onclick="submitWordGuess()">Guess</button>
      </div>
      <p style="text-align:center;color:var(--text-muted);font-size:12px;margin-top:8px">${remaining} guess${remaining!==1?'es':''} left</p>` : '';

    const creatorView = youAreCreator ? `<p style="text-align:center;color:var(--text-muted);font-size:13px;margin-bottom:12px">
      Your word: <strong style="color:var(--brand-light);letter-spacing:2px">${game.secretWord || '?????'}</strong><br>
      Guesses: ${(game.guesses||[]).length} / ${game.maxGuesses}</p>` : '';

    info = `<div class="game-status active">
      ${creatorView}
      ${hintLine}
      <div class="wg-grid">${guessGrid || '<p style="text-align:center;color:var(--text-muted)">No guesses yet</p>'}</div>
      ${guessFrm}
    </div>`;
  } else {
    const secretDisp = game.secretWord ? `<p style="font-size:13px;color:var(--text-muted);margin-top:8px">
      The word was: <strong style="color:var(--brand-light);font-size:18px;letter-spacing:3px">${game.secretWord}</strong></p>` : '';
    const guessGrid = (game.guesses || []).map(g => {
      const tiles = g.word.split('').map((l, i) => `<div class="wg-tile ${g.result[i]}">${l}</div>`).join('');
      return `<div class="wg-row">${tiles}</div>`;
    }).join('');
    info = resultBanner(game, youAreCreator, `${secretDisp}<div class="wg-grid" style="margin-top:12px">${guessGrid}</div>`);
  }
  elements.gameInfo.innerHTML = info;
}

function submitWordGuess() {
  const input = document.getElementById('wgInput');
  if (!input) return;
  const word = input.value.trim();
  submitMove({ word });
  input.value = '';
}

// ── Unified Move Submission ─────────────────────────────────────────────────

async function makeGameMove(move) { submitMove({ position: move }); }

async function submitMove(payload) {
  try {
    const r = await fetch(`/api/games/${currentGameCode}/move`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${currentSessionToken}` },
      body: JSON.stringify(payload)
    });
    const data = await r.json();
    if (r.ok) { updateGameBoard(); }
    else { showNotification('Error: ' + data.error, 'error'); }
  } catch (e) { showNotification('Error: ' + e.message, 'error'); }
}

// ── In-Game Chat ────────────────────────────────────────────────────────────

function renderChat(game, youAreCreator) {
  const box = document.getElementById('chatMessages');
  if (!box) return;
  const msgs = game.chat || [];
  const newMsgs = msgs.filter(m => m.ts > chatPollTs);
  if (newMsgs.length === 0 && msgs.length > 0 && chatPollTs > 0) return; // nothing new

  box.innerHTML = msgs.length === 0 ? '<p class="chat-empty">No messages yet…</p>' : msgs.map(m => {
    const isMe = m.from === currentSessionPhone;
    if (m.voice) {
      const src = `data:${m.mimeType || 'audio/webm'};base64,${m.voice}`;
      return `<div class="chat-msg ${isMe?'mine':'theirs'}">
        <div class="chat-bubble"><audio controls src="${src}" style="max-width:200px;height:36px"></audio></div>
      </div>`;
    }
    return `<div class="chat-msg ${isMe?'mine':'theirs'}">
      <div class="chat-bubble">${escapeHtml(m.text)}</div>
    </div>`;
  }).join('');

  if (newMsgs.length > 0) {
    box.scrollTop = box.scrollHeight;
    chatPollTs = Math.max(...msgs.map(m => m.ts));
  } else if (chatPollTs === 0 && msgs.length > 0) {
    box.scrollTop = box.scrollHeight;
    chatPollTs = Math.max(...msgs.map(m => m.ts));
  }
}

async function sendGameChatMessage() {
  const input = document.getElementById('chatInput');
  const msg = input ? input.value.trim() : '';
  if (!msg || !currentGameCode) return;
  input.value = '';
  try {
    await fetch(`/api/games/${currentGameCode}/chat`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${currentSessionToken}` },
      body: JSON.stringify({ message: msg })
    });
    updateGameBoard();
  } catch {}
}

async function toggleVoiceRecording() {
  const btn = document.getElementById('voiceRecordBtn');
  if (!isRecordingVoice) {
    if (!window.isSecureContext || !navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
      showNotification('🎙️ Voice notes require a secure connection (HTTPS). Use text chat instead.', 'error');
      return;
    }
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      mediaRecorder = new MediaRecorder(stream);
      audioChunks = [];
      mediaRecorder.ondataavailable = e => audioChunks.push(e.data);
      mediaRecorder.onstop = async () => {
        const blob = new Blob(audioChunks, { type: 'audio/webm' });
        const reader = new FileReader();
        reader.onloadend = async () => {
          const base64 = reader.result.split(',')[1];
          await fetch(`/api/games/${currentGameCode}/voice`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${currentSessionToken}` },
            body: JSON.stringify({ audioBase64: base64, mimeType: 'audio/webm' })
          });
          updateGameBoard();
        };
        reader.readAsDataURL(blob);
        stream.getTracks().forEach(t => t.stop());
      };
      mediaRecorder.start();
      isRecordingVoice = true;
      if (btn) { btn.textContent = '⏹️'; btn.style.color = '#ef4444'; }
    } catch (err) {
      const msg = err.name === 'NotAllowedError' ? 'Microphone access denied — allow mic permission in your browser.' :
                  err.name === 'NotFoundError'   ? 'No microphone found on this device.' :
                  'Microphone error: ' + err.message;
      showNotification('🎙️ ' + msg, 'error');
    }
  } else {
    if (mediaRecorder) mediaRecorder.stop();
    isRecordingVoice = false;
    if (btn) { btn.textContent = '🎙️'; btn.style.color = ''; }
  }
}

function escapeHtml(s) {
  return String(s).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
}

// ── Leaderboard ─────────────────────────────────────────────────────────────

async function loadLeaderboard() {
  const container = document.getElementById('leaderboardContainer');
  if (!container) return;
  container.innerHTML = '<div class="loading"><div class="spinner"></div><p>Loading…</p></div>';
  try {
    const r = await fetch('/api/leaderboard', { headers: { 'Authorization': `Bearer ${currentSessionToken}` }});
    const data = await r.json();
    if (!Array.isArray(data) || data.length === 0) {
      container.innerHTML = '<p style="text-align:center;color:var(--text-muted);padding:40px">No game data yet — play some games first!</p>';
      return;
    }
    const medals = ['🥇','🥈','🥉'];
    container.innerHTML = `
      <div class="lb-header">
        <span class="lb-rank">Rank</span>
        <span class="lb-name">Player</span>
        <span class="lb-xp">XP</span>
        <span class="lb-wld">W / L / D</span>
      </div>` +
      data.map((p, i) => `
        <div class="lb-row ${p.phone === currentSessionPhone ? 'lb-me' : ''}">
          <span class="lb-rank">${medals[i] || '#'+(i+1)}</span>
          <span class="lb-name">${escapeHtml(p.name)}</span>
          <span class="lb-xp">${p.xp} XP</span>
          <span class="lb-wld">${p.wins} / ${p.losses} / ${p.draws}</span>
        </div>`).join('');
  } catch (e) {
    container.innerHTML = '<p style="text-align:center;color:var(--error);padding:40px">Failed to load leaderboard</p>';
  }
}

// ── Single-Player Mini-Games ────────────────────────────────────────────────

function launchMemoryMatch() {
  const overlay = document.getElementById('soloGameOverlay');
  const content = document.getElementById('soloGameContent');
  if (!overlay || !content) return;
  overlay.classList.remove('hidden');

  const EMOJIS = ['🐶','🐱','🦊','🐼','🦁','🐯','🐸','🐨'];
  let cards = [...EMOJIS, ...EMOJIS].sort(() => Math.random() - 0.5);
  let flipped = [], matched = [], locked = false, moves = 0;

  function render() {
    content.innerHTML = `
      <div class="solo-header">
        <h3>🃏 Memory Match</h3>
        <p>Moves: <strong>${moves}</strong> | Pairs: <strong>${matched.length/2}</strong>/8</p>
        <button class="btn btn-secondary btn-sm" onclick="closeSoloGame()">✕ Close</button>
      </div>
      <div class="mm-grid">
        ${cards.map((c, i) => `
          <div class="mm-card ${flipped.includes(i)||matched.includes(i)?'flipped':''}"
               onclick="${locked||flipped.includes(i)||matched.includes(i)?'':''} handleMemoryClick(${i})">
            <div class="mm-front">❓</div>
            <div class="mm-back">${c}</div>
          </div>`).join('')}
      </div>`;
    if (matched.length === cards.length) {
      setTimeout(() => {
        content.innerHTML += `<div class="solo-win">🎉 You matched all pairs in ${moves} moves!</div>`;
      }, 300);
    }
  }

  window.handleMemoryClick = (i) => {
    if (locked || flipped.includes(i) || matched.includes(i)) return;
    flipped.push(i);
    moves++;
    render();
    if (flipped.length === 2) {
      locked = true;
      setTimeout(() => {
        if (cards[flipped[0]] === cards[flipped[1]]) matched.push(...flipped);
        flipped = []; locked = false;
        render();
      }, 900);
    }
  };
  render();
}

function launchSnake() {
  const overlay = document.getElementById('soloGameOverlay');
  const content = document.getElementById('soloGameContent');
  if (!overlay || !content) return;
  overlay.classList.remove('hidden');

  const COLS = 20, ROWS = 20, CELL = 18;
  let snake = [{x:10,y:10}], dir = {x:1,y:0}, food = spawnFood(), score = 0, gameOver = false, interval;

  function spawnFood() {
    let f;
    do { f = {x:Math.floor(Math.random()*COLS), y:Math.floor(Math.random()*ROWS)}; }
    while (snake.some(s => s.x===f.x && s.y===f.y));
    return f;
  }

  content.innerHTML = `
    <div class="solo-header">
      <h3>🐍 Snake</h3>
      <p>Score: <strong id="snakeScore">0</strong></p>
      <button class="btn btn-secondary btn-sm" onclick="closeSoloGame()">✕ Close</button>
    </div>
    <canvas id="snakeCanvas" width="${COLS*CELL}" height="${ROWS*CELL}" style="display:block;margin:0 auto;border:2px solid var(--border);border-radius:8px;background:#0a0a12"></canvas>
    <p style="text-align:center;color:var(--text-muted);font-size:12px;margin-top:8px">Arrow keys or WASD to move</p>`;

  const canvas = document.getElementById('snakeCanvas');
  const ctx = canvas.getContext('2d');

  function draw() {
    ctx.clearRect(0,0,canvas.width,canvas.height);
    ctx.fillStyle = '#6d28d9';
    snake.forEach((s,i) => {
      ctx.globalAlpha = i===0 ? 1 : 0.7;
      ctx.beginPath(); ctx.roundRect(s.x*CELL+1, s.y*CELL+1, CELL-2, CELL-2, 3); ctx.fill();
    });
    ctx.globalAlpha = 1;
    ctx.fillStyle = '#ef4444';
    ctx.beginPath(); ctx.arc(food.x*CELL+CELL/2, food.y*CELL+CELL/2, CELL/2-2, 0, Math.PI*2); ctx.fill();
    document.getElementById('snakeScore').textContent = score;
  }

  function tick() {
    const head = {x:(snake[0].x+dir.x+COLS)%COLS, y:(snake[0].y+dir.y+ROWS)%ROWS};
    if (snake.some(s=>s.x===head.x&&s.y===head.y)) { clearInterval(interval); gameOver=true;
      content.innerHTML += `<div class="solo-win">💀 Game Over! Score: ${score}<br><button class="btn btn-primary" onclick="launchSnake()">Play Again</button></div>`;
      return;
    }
    snake.unshift(head);
    if (head.x===food.x && head.y===food.y) { score+=10; food=spawnFood(); }
    else snake.pop();
    draw();
  }

  const keyMap = {ArrowUp:{x:0,y:-1},ArrowDown:{x:0,y:1},ArrowLeft:{x:-1,y:0},ArrowRight:{x:1,y:0},
                  w:{x:0,y:-1},s:{x:0,y:1},a:{x:-1,y:0},d:{x:1,y:0}};
  window.snakeKeyHandler = (e) => { if(keyMap[e.key]){e.preventDefault();const d=keyMap[e.key];if(d.x!=-dir.x||d.y!=-dir.y)dir=d;} };
  document.addEventListener('keydown', window.snakeKeyHandler);

  draw();
  interval = setInterval(tick, 130);
  window.snakeCleanup = () => { clearInterval(interval); document.removeEventListener('keydown', window.snakeKeyHandler); };
}

function closeSoloGame() {
  const overlay = document.getElementById('soloGameOverlay');
  if (overlay) overlay.classList.add('hidden');
  if (window.snakeCleanup) { window.snakeCleanup(); window.snakeCleanup = null; }
}

// ── Concede Game ───────────────────────────────────────────────────────────

async function concedeGame() {
  if (!currentGameCode) return;
  if (!confirm('Concede this game? You will be recorded as having lost.')) return;
  try {
    const r = await fetch(`/api/games/${currentGameCode}/concede`, {
      method: 'POST',
      headers: { 'Authorization': `Bearer ${currentSessionToken}` }
    });
    const data = await r.json();
    if (r.ok) { showNotification('You conceded the game.', 'info'); updateGameBoard(); }
    else { showNotification('Error: ' + data.error, 'error'); }
  } catch (e) { showNotification('Error: ' + e.message, 'error'); }
}

// ── Multiplayer Memory Match Renderer ──────────────────────────────────────

function renderMpMemory(game, youAreCreator, creatorLabel, opponentLabel) {
  const pre     = youAreCreator ? 'creator' : 'opponent';
  const oppPre  = youAreCreator ? 'opponent' : 'creator';
  const myPairs   = (game[`${pre}Matched`]     || []).length / 2;
  const theirPairs= (game[`${oppPre}Matched`] || []).length / 2;
  const myMoves   = game[`${pre}Moves`]     || 0;

  let info = '';
  if (game.status === 'waiting') {
    info = statusBanner('🃏', 'Waiting for opponent…', `Share code: ${currentGameCode}`);
  } else if (game.status === 'active') {
    const myDone = game[`${pre}Done`];
    info = `<div class="game-status active">
      <div class="players">
        <div class="player ${myDone?'winner':''}"><span class="symbol">🃏</span><span class="name">You</span></div>
        <div class="vs">VS</div>
        <div class="player ${game[`${oppPre}Done`]?'winner':''}"><span class="symbol">🃏</span><span class="name">${youAreCreator?opponentLabel:creatorLabel}</span></div>
      </div>
      <div class="mp-progress-row">
        <div class="mp-progress-cell">
          <span class="mp-score">${myPairs}/8</span>
          <span class="mp-label">Your pairs</span>
          <div class="mp-bar"><div class="mp-fill" style="width:${(myPairs/8)*100}%"></div></div>
        </div>
        <div class="mp-progress-cell">
          <span class="mp-score">${theirPairs}/8</span>
          <span class="mp-label">Their pairs</span>
          <div class="mp-bar"><div class="mp-fill mp-fill-opp" style="width:${(theirPairs/8)*100}%"></div></div>
        </div>
      </div>
      ${myDone ? '<p style="text-align:center;color:var(--success);font-weight:700;margin-top:8px">✅ You finished! Waiting for opponent…</p>' : ''}
    </div>`;
  } else {
    info = resultBanner(game, youAreCreator, `
      <div class="mp-progress-row" style="margin-top:12px">
        <div class="mp-progress-cell"><span class="mp-score">${myPairs}/8</span><span class="mp-label">Your pairs · ${myMoves} moves</span></div>
        <div class="mp-progress-cell"><span class="mp-score">${theirPairs}/8</span><span class="mp-label">Their pairs</span></div>
      </div>`);
  }
  elements.gameInfo.innerHTML = info;

  // Render shared card board in single-player mode
  const boardDiv = elements.board;
  if (game.status !== 'active' || game[`${pre}Done`]) {
    boardDiv.innerHTML = ''; boardDiv.style.display = 'none'; return;
  }
  boardDiv.style.display = 'block';
  boardDiv.className = '';
  boardDiv.style.cssText = 'display:grid;grid-template-columns:repeat(4,1fr);gap:8px;margin-top:12px;max-width:340px;margin-left:auto;margin-right:auto';

  const matched = game[`${pre}Matched`] || [];
  window._mpMemFlipped = window._mpMemFlipped || [];

  boardDiv.innerHTML = game.cards.map((emoji, i) => {
    const isMatched  = matched.includes(i);
    const isFlipped  = isMatched || window._mpMemFlipped.includes(i);
    return `<div class="mm-card ${isFlipped?'flipped':''}" onclick="handleMpMemClick(${i})" style="height:60px">
      <div class="mm-front" style="font-size:22px">❓</div>
      <div class="mm-back"  style="font-size:22px">${emoji}</div>
    </div>`;
  }).join('');

  window.handleMpMemClick = async (i) => {
    const matched2 = game[`${pre}Matched`] || [];
    if (matched2.includes(i) || window._mpMemFlipped.includes(i)) return;
    window._mpMemFlipped.push(i);
    updateGameBoard();
    if (window._mpMemFlipped.length === 2) {
      const [a, b] = window._mpMemFlipped;
      window._mpMemFlipped = [];
      await submitMove({ cardA: a, cardB: b });
    }
  };
}

// ── Multiplayer Snake Renderer ───────────────────────────────────────────────

function renderMpSnake(game, youAreCreator, creatorLabel, opponentLabel) {
  const pre    = youAreCreator ? 'creator' : 'opponent';
  const oppPre = youAreCreator ? 'opponent' : 'creator';
  const myScore    = game[`${pre}Score`]    || 0;
  const theirScore = game[`${oppPre}Score`] || 0;

  let info = '';
  if (game.status === 'waiting') {
    info = statusBanner('🐍', 'Waiting for opponent…', `Share code: ${currentGameCode}`);
  } else if (game.status === 'active') {
    const myDone = game[`${pre}Done`];
    info = `<div class="game-status active">
      <div class="mp-progress-row">
        <div class="mp-progress-cell"><span class="mp-score">${myScore}</span><span class="mp-label">Your score</span></div>
        <div class="mp-progress-cell"><span class="mp-score">${theirScore}</span><span class="mp-label">${youAreCreator?opponentLabel:creatorLabel}'s score</span></div>
      </div>
      ${myDone ? '<p style="text-align:center;color:var(--text-muted);margin-top:8px">Your snake has died — waiting for opponent…</p>' : ''}
    </div>`;
  } else {
    info = resultBanner(game, youAreCreator, `
      <div class="mp-progress-row" style="margin-top:12px">
        <div class="mp-progress-cell"><span class="mp-score">${myScore}</span><span class="mp-label">Your score</span></div>
        <div class="mp-progress-cell"><span class="mp-score">${theirScore}</span><span class="mp-label">Their score</span></div>
      </div>`);
  }
  elements.gameInfo.innerHTML = info;

  // Inline snake mini-game when active
  const boardDiv = elements.board;
  if (game.status !== 'active' || game[`${pre}Done`]) {
    boardDiv.innerHTML = ''; boardDiv.style.display = 'none'; return;
  }

  if (boardDiv.querySelector('#mpSnakeCanvas')) return; // already rendered

  const COLS = 18, ROWS = 14, CELL = 20;
  boardDiv.style.display = 'block';
  boardDiv.className = '';
  boardDiv.style.cssText = 'display:block;text-align:center;margin-top:12px';
  boardDiv.innerHTML = `
    <p style="font-size:12px;color:var(--text-muted);margin-bottom:6px">🐍 Arrow keys / WASD · snake dies = score submits</p>
    <canvas id="mpSnakeCanvas" width="${COLS*CELL}" height="${ROWS*CELL}" style="border:2px solid var(--border);border-radius:8px;background:#0a0a12"></canvas>
  `;

  const canvas = boardDiv.querySelector('#mpSnakeCanvas');
  const ctx    = canvas.getContext('2d');
  let snake = [{x:9,y:7}], dir = {x:1,y:0}, score = 0;

  function spawnFood() {
    let f;
    do { f = {x:Math.floor(Math.random()*COLS), y:Math.floor(Math.random()*ROWS)}; }
    while (snake.some(s => s.x===f.x && s.y===f.y));
    return f;
  }

  let food = spawnFood();

  function drawSnake() {
    ctx.clearRect(0,0,canvas.width,canvas.height);
    ctx.fillStyle = '#6d28d9';
    snake.forEach((s,i) => {
      ctx.globalAlpha = i===0 ? 1 : 0.7;
      ctx.beginPath(); ctx.roundRect(s.x*CELL+1, s.y*CELL+1, CELL-2, CELL-2, 3); ctx.fill();
    });
    ctx.globalAlpha = 1;
    ctx.fillStyle = '#ef4444';
    ctx.beginPath(); ctx.arc(food.x*CELL+CELL/2, food.y*CELL+CELL/2, CELL/2-2, 0, Math.PI*2); ctx.fill();
  }

  async function tick() {
    const head = {x:(snake[0].x+dir.x+COLS)%COLS, y:(snake[0].y+dir.y+ROWS)%ROWS};
    if (snake.some(s=>s.x===head.x&&s.y===head.y)) {
      clearInterval(window._mpSnakeInterval);
      window._mpSnakeInterval = null;
      document.removeEventListener('keydown', window._mpSnakeKey);
      // Submit final score
      await submitMove({ score, done: true });
      updateGameBoard();
      return;
    }
    snake.unshift(head);
    if (head.x===food.x && head.y===food.y) { score+=10; food=spawnFood(); await submitMove({ score, done: false }); }
    else snake.pop();
    drawSnake();
  }

  const keyMap = {ArrowUp:{x:0,y:-1},ArrowDown:{x:0,y:1},ArrowLeft:{x:-1,y:0},ArrowRight:{x:1,y:0},
                  w:{x:0,y:-1},s:{x:0,y:1},a:{x:-1,y:0},d:{x:1,y:0}};
  window._mpSnakeKey = (e) => { if(keyMap[e.key]){e.preventDefault();const d=keyMap[e.key];if(d.x!=-dir.x||d.y!=-dir.y)dir=d;} };
  document.addEventListener('keydown', window._mpSnakeKey);
  drawSnake();
  if (window._mpSnakeInterval) clearInterval(window._mpSnakeInterval);
  window._mpSnakeInterval = setInterval(tick, 120);
}

// ── Back to Games ───────────────────────────────────────────────────────────

function backToGames() {
  currentGameCode = null; gamePlayerSymbol = null;
  gameCreatorPhone = null; gameOpponentPhone = null;
  chatPollTs = 0;
  if (gamePollingInterval) { clearInterval(gamePollingInterval); gamePollingInterval = null; }
  // Cleanup MP Snake if running
  if (window._mpSnakeInterval) { clearInterval(window._mpSnakeInterval); window._mpSnakeInterval = null; }
  if (window._mpSnakeKey) { document.removeEventListener('keydown', window._mpSnakeKey); window._mpSnakeKey = null; }
  window._mpMemFlipped = [];
  elements.gameBoard.classList.add('hidden');
  elements.pendingGamesContainer.classList.add('hidden');
  elements.joinGameForm.classList.add('hidden');
  const chatSection = document.getElementById('gameChat');
  if (chatSection) chatSection.classList.add('hidden');
}


function logout() {
  localStorage.removeItem('sessionToken');
  localStorage.removeItem('sessionPhone');
  currentSessionToken = null;
  currentSessionPhone = null;

  elements.settingsDashboard.classList.add('hidden');
  document.getElementById('authCard').classList.remove('hidden');
  elements.loginForm.classList.remove('hidden');
  elements.registerForm.classList.add('hidden');
  elements.authNav.classList.remove('hidden');
  elements.accessCodeGroup.classList.add('hidden');
  elements.verifyCodeBtn.classList.add('hidden');

  elements.masterPassword.value = '';
  elements.loginPhone.value = '';
  elements.accessCode.value = '';
  elements.pairPhone.value = '';
  elements.pairCodeBox.classList.add('hidden');
  elements.pairCodeBox.textContent = '';
  stopPairingCodePolling();
  stopPairingStatusPolling();
}

function showNotification(message, type = 'info') {
  const notification = document.createElement('div');
  notification.className = `notification notification-${type}`;
  notification.innerHTML = `
    <div class="notification-content">
      <span class="notification-icon">${type === 'success' ? '✅' : type === 'error' ? '❌' : 'ℹ️'}</span>
      <span class="notification-message">${message}</span>
    </div>
    <button class="notification-close" onclick="this.parentElement.remove()">×</button>
  `;

  document.body.appendChild(notification);
  
  setTimeout(() => {
    if (notification.parentElement) {
      notification.style.animation = 'slideOutRight 0.3s ease-out';
      setTimeout(() => notification.remove(), 300);
    }
  }, 5000);
}

function initApp() {
  initAuthNavigation();

  const token = localStorage.getItem('sessionToken');
  const phone = localStorage.getItem('sessionPhone');

  if (token && phone) {
    currentSessionToken = token;
    currentSessionPhone = phone;
    loginSuccess();
  }

  const style = document.createElement('style');
  style.textContent = `
    @keyframes slideIn {
      from { transform: translateY(-10px); opacity: 0; }
      to { transform: translateY(0); opacity: 1; }
    }
    @keyframes slideOut {
      from { transform: translateY(0); opacity: 1; }
      to { transform: translateY(-10px); opacity: 0; }
    }
    @keyframes slideOutRight {
      from { transform: translateX(0); opacity: 1; }
      to { transform: translateX(100%); opacity: 0; }
    }
  `;
  document.head.appendChild(style);
}

document.addEventListener('DOMContentLoaded', initApp);
