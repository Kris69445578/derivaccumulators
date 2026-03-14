/**
 * app.js — v5.0
 * Global token management, OAuth login, tab router, theme toggle
 */

/* ── Security ── */
document.addEventListener('contextmenu', e => e.preventDefault());
document.addEventListener('keydown', e => {
  if (
    (e.ctrlKey && (e.key === 'u' || e.key === 'U')) ||
    (e.ctrlKey && e.shiftKey && ['I','i','C','c','J','j'].includes(e.key)) ||
    e.key === 'F12'
  ) { e.preventDefault(); return false; }
});

/* ══════════════════════════════════════════
   GLOBAL TOKEN — shared by ALL features
   ══════════════════════════════════════════ */
const globalAuth = {
  token:      '',
  loginid:    '',
  currency:   'USD',
  balance:    0,
  is_virtual: false,
  connected:  false,
};

/**
 * Called whenever we have a token (OAuth or manual API token).
 * Pushes it to every feature, hides auth buttons, shows account bar.
 */
function globalSetToken(token, loginid, currency, balance, is_virtual) {
  globalAuth.token      = token;
  globalAuth.loginid    = loginid    || '';
  globalAuth.currency   = currency   || 'USD';
  globalAuth.balance    = balance    || 0;
  globalAuth.is_virtual = is_virtual || false;
  globalAuth.connected  = true;

  /* Push to accumulator bot config */
  const accField = document.getElementById('acc-cfg-token');
  if (accField) accField.value = token;

  /* Push to digit trader */
  const digitInp = document.getElementById('digit-trade-token');
  if (digitInp) digitInp.value = token;

  /* Auto-connect accumulator if initialized */
  if (typeof acc !== 'undefined' && !acc.connected && typeof accDoConnect === 'function') {
    accDoConnect();
  }

  /* Auto-connect digit trader if initialized */
  if (typeof digitTrade !== 'undefined' && !digitTrade.authorized && typeof digitConnectTrading === 'function') {
    digitConnectTrading();
  }

  /* Switch navbar: hide 3 buttons, show account display */
  navShowAccountDisplay();
}

function navShowAccountDisplay() {
  const authBtns = document.getElementById('nav-auth-buttons');
  const accDisp  = document.getElementById('nav-account-display');
  if (authBtns) authBtns.style.display = 'none';
  if (accDisp)  accDisp.style.display  = 'flex';
  derivUpdateNavAccountBtn();
}

function derivUpdateNavAccountBtn() {
  const flag   = document.getElementById('nav-account-flag');
  const idEl   = document.getElementById('nav-account-id');
  const balEl  = document.getElementById('nav-account-bal');
  const btn    = document.getElementById('nav-account-btn');

  if (flag)  flag.textContent  = derivGetFlag(globalAuth.currency);
  if (idEl)  idEl.textContent  = globalAuth.loginid;
  if (balEl) balEl.textContent = globalAuth.balance.toFixed(2) + ' ' + globalAuth.currency;
  if (btn)   btn.style.background = globalAuth.is_virtual ? '#7c3aed' : 'var(--accent)';
}

/* ══════════════════════════════════════════
   THEME
   ══════════════════════════════════════════ */
function toggleTheme() {
  const html   = document.documentElement;
  const isDark = html.getAttribute('data-theme') === 'dark';
  html.setAttribute('data-theme', isDark ? 'light' : 'dark');
  const lbl   = document.getElementById('menu-theme-label');
  const thumb = document.getElementById('menu-theme-thumb');
  if (lbl)   lbl.textContent       = isDark ? 'Light Mode' : 'Dark Mode';
  if (thumb) thumb.style.transform = isDark ? 'translateX(0px)' : 'translateX(18px)';
  if (typeof accDrawChart === 'function') accDrawChart();
}

/* ══════════════════════════════════════════
   TAB ROUTER
   ══════════════════════════════════════════ */
