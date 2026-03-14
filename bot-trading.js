/**
 * bot-trading.js
 * Higher/Lower Tool tab — loads external iframe on demand.
 */
function initializeBotTrading() {
  if (window.botTradingInit) return;
  window.botTradingInit = true;

  document.getElementById('start-trading-btn').addEventListener('click', () => {
    document.getElementById('bot-iframe').src     = 'https://antony-acc.vercel.app/';
    document.getElementById('trading-view').style.display = 'block';
    document.getElementById('status-msg').textContent     = 'Analysis started.';
  });
}
