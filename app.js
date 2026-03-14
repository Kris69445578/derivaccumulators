/**
 * app.js
 * Application shell — tab router, theme toggle, DOM injection, boot.
 * Loaded last so all modules are available.
 */

/* ── Security: disable right-click and devtools shortcuts ── */
document.addEventListener('contextmenu', e => e.preventDefault());
document.addEventListener('keydown', e => {
  if (
    (e.ctrlKey && (e.key === 'u' || e.key === 'U')) ||
    (e.ctrlKey && e.shiftKey && ['I','i','C','c','J','j'].includes(e.key)) ||
    e.key === 'F12'
  ) {
    e.preventDefault();
    return false;
  }
});

/* ── Theme toggle ── */
function toggleTheme() {
  const html  = document.documentElement;
  const isDark= html.getAttribute('data-theme') === 'dark';
  html.setAttribute('data-theme', isDark ? 'light' : 'dark');
  document.getElementById('theme-label').textContent = isDark ? 'LIGHT' : 'DARK';
  if (typeof accDrawChart === 'function') accDrawChart();
}

/* ── Tab router ── */
function showTab(tabId) {
  document.querySelectorAll('.tab-content').forEach(t => t.classList.remove('active'));
  document.querySelectorAll('.menu li a').forEach(a => a.classList.remove('active'));

  const tabEl = document.getElementById(tabId);
  if (tabEl) tabEl.classList.add('active');

  document.querySelectorAll('.menu li a').forEach(a => {
    if (a.getAttribute('onclick') && a.getAttribute('onclick').includes(`'${tabId}'`))
      a.classList.add('active');
  });

  /* Lazy init each tab on first visit */
  if (tabId === 'generator')        initializeGenerator();
  else if (tabId === 'digits-analyzer') {
    initializeDigitsAnalyzer();
    if (!digitTrade.authorized) setTimeout(digitOpenModal, 400);
  }
  else if (tabId === 'balance-checker') initializeBalanceChecker();
  else if (tabId === 'bot-trading')     initializeBotTrading();
  else if (tabId === 'accum-bot')   { initAccumBot(); if (!acc.connected) openAccModal(); }
}

/* ── Inject all tab HTML into #tab-shell ── */
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

/* ── Falling emoji rain on Menu tab ── */
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

/* ── Boot ── */
window.onload = () => {
  injectTabs();
  showTab('menu-tab');
  startEmojiRain();
};