function showTab(tabId) {
  document.querySelectorAll('.tab-content').forEach(t => t.classList.remove('active'));
  document.querySelectorAll('.menu li a').forEach(a => a.classList.remove('active'));
  const tabEl = document.getElementById(tabId);
  if (tabEl) tabEl.classList.add('active');
  document.querySelectorAll('.menu li a').forEach(a => {
    if (a.getAttribute('onclick') && a.getAttribute('onclick').includes(`'${tabId}'`))
      a.classList.add('active');
  });

  if (tabId === 'generator') {
    initializeGenerator();
  }
  else if (tabId === 'digits-analyzer') {
    initializeDigitsAnalyzer();
    /* Only open token modal if no global token */
    if (!globalAuth.connected && !digitTrade.authorized) {
      setTimeout(digitOpenModal, 400);
    } else if (globalAuth.connected && !digitTrade.authorized) {
      /* Auto-connect silently using global token */
      setTimeout(() => {
        const digitInp = document.getElementById('digit-trade-token');
        if (digitInp) digitInp.value = globalAuth.token;
        if (typeof digitConnectTrading === 'function') digitConnectTrading();
      }, 300);
    }
  }
  else if (tabId === 'balance-checker') initializeBalanceChecker();
  else if (tabId === 'bot-trading')     initializeBotTrading();
  else if (tabId === 'accum-bot') {
    initAccumBot();
    /* Only open token modal if no global token */
    if (!globalAuth.connected && !acc.connected) {
      openAccModal();
    } else if (globalAuth.connected && !acc.connected) {
      /* Auto-connect silently */
      const accField = document.getElementById('acc-cfg-token');
      if (accField) accField.value = globalAuth.token;
      if (typeof accDoConnect === 'function') accDoConnect();
    }
  }
}

/* ══════════════════════════════════════════
   DOM INJECTION
   ══════════════════════════════════════════ */
function injectTabs() {
  const shell = document.getElementById('tab-shell');
  if (!shell) return;
  shell.innerHTML =
    buildMenuTab()       +
    buildGeneratorTab()  +
    buildAccumBotTab()   +
    buildBotTradingTab() +
    buildDigitsTab()     +
    buildBalanceTab();
}

/* ══════════════════════════════════════════
   EMOJI RAIN
   ══════════════════════════════════════════ */
function startEmojiRain() {
  setInterval(() => {
    const menuTab = document.getElementById('menu-tab');
    if (!menuTab || !menuTab.classList.contains('active')) return;
    const e = document.createElement('div');
    e.textContent = '💵';
    e.className   = 'falling-emoji';
    e.style.left  = Math.random() * 100 + 'vw';
    e.style.animation = `fall ${Math.random() * 5 + 5}s linear forwards`;
    document.body.appendChild(e);
    setTimeout(() => e.remove(), 6000);
  }, 500);
}

/* ══════════════════════════════════════════
   NAVBAR API TOKEN MODAL
   ══════════════════════════════════════════ */
function navTokenOpen() {
  const ov = document.getElementById('nav-token-overlay');
  if (ov) {
    ov.style.display = 'flex';
    setTimeout(() => { const i = document.getElementById('nav-token-input'); if (i) i.focus(); }, 200);
  }
}

function navTokenClose() {
  const ov  = document.getElementById('nav-token-overlay');
  const err = document.getElementById('nav-token-error');
  if (ov)  ov.style.display = 'none';
  if (err) err.textContent  = '';
}

function navTokenConnect() {
  const inp   = document.getElementById('nav-token-input');
  const errEl = document.getElementById('nav-token-error');
  const token = inp ? inp.value.trim() : '';
  if (!token || token.length < 5) {
    if (errEl) errEl.textContent = 'Please enter a valid API token';
    return;
  }

  navTokenClose();

  /* Connect via WS to get account info, then call globalSetToken */
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
        globalSetToken(
          token,
          auth.loginid,
          auth.currency,
          parseFloat(auth.balance),
          auth.is_virtual
        );
        /* Add to derivState accounts for dropdown */
        derivState.accounts = [{ loginid: auth.loginid, token, currency: auth.currency, balance: parseFloat(auth.balance), is_virtual: auth.is_virtual }];
        derivState.activeLoginid = auth.loginid;
        if (typeof accToast === 'function') accToast('Connected · ' + auth.loginid + ' · ' + parseFloat(auth.balance).toFixed(2) + ' ' + auth.currency, 'success');
      }
    } catch(ex){}
  };
  ws.onerror = () => {
    if (typeof accToast === 'function') accToast('Connection error — check token', 'error');
  };
}

document.addEventListener('click', function(e) {
  const ov = document.getElementById('nav-token-overlay');
  if (ov && e.target === ov) navTokenClose();
});

/* ══════════════════════════════════════════
   DERIV OAUTH
   ══════════════════════════════════════════ */
const derivState = {
  accounts:      [],
  activeLoginid: null,
  activeTab:     'real',
  ws:            null,
};

const DERIV_WS_URL = 'wss://ws.binaryws.com/websockets/v3?app_id=129756';

