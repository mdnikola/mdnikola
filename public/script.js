/* NIKOLA MD Pair — frontend logic */

const $ = (id) => document.getElementById(id);

const els = {
  qrStep: $('qrStep'),
  sessionStep: $('sessionStep'),
  errorStep: $('errorStep'),

  qrImage: $('qrImage'),
  qrLoader: $('qrLoader'),
  qrStatus: $('qrStatus'),

  sessionIdBox: $('sessionIdBox'),
  timer: $('timer'),
  copyBtn: $('copyBtn'),
  pairAgainBtn: $('pairAgainBtn'),

  errorMsg: $('errorMsg'),
  retryBtn: $('retryBtn'),
  refreshBtn: $('refreshBtn'),

  alertBox: $('alertBox'),
};

let ws = null;
let countdownInterval = null;
let currentSessionId = '';

function show(el) { el.classList.remove('hidden'); }
function hide(el) { el.classList.add('hidden'); }
function showStep(step) {
  hide(els.qrStep); hide(els.sessionStep); hide(els.errorStep);
  if (step === 'qr') show(els.qrStep);
  if (step === 'session') show(els.sessionStep);
  if (step === 'error') show(els.errorStep);
}

function showAlert(msg, type = 'error') {
  els.alertBox.className = `alert alert-${type}`;
  els.alertBox.textContent = msg;
  show(els.alertBox);
}
function clearAlert() {
  els.alertBox.className = 'alert hidden';
}

function connect() {
  showStep('qr');
  hide(els.qrImage);
  show(els.qrLoader);
  els.qrStatus.textContent = 'Connecting…';

  // Use wss:// if served over https, ws:// otherwise
  const protocol = location.protocol === 'https:' ? 'wss' : 'ws';
  const wsUrl = `${protocol}://${location.host}/ws`;

  try {
    ws = new WebSocket(wsUrl);
  } catch (e) {
    showAlert('WebSocket error: ' + e.message);
    return;
  }

  ws.onopen = () => {
    els.qrStatus.textContent = 'Connected — waiting for QR code…';
  };

  ws.onmessage = (event) => {
    let msg;
    try { msg = JSON.parse(event.data); } catch { return; }

    if (msg.type === 'qr') {
      hide(els.qrLoader);
      show(els.qrImage);
      els.qrImage.src = msg.qr;
      els.qrStatus.textContent = 'Scan with WhatsApp → Settings → Linked Devices → Link a Device';
    } else if (msg.type === 'session_id') {
      currentSessionId = msg.id;
      els.sessionIdBox.textContent = msg.id;
      showStep('session');
      startCountdown(msg.expiresIn);
    } else if (msg.type === 'closed') {
      els.qrStatus.textContent = 'Connection closed — refreshing QR…';
      setTimeout(() => location.reload(), 2000);
    } else if (msg.type === 'error') {
      els.errorMsg.textContent = msg.message;
      showStep('error');
    }
  };

  ws.onerror = () => {
    els.errorMsg.textContent = 'WebSocket connection failed. Check your network and try again.';
    showStep('error');
  };

  ws.onclose = () => {
    if (!currentSessionId && !els.errorStep.classList.contains('hidden') === false) {
      // If not in session step and not in error step, show error
      if (els.qrStep.classList.contains('hidden') === false && !currentSessionId) {
        els.errorMsg.textContent = 'Connection closed. Click Try again.';
        showStep('error');
      }
    }
  };
}

function startCountdown(durationMs) {
  let remaining = Math.floor(durationMs / 1000);
  els.timer.textContent = `expires in ${Math.floor(remaining / 60)}:${String(remaining % 60).padStart(2, '0')}`;
  if (countdownInterval) clearInterval(countdownInterval);
  countdownInterval = setInterval(() => {
    remaining--;
    if (remaining <= 0) {
      clearInterval(countdownInterval);
      els.timer.textContent = 'expired';
      els.timer.style.color = 'var(--error)';
      showAlert('Session ID expired. Click "Pair another" to generate a new one.', 'error');
    } else {
      const m = Math.floor(remaining / 60);
      const s = String(remaining % 60).padStart(2, '0');
      els.timer.textContent = `expires in ${m}:${s}`;
    }
  }, 1000);
}

els.copyBtn.addEventListener('click', async () => {
  try {
    await navigator.clipboard.writeText(currentSessionId);
    els.copyBtn.querySelector('span').textContent = '✓ Copied!';
    setTimeout(() => {
      els.copyBtn.querySelector('span').textContent = '📋 Copy';
    }, 1500);
  } catch (e) {
    // Fallback: select the text
    const range = document.createRange();
    range.selectNode(els.sessionIdBox);
    window.getSelection().removeAllRanges();
    window.getSelection().addRange(range);
    document.execCommand('copy');
    showAlert('Selected text — press Cmd/Ctrl+C to copy', 'info');
  }
});

els.pairAgainBtn.addEventListener('click', () => {
  if (countdownInterval) clearInterval(countdownInterval);
  currentSessionId = '';
  if (ws) { try { ws.close(); } catch {} }
  clearAlert();
  els.timer.style.color = '';
  connect();
});

els.retryBtn.addEventListener('click', () => {
  if (ws) { try { ws.close(); } catch {} }
  clearAlert();
  connect();
});

els.refreshBtn.addEventListener('click', () => {
  if (ws) { try { ws.close(); } catch {} }
  clearAlert();
  connect();
});

// Start on load
connect();
