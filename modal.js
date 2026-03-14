/**
 * modal.js
 * API Token modal — shown automatically when Accumulator tab opens.
 */

function openAccModal() {
  const overlay = document.getElementById('acc-token-overlay');
  overlay.classList.add('show');
  setTimeout(() => {
    const inp = document.getElementById('modal-token-input');
    if (inp) inp.focus();
  }, 300);
}

function closeAccModal() {
  document.getElementById('acc-token-overlay').classList.remove('show');
  document.getElementById('modal-error').textContent = '';
}

function toggleModalEye() {
  const inp = document.getElementById('modal-token-input');
  const btn = document.getElementById('modal-eye-btn');
  if (inp.type === 'password') { inp.type = 'text';     btn.textContent = '🙈'; }
  else                         { inp.type = 'password'; btn.textContent = '👁'; }
}

function modalDoConnect() {
  const inp   = document.getElementById('modal-token-input');
  const token = inp.value.trim();
  const errEl = document.getElementById('modal-error');
  errEl.textContent = '';

  if (!token || token.length < 5) {
    errEl.textContent = '⚠ Please enter a valid API token';
    return;
  }

  /* Copy token into bot config field, then connect */
  const cfgField = document.getElementById('acc-cfg-token');
  if (cfgField) cfgField.value = token;

  closeAccModal();
  accDoConnect();
}

/* ── Global listeners ── */
document.addEventListener('click', e => {
  const overlay = document.getElementById('acc-token-overlay');
  if (e.target === overlay) closeAccModal();
});

document.addEventListener('keydown', e => {
  const overlay = document.getElementById('acc-token-overlay');
  if (overlay && overlay.classList.contains('show')) {
    if (e.key === 'Enter')  modalDoConnect();
    if (e.key === 'Escape') closeAccModal();
  }
});
