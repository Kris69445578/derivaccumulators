/**
 * app.js — v6.0
 * Tab router · theme · navbar login / account dropdown · API-token (PAT) modal · boot
 * All auth + trading plumbing lives in deriv-core.js.
 */

/* ── Old behaviour kept (switch off in config.js while debugging) ── */
if (window.JAHIM_CONFIG && window.JAHIM_CONFIG.LOCK_DEVTOOLS) {
  document.addEventListener('contextmenu', function (e) { e.preventDefault(); });
  document.addEventListener('keydown', function (e) {
    if ((e.ctrlKey && (e.key === 'u' || e.key === 'U')) ||
        (e.ctrlKey && e.shiftKey && ['I', 'i', 'C', 'c', 'J', 'j'].indexOf(e.key) >= 0) ||
        e.key === 'F12') { e.preventDefault(); return false; }
  });
}

/* ══════════════════════════════════════════
   THEME
   ══════════════════════════════════════════ */
function toggleTheme() {
  const html = document.documentElement;
  const isDark = html.getAttribute('data-theme') === 'dark';
  html.setAttribute('data-theme', isDark ? 'light' : 'dark');
  syncThemeToggle();
  try { localStorage.setItem('jahim_theme', isDark ? 'light' : 'dark'); } catch (e) {}
}

function syncThemeToggle() {
  const isDark = document.documentElement.getAttribute('data-theme') === 'dark';
  const lbl = document.getElementById('menu-theme-label');
  const thumb = document.getElementById('menu-theme-thumb');
  if (lbl) lbl.textContent = isDark ? 'Dark Mode' : 'Light Mode';
  if (thumb) thumb.style.transform = isDark ? 'translateX(18px)' : 'translateX(0px)';
}

/* ══════════════════════════════════════════
   TAB ROUTER
   ══════════════════════════════════════════ */
const TABS = {
  'tab-accumulators': AccumulatorsTab,
  'tab-bot':          BotTab,
  'tab-digits':       DigitsTab,
  'tab-risefall':     RiseFallTab,
};
let currentTab = null;

function showTab(tabId) {
  if (currentTab && TABS[currentTab] && currentTab !== tabId) TABS[currentTab].hide();
  document.querySelectorAll('.tab-content').forEach(function (t) { t.classList.remove('active'); });
  document.querySelectorAll('.menu li a').forEach(function (a) {
    a.classList.toggle('active', a.getAttribute('data-tab') === tabId);
  });
  const el = document.getElementById(tabId);
  if (el) el.classList.add('active');
  currentTab = tabId;
  if (TABS[tabId]) TABS[tabId].show();
  window.scrollTo(0, 0);
}

function injectTabs() {
  const shell = document.getElementById('tab-shell');
  if (!shell) return;
  shell.innerHTML = buildMenuTab() + Object.keys(TABS).map(function (k) { return TABS[k].build(); }).join('');
}

/* ══════════════════════════════════════════
   EMOJI RAIN (menu tab only)
   ══════════════════════════════════════════ */
function startEmojiRain() {
  setInterval(function () {
    const menuTab = document.getElementById('menu-tab');
    if (!menuTab || !menuTab.classList.contains('active')) return;
    const e = document.createElement('div');
    e.textContent = '💵';
    e.className = 'falling-emoji';
    e.style.left = Math.random() * 100 + 'vw';
    e.style.animation = 'fall ' + (Math.random() * 5 + 5) + 's linear forwards';
    document.body.appendChild(e);
    setTimeout(function () { e.remove(); }, 10000);
  }, 500);
}

/* ══════════════════════════════════════════
   CURRENCY ICONS
   ══════════════════════════════════════════ */
function derivGetIcon(cur, isDemo) {
  const s = 'width="24" height="24" viewBox="0 0 32 32"';
  if (isDemo) return '<svg ' + s + '><circle cx="16" cy="16" r="16" fill="#5aacaa"/><text x="16" y="21" text-anchor="middle" fill="white" font-size="16" font-weight="700" font-family="Arial,sans-serif">D</text></svg>';
  if (cur === 'USD') return '<svg ' + s + '><circle cx="16" cy="16" r="16" fill="#2563eb"/><text x="16" y="22" text-anchor="middle" fill="white" font-size="17" font-weight="800" font-family="Arial,sans-serif">$</text></svg>';
  if (cur === 'USDC') return '<svg ' + s + '><circle cx="16" cy="16" r="16" fill="#2775CA"/><text x="16" y="22" text-anchor="middle" fill="white" font-size="16" font-weight="800" font-family="Arial,sans-serif">$</text></svg>';
  if (cur === 'USDT') return '<svg ' + s + '><polygon points="16,1 31,9 31,23 16,31 1,23 1,9" fill="#26A17B"/><text x="16" y="22" text-anchor="middle" fill="white" font-size="17" font-weight="800" font-family="Arial,sans-serif">T</text></svg>';
  if (cur === 'BTC') return '<svg ' + s + '><circle cx="16" cy="16" r="16" fill="#F7931A"/><text x="16" y="22" text-anchor="middle" fill="white" font-size="17" font-weight="900" font-family="Arial,sans-serif">₿</text></svg>';
  if (cur === 'ETH') return '<svg ' + s + '><circle cx="16" cy="16" r="16" fill="#627EEA"/><polygon points="16,6 22,16 16,19.5 10,16" fill="white" opacity="0.9"/><polygon points="16,19.5 22,16 16,26 10,16" fill="white" opacity="0.6"/></svg>';
  if (cur === 'EUR') return '<svg ' + s + '><circle cx="16" cy="16" r="16" fill="#003087"/><text x="16" y="22" text-anchor="middle" fill="#FFD700" font-size="17" font-weight="800" font-family="Arial,sans-serif">€</text></svg>';
  if (cur === 'GBP') return '<svg ' + s + '><circle cx="16" cy="16" r="16" fill="#012169"/><text x="16" y="22" text-anchor="middle" fill="white" font-size="16" font-weight="800" font-family="Arial,sans-serif">£</text></svg>';
  return '<svg ' + s + '><circle cx="16" cy="16" r="16" fill="#374151"/><text x="16" y="21" text-anchor="middle" fill="white" font-size="13" font-weight="700" font-family="Arial,sans-serif">' + UI.esc((cur || '?').charAt(0)) + '</text></svg>';
}