const CURRENCY_FLAGS = {
  USD:'🇺🇸', EUR:'🇪🇺', GBP:'🇬🇧', AUD:'🇦🇺',
  CAD:'🇨🇦', NZD:'🇳🇿', SGD:'🇸🇬', MYR:'🇲🇾',
  USDC:'💵', USDT:'💵', BTC:'₿', ETH:'Ξ',
};
function derivGetFlag(cur) { return CURRENCY_FLAGS[cur] || '💰'; }

function derivHandleLogin() {
  if (derivState.accounts.length > 0) {
    const panel = document.getElementById('deriv-account-panel');
    if (panel) panel.style.display = panel.style.display === 'none' ? 'block' : 'none';
  }
}

function derivClosePannel() {
  const panel = document.getElementById('deriv-account-panel');
  if (panel) panel.style.display = 'none';
}

document.addEventListener('click', function(e) {
  const panel = document.getElementById('deriv-account-panel');
  const btn   = document.getElementById('nav-account-btn');
  if (panel && panel.style.display !== 'none' && btn &&
      !panel.contains(e.target) && !btn.contains(e.target)) {
    panel.style.display = 'none';
  }
});

function derivShowTab(tab) {
  derivState.activeTab = tab;
  ['real','demo'].forEach(t => {
    const b = document.getElementById('deriv-tab-' + t);
    if (!b) return;
    const active = t === tab;
    b.style.borderBottomColor = active ? 'var(--accent)' : 'transparent';
    b.style.color             = active ? 'var(--accent)' : 'var(--text-muted)';
    b.style.fontWeight        = active ? '700' : '600';
  });
  derivRenderAccountList();
}

function derivRenderAccountList() {
  const list = document.getElementById('deriv-account-list');
  if (!list) return;
  const filtered = derivState.accounts.filter(a =>
    derivState.activeTab === 'demo' ? a.is_virtual : !a.is_virtual
  );
  if (!filtered.length) {
    list.innerHTML = '<div style="padding:14px;text-align:center;font-family:var(--font-mono);font-size:0.7rem;color:var(--text-muted);">No ' + derivState.activeTab + ' accounts found</div>';
    return;
  }
  list.innerHTML = filtered.map(a => {
    const isActive = a.loginid === derivState.activeLoginid;
    const flag = derivGetFlag(a.currency);
    const bal  = typeof a.balance === 'number' ? a.balance.toFixed(2) : '—';
    return `<div onclick="derivSelectAccount('${a.loginid}')" style="display:flex;align-items:center;gap:10px;padding:10px 14px;cursor:pointer;transition:background 0.15s;background:${isActive?'var(--accent-glow)':'transparent'};border-left:3px solid ${isActive?'var(--accent)':'transparent'};">
      <span style="font-size:1.4rem;flex-shrink:0;">${flag}</span>
      <div style="flex:1;min-width:0;">
        <div style="font-family:var(--font-display);font-size:0.85rem;font-weight:700;color:var(--text-primary);">${a.currency}</div>
        <div style="font-family:var(--font-mono);font-size:0.62rem;color:var(--text-muted);">${a.loginid}</div>
      </div>
      <div style="font-family:var(--font-display);font-size:0.9rem;font-weight:800;color:${isActive?'var(--accent)':'var(--text-primary)'};">${bal} ${a.currency}</div>
    </div>`;
  }).join('');
}

function derivSelectAccount(loginid) {
  const account = derivState.accounts.find(a => a.loginid === loginid);
  if (!account) return;
  derivState.activeLoginid = loginid;

  /* Update global token */
  globalSetToken(account.token, account.loginid, account.currency, account.balance, account.is_virtual);

  /* Re-authorize accumulator and digits with new token */
  if (typeof acc !== 'undefined' && acc.connected && typeof accDisconnect === 'function') {
    accDisconnect();
    setTimeout(() => {
      const accField = document.getElementById('acc-cfg-token');
      if (accField) accField.value = account.token;
      if (typeof accDoConnect === 'function') accDoConnect();
    }, 500);
  }
  if (typeof digitTrade !== 'undefined' && digitTrade.authorized && typeof digitConnectTrading === 'function') {
    const digitInp = document.getElementById('digit-trade-token');
    if (digitInp) digitInp.value = account.token;
    digitConnectTrading();
  }

  derivRenderAccountList();
  derivClosePannel();
  if (typeof accToast === 'function') accToast('Switched to ' + loginid + ' · ' + account.currency, 'success');
}

