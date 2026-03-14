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
  const flagEl = document.getElementById('nav-account-flag');
  const idEl   = document.getElementById('nav-account-id');
  const balEl  = document.getElementById('nav-account-bal');
  const btn    = document.getElementById('nav-account-btn');

  if (flagEl) flagEl.innerHTML = derivGetIcon(globalAuth.currency, globalAuth.is_virtual);
  if (idEl)   idEl.textContent  = globalAuth.loginid;
  if (balEl)  balEl.textContent = derivFormatBalance(globalAuth.balance, globalAuth.currency);
  if (btn)    btn.style.background = globalAuth.is_virtual ? '#4b5563' : 'var(--accent)';
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

  /* Connect, get account info, set global token, start live balance stream */
  var tokenWs = new WebSocket(DERIV_WS_URL);
  tokenWs.onopen = function() { tokenWs.send(JSON.stringify({ authorize: token })); };
  tokenWs.onmessage = function(e) {
    try {
      var d = JSON.parse(e.data);
      if (d.msg_type === 'authorize') {
        tokenWs.close();
        if (d.error) {
          if (typeof accToast === 'function') accToast('Token error: ' + d.error.message, 'error');
          return;
        }
        var auth = d.authorize;
        var bal  = parseFloat(auth.balance);
        var loginid   = auth.loginid;
        var currency  = auth.currency;
        var is_virtual= auth.is_virtual || loginid.startsWith('VR') || loginid.startsWith('vr');

        globalSetToken(token, loginid, currency, bal, is_virtual);

        /* Add to state for dropdown */
        derivState.accounts      = [{ loginid: loginid, token: token, currency: currency, balance: bal, is_virtual: is_virtual }];
        derivState.activeLoginid = loginid;
        derivShowTab(is_virtual ? 'demo' : 'real');

        if (typeof accToast === 'function') accToast('Connected · ' + loginid + ' · ' + bal.toFixed(2) + ' ' + currency, 'success');

        /* Start live balance stream */
        derivSubscribeBalance(token, loginid);
      }
    } catch(ex){}
  };
  tokenWs.onerror = function() {
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

/* ── Currency icons — proper SVG matching real logos ── */
function derivGetIcon(cur, is_virtual) {
  var s = 'width="24" height="24" viewBox="0 0 32 32"';

  /* Demo — teal circle with D */
  if (is_virtual) return '<svg ' + s + '><circle cx="16" cy="16" r="16" fill="#5aacaa"/><text x="16" y="21" text-anchor="middle" fill="white" font-size="16" font-weight="700" font-family="Arial,sans-serif">D</text></svg>';

  if (cur === 'USD') {
    /* US flag circle */
    return '<svg ' + s + '><clipPath id="c"><circle cx="16" cy="16" r="16"/></clipPath><g clip-path="url(#c)"><rect width="32" height="32" fill="#B22234"/><rect y="2.46" width="32" height="2.46" fill="white"/><rect y="7.38" width="32" height="2.46" fill="white"/><rect y="12.3" width="32" height="2.46" fill="white"/><rect y="17.23" width="32" height="2.46" fill="white"/><rect y="22.15" width="32" height="2.46" fill="white"/><rect y="27.08" width="32" height="2.46" fill="white"/><rect width="14" height="17.23" fill="#3C3B6E"/><g fill="white"><circle cx="2" cy="2" r="1"/><circle cx="5" cy="2" r="1"/><circle cx="8" cy="2" r="1"/><circle cx="11" cy="2" r="1"/><circle cx="2" cy="5" r="1"/><circle cx="5" cy="5" r="1"/><circle cx="8" cy="5" r="1"/><circle cx="11" cy="5" r="1"/><circle cx="3.5" cy="3.5" r="1"/><circle cx="6.5" cy="3.5" r="1"/><circle cx="9.5" cy="3.5" r="1"/><circle cx="12.5" cy="3.5" r="1"/><circle cx="2" cy="8" r="1"/><circle cx="5" cy="8" r="1"/><circle cx="8" cy="8" r="1"/><circle cx="11" cy="8" r="1"/><circle cx="2" cy="11" r="1"/><circle cx="5" cy="11" r="1"/><circle cx="8" cy="11" r="1"/><circle cx="11" cy="11" r="1"/><circle cx="3.5" cy="9.5" r="1"/><circle cx="6.5" cy="9.5" r="1"/><circle cx="9.5" cy="9.5" r="1"/><circle cx="12.5" cy="9.5" r="1"/></g></g></svg>';
  }

  if (cur === 'USDC') {
    /* USDC — blue circle with $ and arc */
    return '<svg ' + s + '><circle cx="16" cy="16" r="16" fill="#2775CA"/><text x="16" y="22" text-anchor="middle" fill="white" font-size="16" font-weight="800" font-family="Arial,sans-serif">$</text><path d="M8 10 A10 10 0 0 1 24 10" stroke="white" stroke-width="2.5" fill="none" stroke-linecap="round"/><path d="M8 22 A10 10 0 0 0 24 22" stroke="white" stroke-width="2.5" fill="none" stroke-linecap="round"/></svg>';
  }

  if (cur === 'USDT') {
    /* USDT — teal diamond with T */
    return '<svg ' + s + '><polygon points="16,1 31,9 31,23 16,31 1,23 1,9" fill="#26A17B"/><text x="16" y="22" text-anchor="middle" fill="white" font-size="17" font-weight="800" font-family="Arial,sans-serif">T</text><rect x="9" y="13" width="14" height="2.5" rx="1.25" fill="white"/></svg>';
  }

  if (cur === 'BTC') {
    /* Bitcoin — orange circle with B */
    return '<svg ' + s + '><circle cx="16" cy="16" r="16" fill="#F7931A"/><text x="17" y="22" text-anchor="middle" fill="white" font-size="17" font-weight="900" font-family="Arial,sans-serif" transform="rotate(-15,16,16)">B</text><line x1="14" y1="6" x2="14" y2="26" stroke="white" stroke-width="2.2"/><line x1="18" y1="6" x2="18" y2="26" stroke="white" stroke-width="2.2"/></svg>';
  }

  if (cur === 'ETH') {
    /* Ethereum — dark diamond shape */
    return '<svg ' + s + '><circle cx="16" cy="16" r="16" fill="#627EEA"/><polygon points="16,6 22,16 16,19.5 10,16" fill="white" opacity="0.9"/><polygon points="16,19.5 22,16 16,26 10,16" fill="white" opacity="0.6"/><polygon points="16,19.5 16,26 10,16" fill="white" opacity="0.4"/></svg>';
  }

  if (cur === 'EUR') {
    return '<svg ' + s + '><circle cx="16" cy="16" r="16" fill="#003087"/><text x="16" y="22" text-anchor="middle" fill="#FFD700" font-size="17" font-weight="800" font-family="Arial,sans-serif">€</text></svg>';
  }

  if (cur === 'GBP') {
    return '<svg ' + s + '><circle cx="16" cy="16" r="16" fill="#012169"/><text x="16" y="22" text-anchor="middle" fill="white" font-size="16" font-weight="800" font-family="Arial,sans-serif">£</text></svg>';
  }

  /* Fallback */
  return '<svg ' + s + '><circle cx="16" cy="16" r="16" fill="#374151"/><text x="16" y="21" text-anchor="middle" fill="white" font-size="13" font-weight="700" font-family="Arial,sans-serif">' + (cur||'?').charAt(0) + '</text></svg>';
}

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

function derivGetCurrencyName(cur, is_virtual) {
  if (is_virtual) return 'Demo';
  const names = { USD:'US Dollar', EUR:'Euro', GBP:'British Pound', AUD:'Australian Dollar', CAD:'Canadian Dollar', BTC:'Bitcoin', ETH:'Ethereum', USDC:'USD Coin', USDT:'Tether TRC20' };
  return names[cur] || cur;
}


function derivFormatBalance(balance, currency) {
  if (typeof balance !== 'number') return '—';
  var crypto = ['BTC','ETH','USDC','USDT'];
  if (crypto.indexOf(currency) >= 0) return balance.toFixed(8) + ' ' + currency;
  return balance.toFixed(2) + ' ' + currency;
}

function derivRenderAccountList() {
  var list = document.getElementById('deriv-account-list');
  if (!list) return;

  derivUpdatePanelHeader();

  var filtered = derivState.accounts.filter(function(a) {
    return derivState.activeTab === 'demo' ? a.is_virtual : !a.is_virtual;
  });

  if (!filtered.length) {
    list.innerHTML = '<div style="padding:16px;text-align:center;font-size:0.8rem;color:var(--text-muted);">No ' + derivState.activeTab + ' accounts found</div>';
    return;
  }

  var sectionLabel = derivState.activeTab === 'demo' ? 'Deriv account' : 'Deriv accounts';

  /* Build HTML safely — no inline event handlers with dynamic values */
  var html = '<div style="padding:10px 14px 4px;font-size:0.78rem;font-weight:600;color:var(--text-primary);">' + sectionLabel + '</div>';

  filtered.forEach(function(a) {
    var isActive = a.loginid === derivState.activeLoginid;
    var icon     = derivGetIcon(a.currency, a.is_virtual);
    var curName  = derivGetCurrencyName(a.currency, a.is_virtual);
    var balStr   = derivFormatBalance(a.balance, a.currency);
    var bg       = isActive ? 'rgba(37,99,235,0.08)' : 'transparent';
    var fw       = isActive ? '700' : '600';

    var rightSide;
    if (a.is_virtual) {
      rightSide = '<button class="deriv-reset-btn" data-loginid="' + a.loginid + '" style="padding:4px 10px;background:transparent;border:1px solid var(--border);border-radius:6px;font-size:0.72rem;color:var(--text-secondary);cursor:pointer;white-space:nowrap;font-family:var(--font-body);transition:all 0.15s;">Reset balance</button>';
    } else {
      rightSide = '<div style="font-size:0.82rem;font-weight:700;color:var(--text-primary);white-space:nowrap;">' + balStr + '</div>';
    }

    html += '<div class="deriv-acc-row" data-loginid="' + a.loginid + '" style="display:flex;align-items:center;gap:10px;padding:10px 14px;cursor:pointer;transition:background 0.15s;background:' + bg + ';">'
      + '<div style="width:32px;height:32px;flex-shrink:0;">' + icon + '</div>'
      + '<div style="flex:1;min-width:0;">'
        + '<div style="font-size:0.85rem;font-weight:' + fw + ';color:var(--text-primary);white-space:nowrap;overflow:hidden;text-overflow:ellipsis;">' + curName + '</div>'
        + '<div style="font-family:var(--font-mono);font-size:0.68rem;color:var(--text-muted);margin-top:1px;">' + a.loginid + '</div>'
      + '</div>'
      + rightSide
      + '</div>';
  });

  list.innerHTML = html;

  /* Attach click listeners safely after DOM render */
  list.querySelectorAll('.deriv-acc-row').forEach(function(row) {
    row.addEventListener('click', function() {
      derivSelectAccount(row.getAttribute('data-loginid'));
    });
  });
  list.querySelectorAll('.deriv-reset-btn').forEach(function(btn) {
    btn.addEventListener('click', function(e) {
      e.stopPropagation();
      derivResetDemoBalance(btn.getAttribute('data-loginid'));
    });
  });
}


/* Update top currency tabs (USD | KSH style) */
function derivUpdatePanelHeader() {
  const tabsEl   = document.getElementById('deriv-currency-tabs');
  const iconEl   = document.getElementById('deriv-panel-active-icon');
  const balEl    = document.getElementById('deriv-panel-active-bal');
  if (!tabsEl) return;

  /* Show one tab per real currency */
  const realAccs = derivState.accounts.filter(function(a) { return !a.is_virtual; });
  const currencies = [];
  realAccs.forEach(function(a) {
    if (!currencies.includes(a.currency)) currencies.push(a.currency);
  });

  var tabBtns = currencies.map(function(cur) {
    var isActive = cur === globalAuth.currency && !globalAuth.is_virtual;
    var bg    = isActive ? 'var(--accent)' : 'var(--bg-input)';
    var color = isActive ? '#fff' : 'var(--text-muted)';
    return '<button class="dcur-tab" data-cur="' + cur + '" style="padding:3px 10px;border-radius:6px;font-size:0.75rem;font-weight:700;cursor:pointer;border:none;transition:all 0.15s;background:' + bg + ';color:' + color + ';">' + cur + '</button>';
  }).join('');
  tabsEl.innerHTML = tabBtns;
  tabsEl.querySelectorAll('.dcur-tab').forEach(function(btn) {
    btn.addEventListener('click', function() { derivSwitchCurrency(btn.getAttribute('data-cur')); });
  });

  /* Active account balance in header */
  const active = derivState.accounts.find(function(a) { return a.loginid === derivState.activeLoginid; });
  if (active) {
    if (iconEl) iconEl.innerHTML = derivGetIcon(active.currency, active.is_virtual);
    if (balEl)  balEl.textContent = derivFormatBalance(active.balance, active.currency);
  }
}

function derivSwitchCurrency(currency) {
  const account = derivState.accounts.find(function(a) { return a.currency === currency && !a.is_virtual; });
  if (account) derivSelectAccount(account.loginid);
}

/* Reset demo balance */
function derivResetDemoBalance(loginid) {
  const account = derivState.accounts.find(function(a) { return a.loginid === loginid; });
  if (!account) return;
  const ws = new WebSocket(DERIV_WS_URL);
  ws.onopen = function() {
    ws.send(JSON.stringify({ authorize: account.token }));
  };
  ws.onmessage = function(e) {
    try {
      const d = JSON.parse(e.data);
      if (d.msg_type === 'authorize' && !d.error) {
        ws.send(JSON.stringify({ topup_virtual: 1 }));
      }
      if (d.msg_type === 'topup_virtual') {
        if (!d.error) {
          account.balance = parseFloat(d.topup_virtual.new_balance || 10000);
          derivRenderAccountList();
          if (typeof accToast === 'function') accToast('Demo balance reset to ' + account.balance.toFixed(2), 'success');
        } else {
          if (typeof accToast === 'function') accToast('Reset failed: ' + d.error.message, 'error');
        }
        ws.close();
      }
    } catch(ex){}
  };
  ws.onerror = function() { ws.close(); };
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
  derivUpdatePanelHeader();
  derivClosePannel();
  if (typeof accToast === 'function') accToast('Switched to ' + loginid + ' · ' + account.currency, 'success');
}

/* Live balance WebSocket per account — keyed by loginid */
var derivBalanceWs = {};

function derivSubscribeBalance(token, loginid, onInit) {
  /* Close any existing ws for this account */
  if (derivBalanceWs[loginid]) {
    try { derivBalanceWs[loginid].close(); } catch(e){}
    delete derivBalanceWs[loginid];
  }

  var ws = new WebSocket(DERIV_WS_URL);
  derivBalanceWs[loginid] = ws;
  var initFired = false;

  ws.onopen = function() {
    ws.send(JSON.stringify({ authorize: token }));
  };

  ws.onmessage = function(e) {
    try {
      var d = JSON.parse(e.data);

      if (d.msg_type === 'authorize' && !d.error) {
        var initialBal = parseFloat(d.authorize.balance);
        var currency   = d.authorize.currency;

        /* Fire onInit callback once with initial balance */
        if (!initFired && typeof onInit === 'function') {
          initFired = true;
          onInit(initialBal, currency);
        }

        /* Subscribe to live balance stream */
        ws.send(JSON.stringify({ balance: 1, subscribe: 1 }));
        return;
      }

      if (d.msg_type === 'balance' && !d.error) {
        var newBal  = parseFloat(d.balance.balance);
        var account = derivState.accounts.find(function(a) { return a.loginid === loginid; });
        if (account) account.balance = newBal;

        /* Always update nav button immediately when balance changes */
        if (globalAuth.loginid === loginid) {
          globalAuth.balance = newBal;
          derivUpdateNavAccountBtn();
        }

        /* Update dropdown list if it's visible */
        var panel = document.getElementById('deriv-account-panel');
        if (panel && panel.style.display !== 'none') {
          derivRenderAccountList();
        }

        console.log('[JAHIM] Balance update', loginid, newBal);
      }
    } catch(ex) { console.error('[JAHIM] Balance WS error:', ex); }
  };

  ws.onclose = function() { delete derivBalanceWs[loginid]; };
  ws.onerror = function() { try { ws.close(); } catch(ex){} };
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
      is_virtual: (params.get('acct' + i) || '').startsWith('VR') || (params.get('acct' + i) || '').startsWith('vr'),
    });
    i++;
  }
  if (!accounts.length) return false;

  /* Clean URL immediately */
  window.history.replaceState({}, document.title, window.location.pathname);
  derivState.accounts = accounts;

  /* Log for debugging */
  console.log('[JAHIM] OAuth accounts:', accounts.map(function(a){ return a.loginid + ' virtual:' + a.is_virtual; }));

  /* Auto-select first REAL account, fall back to any */
  var firstReal = accounts.find(function(a) { return !a.is_virtual; });
  if (!firstReal) firstReal = accounts[0];
  derivState.activeLoginid = firstReal.loginid;

  /* Show panel */
  var panel = document.getElementById('deriv-account-panel');
  if (panel) panel.style.display = 'block';

  /* Default to Real tab if any real accounts exist, else Demo */
  var hasReal = accounts.some(function(a) { return !a.is_virtual; });
  derivShowTab(hasReal ? 'real' : 'demo');

  /* Fetch initial balance + subscribe to live updates for ALL accounts */
  accounts.forEach(function(a) {
    derivSubscribeBalance(a.token, a.loginid, function(initialBal, currency) {
      /* Called once on first authorize */
      a.balance  = initialBal;
      a.currency = currency || a.currency;
      if (a.loginid === firstReal.loginid) {
        globalSetToken(a.token, a.loginid, a.currency, a.balance, a.is_virtual);
      }
      derivRenderAccountList();
    });
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
