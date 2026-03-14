/**
 * modal.js — v2.0
 * Accumulator token modal — skipped silently if global token already set.
 */

function openAccModal() {
  /* If global token already set, silently connect without showing modal */
  if (typeof globalAuth !== 'undefined' && globalAuth.connected && globalAuth.token) {
    const accField = document.getElementById('acc-cfg-token');
    if (accField) accField.value = globalAuth.token;
    if (typeof accDoConnect === 'function' && !acc.connected) accDoConnect();
    return;
  }
  const overlay = document.getElementById('acc-token-overlay');
  if (overlay) overlay.classList.add('show');
  setTimeout(() => {
    const inp = document.getElementById('modal-token-input');
    if (inp) inp.focus();
  }, 300);
}

function closeAccModal() {
  const overlay = document.getElementById('acc-token-overlay');
  if (overlay) overlay.classList.remove('show');
  const errEl = document.getElementById('modal-error');
  if (errEl) errEl.textContent = '';
}

function toggleModalEye() {
  const inp = document.getElementById('modal-token-input');
  const btn = document.getElementById('modal-eye-btn');
  if (!inp) return;
  if (inp.type === 'password') { inp.type = 'text';     if (btn) btn.textContent = '🙈'; }
  else                         { inp.type = 'password'; if (btn) btn.textContent = '👁'; }
}

function modalDoConnect() {
  const inp   = document.getElementById('modal-token-input');
  const token = inp ? inp.value.trim() : '';
  const errEl = document.getElementById('modal-error');
  if (errEl) errEl.textContent = '';

  if (!token || token.length < 5) {
    if (errEl) errEl.textContent = 'Please enter a valid API token';
    return;
  }

  /* Set as global token so all features can use it */
  if (typeof globalSetToken === 'function') {
    closeAccModal();
    /* Verify token first, then set global */
    const ws = new WebSocket('wss://ws.binaryws.com/websockets/v3?app_id=129756');
    ws.onopen = () => ws.send(JSON.stringify({ authorize: token }));
    ws.onmessage = e => {
      try {
        const d = JSON.parse(e.data);
        if (d.msg_type === 'authorize') {
          ws.close();
          if (d.error) {
            if (typeof accToast === 'function') accToast('Token error: ' + d.error.message, 'error');
            return;
          }
          const auth = d.authorize;
          globalSetToken(token, auth.loginid, auth.currency, parseFloat(auth.balance), auth.is_virtual);
          derivState.accounts = [{ loginid: auth.loginid, token, currency: auth.currency, balance: parseFloat(auth.balance), is_virtual: auth.is_virtual }];
          derivState.activeLoginid = auth.loginid;
        }
      } catch(ex){}
    };
    ws.onerror = () => ws.close();
  } else {
    /* Fallback: just connect accumulator directly */
    const cfgField = document.getElementById('acc-cfg-token');
    if (cfgField) cfgField.value = token;
    closeAccModal();
    if (typeof accDoConnect === 'function') accDoConnect();
  }
}

document.addEventListener('click', e => {
  const overlay = document.getElementById('acc-token-overlay');
  if (overlay && e.target === overlay) closeAccModal();
});

document.addEventListener('keydown', e => {
  const overlay = document.getElementById('acc-token-overlay');
  if (overlay && overlay.classList.contains('show')) {
    if (e.key === 'Enter')  modalDoConnect();
    if (e.key === 'Escape') closeAccModal();
  }
});