/* Subscribe to live balance for active account */
function derivSubscribeBalance(token) {
  if (derivState.ws) { try { derivState.ws.close(); } catch(e){} derivState.ws = null; }
  derivState.ws = new WebSocket(DERIV_WS_URL);
  derivState.ws.onopen = () => derivState.ws.send(JSON.stringify({ authorize: token }));
  derivState.ws.onmessage = e => {
    try {
      const d = JSON.parse(e.data);
      if (d.msg_type === 'authorize' && !d.error) {
        derivState.ws.send(JSON.stringify({ balance: 1, subscribe: 1 }));
      }
      if (d.msg_type === 'balance') {
        const newBal = parseFloat(d.balance.balance);
        /* Update in accounts array */
        const account = derivState.accounts.find(a => a.loginid === derivState.activeLoginid);
        if (account) account.balance = newBal;
        /* Update global */
        if (globalAuth.loginid === derivState.activeLoginid) {
          globalAuth.balance = newBal;
          derivUpdateNavAccountBtn();
        }
        derivRenderAccountList();
      }
    } catch(ex){}
  };
  derivState.ws.onclose = () => {};
  derivState.ws.onerror = () => { try { derivState.ws.close(); } catch(e){} };
}

/* Parse OAuth tokens from URL after redirect */
function derivParseOAuthCallback() {
  const params = new URLSearchParams(window.location.search);
  const accounts = [];
  let i = 1;
  while (params.has('acct' + i)) {
    accounts.push({
      loginid:    params.get('acct'  + i),
      token:      params.get('token' + i),
      currency:   params.get('cur'   + i) || 'USD',
      balance:    null,
      is_virtual: (params.get('acct' + i) || '').startsWith('VR'),
    });
    i++;
  }
  if (!accounts.length) return false;

  /* Clean URL immediately */
  window.history.replaceState({}, document.title, window.location.pathname);
  derivState.accounts = accounts;

  /* Auto-select first real account */
  const firstReal = accounts.find(a => !a.is_virtual) || accounts[0];
  derivState.activeLoginid = firstReal.loginid;

  /* Show panel */
  const panel = document.getElementById('deriv-account-panel');
  if (panel) panel.style.display = 'block';

  derivShowTab(firstReal.is_virtual ? 'demo' : 'real');

  /* Fetch balances for all accounts in parallel */
  accounts.forEach(a => {
    const ws = new WebSocket(DERIV_WS_URL);
    ws.onopen = () => ws.send(JSON.stringify({ authorize: a.token }));
    ws.onmessage = e => {
      try {
        const d = JSON.parse(e.data);
        if (d.msg_type === 'authorize' && !d.error) {
          a.balance = parseFloat(d.authorize.balance);
          /* Set global token from first real account */
          if (a.loginid === firstReal.loginid) {
            globalSetToken(a.token, a.loginid, d.authorize.currency, a.balance, a.is_virtual);
            a.currency = d.authorize.currency;
            /* Subscribe to live balance */
            derivSubscribeBalance(a.token);
          }
          derivRenderAccountList();
          ws.close();
        }
        if (d.error) ws.close();
      } catch(ex){}
    };
    ws.onerror = () => ws.close();
  });

  if (typeof accToast === 'function') accToast('Logged in · ' + accounts.length + ' account(s) found', 'success');
  return true;
}

function derivLogout() {
  derivState.accounts      = [];
  derivState.activeLoginid = null;
  globalAuth.token         = '';
  globalAuth.loginid       = '';
  globalAuth.connected     = false;

  if (derivState.ws) { try { derivState.ws.close(); } catch(e){} derivState.ws = null; }
  if (typeof acc !== 'undefined' && acc.connected && typeof accDisconnect === 'function') accDisconnect();

  /* Show auth buttons, hide account display */
  const authBtns = document.getElementById('nav-auth-buttons');
  const accDisp  = document.getElementById('nav-account-display');
  if (authBtns) authBtns.style.display = 'flex';
  if (accDisp)  accDisp.style.display  = 'none';

  derivClosePannel();
  if (typeof accToast === 'function') accToast('Logged out', 'info');
}

/* ══════════════════════════════════════════
   BOOT
   ══════════════════════════════════════════ */
window.onload = () => {
  injectTabs();
  showTab('menu-tab');
  startEmojiRain();

  /* Handle OAuth redirect */
  derivParseOAuthCallback();

  /* Sync theme thumb */
  const isDark = document.documentElement.getAttribute('data-theme') === 'dark';
  const lbl    = document.getElementById('menu-theme-label');
  const thumb  = document.getElementById('menu-theme-thumb');
  if (lbl)   lbl.textContent       = isDark ? 'Dark Mode' : 'Light Mode';
  if (thumb) thumb.style.transform = isDark ? 'translateX(18px)' : 'translateX(0px)';
};