const CUR_NAMES = { USD: 'US Dollar', EUR: 'Euro', GBP: 'British Pound', AUD: 'Australian Dollar', BTC: 'Bitcoin', ETH: 'Ethereum', USDC: 'USD Coin', USDT: 'Tether' };

/* ══════════════════════════════════════════
   NAVBAR: login buttons / account display / dropdown
   ══════════════════════════════════════════ */
let acctTab = 'real';

function navLogin() {
  Deriv.login().catch(function (e) { UI.toast(UI.friendlyError(e), 'error'); });
}

function navRenderAuth() {
  const authed = Deriv.isAuthed();
  const out = document.getElementById('nav-auth-buttons');
  const inn = document.getElementById('nav-account-display');
  if (out) out.style.display = authed ? 'none' : 'flex';
  if (inn) inn.style.display = authed ? 'flex' : 'none';
  if (!authed) { derivClosePanel(); return; }
  const a = Deriv.active();
  const btn = document.getElementById('nav-account-btn');
  if (!a) {
    document.getElementById('nav-account-bal').textContent = 'No account';
    document.getElementById('nav-account-id').textContent = '';
    document.getElementById('nav-account-flag').innerHTML = '';
    return;
  }
  document.getElementById('nav-account-flag').innerHTML = derivGetIcon(a.currency, a.type === 'demo');
  document.getElementById('nav-account-id').textContent = a.id + (a.type === 'demo' ? ' · DEMO' : '');
  document.getElementById('nav-account-bal').textContent = Deriv.fmtMoney(a.balance, a.currency);
  btn.style.background = a.type === 'demo' ? '#4b5563' : 'var(--accent)';
}

function derivTogglePanel() {
  const panel = document.getElementById('deriv-account-panel');
  if (!panel) return;
  const open = panel.style.display !== 'block';
  panel.style.display = open ? 'block' : 'none';
  if (open) {
    const a = Deriv.active();
    if (a) acctTab = a.type;
    derivRenderList();
    Deriv.refreshAccounts();
  }
}

function derivClosePanel() {
  const panel = document.getElementById('deriv-account-panel');
  if (panel) panel.style.display = 'none';
}

function derivShowTab(tab) {
  acctTab = tab;
  derivRenderList();
}

function derivRenderList() {
  const list = document.getElementById('deriv-account-list');
  if (!list) return;
  ['real', 'demo'].forEach(function (t) {
    const b = document.getElementById('deriv-tab-' + t);
    if (b) b.classList.toggle('active', t === acctTab);
  });
  const rows = Deriv.state.accounts.filter(function (a) { return a.type === acctTab; });
  if (!rows.length) {
    list.innerHTML = '<div class="acct-none">No ' + acctTab + ' accounts found.' +
      (acctTab === 'real' ? '<br><a href="' + UI.esc(Deriv.config.DERIV_APP_URL) + '" target="_blank" rel="noopener">Open one on Deriv →</a>' : '') + '</div>';
    return;
  }
  list.innerHTML = rows.map(function (a) {
    const act = a.id === Deriv.state.activeId;
    return '<div class="acct-row' + (act ? ' active' : '') + '" data-id="' + UI.esc(a.id) + '">'
      + '<div class="acct-ico">' + derivGetIcon(a.currency, a.type === 'demo') + '</div>'
      + '<div class="acct-meta"><div class="acct-name">' + UI.esc(a.type === 'demo' ? 'Demo' : (CUR_NAMES[a.currency] || a.currency)) + '</div>'
      + '<div class="acct-sub">' + UI.esc(a.id) + (a.status === 'inactive' ? ' · inactive' : '') + '</div></div>'
      + (a.type === 'demo'
          ? '<div class="acct-right"><b>' + UI.esc(Deriv.fmt(a.balance, a.currency)) + '</b><button type="button" class="acct-reset" data-reset="' + UI.esc(a.id) + '">Reset</button></div>'
          : '<div class="acct-right"><b>' + UI.esc(Deriv.fmtMoney(a.balance, a.currency)) + '</b></div>')
      + '</div>';
  }).join('');
}

