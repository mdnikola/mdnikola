/* NIKOLA Pair Site — frontend logic */

const $ = (id) => document.getElementById(id);

const els = {
  formStep:    $('formStep'),
  codeStep:    $('codeStep'),
  successStep: $('successStep'),

  form:        $('pairForm'),
  phone:       $('phone'),
  password:    $('password'),
  submitBtn:   $('submitBtn'),
  btnText:     document.querySelector('.btn-text'),
  btnSpinner:  document.querySelector('.btn-spinner'),

  alertBox:    $('alertBox'),
  pairCode:    $('pairCode'),
  codeTimer:   $('codeTimer'),
  statusBox:   $('statusBox'),
  statusText:  document.querySelector('.status-text'),

  resetBtn:    $('resetBtn'),
  doneBtn:     $('doneBtn'),
};

let statusPoll = null;
let timerInterval = null;
let currentPhone = null;

// ─── Helpers ──────────────────────────────────────────────────────────
function show(el)  { el.classList.remove('hidden'); }
function hide(el)  { el.classList.add('hidden'); }

function showAlert(type, msg) {
  els.alertBox.className = `alert alert-${type}`;
  els.alertBox.textContent = msg;
  show(els.alertBox);
}
function clearAlert() {
  els.alertBox.className = 'alert hidden';
  els.alertBox.textContent = '';
}

function setLoading(loading) {
  els.submitBtn.disabled = loading;
  if (loading) {
    hide(els.btnText);
    show(els.btnSpinner);
  } else {
    show(els.btnText);
    hide(els.btnSpinner);
  }
}

function showStep(step) {
  hide(els.formStep);
  hide(els.codeStep);
  hide(els.successStep);
  if (step === 'form')    show(els.formStep);
  if (step === 'code')    show(els.codeStep);
  if (step === 'success') show(els.successStep);
}

// ─── Pair flow ────────────────────────────────────────────────────────
els.form.addEventListener('submit', async (e) => {
  e.preventDefault();
  clearAlert();

  const phone = els.phone.value.trim();
  const password = els.password.value;

  if (!phone)    return showAlert('error', 'Please enter your phone number.');
  if (!password) return showAlert('error', 'Please enter the master password.');

  setLoading(true);

  try {
    const res = await fetch('/api/pair', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ phone, password }),
    });
    const data = await res.json();

    if (!res.ok) {
      setLoading(false);
      return showAlert('error', data.error || 'Pairing failed.');
    }

    if (data.alreadyPaired) {
      setLoading(false);
      currentPhone = phone.replace(/\D/g, '');
      showStep('success');
      return;
    }

    // Show pairing code
    els.pairCode.textContent = data.pairingCode || '--------';
    currentPhone = phone.replace(/\D/g, '');
    setLoading(false);
    showStep('code');

    // Start countdown timer (60s)
    let remaining = 60;
    els.codeTimer.textContent = `expires in ${remaining}s`;
    timerInterval = setInterval(() => {
      remaining--;
      if (remaining <= 0) {
        clearInterval(timerInterval);
        els.codeTimer.textContent = 'expired — start over';
        els.codeTimer.style.color = 'var(--error)';
        if (statusPoll) clearInterval(statusPoll);
      } else {
        els.codeTimer.textContent = `expires in ${remaining}s`;
      }
    }, 1000);

    // Poll for pairing status every 3s
    statusPoll = setInterval(pollStatus, 3000);
  } catch (err) {
    setLoading(false);
    showAlert('error', 'Network error: ' + err.message);
  }
});

async function pollStatus() {
  if (!currentPhone) return;
  try {
    const res = await fetch(`/api/status/${currentPhone}`);
    const data = await res.json();
    if (data.paired) {
      clearInterval(statusPoll);
      clearInterval(timerInterval);
      els.statusBox.classList.add('success');
      els.statusText.textContent = 'Pairing successful! Your bot is online.';
      setTimeout(() => showStep('success'), 1200);
    }
  } catch (e) { /* keep polling */ }
}

// ─── Reset / done ─────────────────────────────────────────────────────
els.resetBtn.addEventListener('click', () => {
  if (statusPoll) clearInterval(statusPoll);
  if (timerInterval) clearInterval(timerInterval);
  els.statusBox.classList.remove('success');
  els.statusText.textContent = 'Waiting for pairing to complete…';
  els.codeTimer.style.color = '';
  els.password.value = '';
  els.phone.value = '';
  clearAlert();
  showStep('form');
});

els.doneBtn.addEventListener('click', () => {
  els.statusBox.classList.remove('success');
  els.statusText.textContent = 'Waiting for pairing to complete…';
  els.codeTimer.style.color = '';
  els.password.value = '';
  els.phone.value = '';
  showStep('form');
});
