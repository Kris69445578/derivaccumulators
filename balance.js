/**
 * balance.js
 * Balance Checker tab.
 */
function initializeBalanceChecker() {
  if (window.balanceCheckerInit) return;
  window.balanceCheckerInit = true;

  const btn = document.getElementById('check-balance-btn');
  const ti  = document.getElementById('api-token');
  const bd  = document.getElementById('balance-display');
  const em  = document.getElementById('error-message');
  const dc  = document.getElementById('debug-console');
  const tdb = document.getElementById('toggle-debug-btn');
  const cpb = document.getElementById('copy-balance-btn');
  let ws    = null;

  function log(m) { dc.style.display = 'block'; dc.textContent += m + '\n'; dc.scrollTop = dc.scrollHeight; }

  tdb.addEventListener('click', () => {
    dc.style.display = dc.style.display === 'block' ? 'none' : 'block';
    tdb.textContent  = dc.style.display === 'block' ? 'Hide Debug' : 'Debug Console';
  });

  cpb.addEventListener('click', () => {
    if (bd.textContent) navigator.clipboard.writeText(bd.textContent).then(() => alert('Copied!'));
  });

  btn.addEventListener('click', () => {
    const token = ti.value.trim();
    em.textContent = ''; bd.textContent = ''; dc.textContent = '';
    if (!token) { em.textContent = 'Token required'; return; }

    btn.disabled = true; btn.textContent = 'Checking...';
    if (ws && ws.readyState === WebSocket.OPEN) ws.close();

    ws = new WebSocket('wss://ws.binaryws.com/websockets/v3?app_id=1089');
    let auth = false;

    ws.onopen    = () => { log('Connected'); ws.send(JSON.stringify({ authorize: token })); };
    ws.onmessage = e => {
      log(e.data);
      let msg; try { msg = JSON.parse(e.data); } catch (ex) { return; }
      if (msg.error)     { em.textContent = 'Error: ' + (msg.error.message || ''); finish(); }
      if (msg.authorize) { auth = true; ws.send(JSON.stringify({ balance: 1 })); }
      if (msg.balance)   { bd.textContent = `Balance: ${msg.balance.balance} ${msg.balance.currency}`; cpb.style.display = 'block'; finish(); }
    };
    ws.onerror   = () => { em.textContent = 'WebSocket error'; finish(); };
    ws.onclose   = () => { if (!auth && !em.textContent) em.textContent = 'Connection closed'; finish(); };

    function finish() { btn.disabled = false; btn.textContent = 'Check Balance'; if (ws && ws.readyState === WebSocket.OPEN) ws.close(); }
  });
}