document.addEventListener('click', function (e) {
  const panel = document.getElementById('deriv-account-panel');
  if (!panel) return;

  const reset = e.target.closest && e.target.closest('[data-reset]');
  if (reset) {
    e.stopPropagation();
    reset.disabled = true;
    Deriv.resetDemoBalance(reset.getAttribute('data-reset')).then(function () {
      UI.toast('Demo balance reset', 'success'); derivRenderList();
    }).catch(function (er) { UI.toast('Reset failed: ' + UI.friendlyError(er), 'error'); reset.disabled = false; });
    return;
  }
  const row = e.target.closest && e.target.closest('.acct-row');
  if (row && panel.contains(row)) {
    const id = row.getAttribute('data-id');
    Deriv.selectAccount(id).then(function () { UI.toast('Switched to ' + id, 'success'); });
    derivClosePanel();
    return;
  }
  const btn = document.getElementById('nav-account-btn');
  if (panel.style.display === 'block' && !panel.contains(e.target) && !(btn && btn.contains(e.target))) derivClosePanel();
});

function derivLogout() {
  Deriv.logout();
  derivClosePanel();
  UI.toast('Logged out', 'info');
}

/* ══════════════════════════════════════════
   API TOKEN (Personal Access Token) MODAL
   ══════════════════════════════════════════ */
function navTokenOpen() {
  const ov = document.getElementById('nav-token-overlay');
  if (!ov) return;
  ov.style.display = 'flex';
  setTimeout(function () { const i = document.getElementById('nav-token-input'); if (i) i.focus(); }, 200);
}

function navTokenClose() {
  const ov = document.getElementById('nav-token-overlay');
  const err = document.getElementById('nav-token-error');
  if (ov) ov.style.display = 'none';
  if (err) err.textContent = '';
}

async function navTokenConnect() {
  const inp = document.getElementById('nav-token-input');
  const err = document.getElementById('nav-token-error');
  const btn = document.getElementById('nav-token-btn');
  const token = inp ? inp.value.trim() : '';
  if (token.length < 8) { err.textContent = 'Please paste a valid token'; return; }
  err.textContent = ''; btn.disabled = true; btn.textContent = 'Checking…';
  try {
    await Deriv.loginWithPat(token);
    inp.value = '';
    navTokenClose();
    UI.toast('Connected with API token', 'success');
  } catch (e) {
    err.textContent = UI.friendlyError(e);
  } finally {
    btn.disabled = false; btn.textContent = '🔗 Connect API Token';
  }
}

document.addEventListener('click', function (e) {
  const ov = document.getElementById('nav-token-overlay');
  if (ov && e.target === ov) navTokenClose();
});

/* ══════════════════════════════════════════
   MENU TAB: setup info
   ══════════════════════════════════════════ */
function fillSetupInfo() {
  const a = document.getElementById('setup-appid');
  const r = document.getElementById('setup-redirect');
  if (a) a.textContent = Deriv.config.APP_ID;
  if (r) r.textContent = Deriv.redirectUri();
}

function copyText(id) {
  const el = document.getElementById(id);
  if (!el) return;
  const t = el.textContent;
  (navigator.clipboard ? navigator.clipboard.writeText(t) : Promise.reject()).then(
    function () { UI.toast('Copied', 'success'); },
    function () { UI.toast('Copy failed — select the text and copy it manually', 'warning'); }
  );
}

/* ══════════════════════════════════════════
   BOOT
   ══════════════════════════════════════════ */
Deriv.on('auth', navRenderAuth);
Deriv.on('account', navRenderAuth);
Deriv.on('accounts', function () {
  navRenderAuth();
  const p = document.getElementById('deriv-account-panel');
  if (p && p.style.display === 'block') derivRenderList();
});
Deriv.on('balance', function () {
  navRenderAuth();
  const p = document.getElementById('deriv-account-panel');
  if (p && p.style.display === 'block') derivRenderList();
});
Deriv.on('error', function (x) {
  const m = x && x.error ? UI.friendlyError(x.error) : 'Error';
  if (x.where === 'trade-connect') UI.toast('Could not open the trading connection: ' + m, 'error');
  else if (x.where === 'login') UI.toast('Login failed: ' + m, 'error');
  else if (x.where === 'session') UI.toast(m, 'warning');
  else UI.toast(m, 'error');
});

window.onload = function () {
  try {
    const saved = localStorage.getItem('jahim_theme');
    if (saved === 'dark' || saved === 'light') document.documentElement.setAttribute('data-theme', saved);
  } catch (e) {}

  injectTabs();
  showTab('menu-tab');
  startEmojiRain();
  syncThemeToggle();
  fillSetupInfo();
  console.info('[JAHIM] OAuth redirect URI in use:', Deriv.redirectUri());

  Deriv.init().catch(function (e) { UI.toast('Startup error: ' + UI.friendlyError(e), 'error'); });

  if (typeof loaderDone === 'function') loaderDone();
};
