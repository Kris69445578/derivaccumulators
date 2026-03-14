/**
 * live-panel.js
 * Floating Live Position Panel — shown when a trade opens from HL Analysis tab.
 * Renders open trade cards and recent results.
 */

let hlPanelMinimized = false;
let hlPanelOpen      = false;
const hlPanelResults = [];

/* ── Visibility ── */
function hlPanelShow() {
  hlPanelOpen      = true;
  hlPanelMinimized = false;
  document.getElementById('hl-live-panel').classList.add('visible');
  document.getElementById('hl-live-pill').classList.remove('visible');
  hlPanelRender();
}

function hlPanelClose() {
  hlPanelOpen      = false;
  hlPanelMinimized = false;
  document.getElementById('hl-live-panel').classList.remove('visible');
  document.getElementById('hl-live-pill').classList.remove('visible');
}

function hlPanelMinimize() {
  hlPanelMinimized = true;
  document.getElementById('hl-live-panel').classList.remove('visible');
  const pill  = document.getElementById('hl-live-pill');
  pill.classList.add('visible');
  const total = [...acc.open_trades].length;
  document.getElementById('hl-pill-label').textContent =
    total > 0 ? `${total} LIVE POSITION${total > 1 ? 'S' : ''}` : 'LIVE POSITION';
}

function hlPanelRestore() {
  hlPanelMinimized = false;
  hlPanelOpen      = true;
  document.getElementById('hl-live-pill').classList.remove('visible');
  document.getElementById('hl-live-panel').classList.add('visible');
  hlPanelRender();
}

/* ── Render ── */
function hlPanelRender() {
  const body    = document.getElementById('hl-panel-body');
  if (!body) return;

  const openKeys = [...acc.open_trades];
  let html = '';

  openKeys.forEach(sym => {
    const cid  = acc.contracts_map[sym];
    const info = acc.contracts_info[cid] || {};
    const stake= info.stake || 0;
    const gr   = (accGetCfg().growth_rate * 100).toFixed(0);
    html += `
      <div class="hl-trade-card">
        <div class="hl-trade-top">
          <div class="hl-trade-sym">
            <span class="acc-spin" style="width:10px;height:10px;border-width:1.5px;"></span>
            ${sym}
          </div>
          <div class="hl-trade-pnl" id="hl-pnl-${cid}">+$0.00</div>
        </div>
        <div class="hl-trade-meta">
          <span>Stake: $${stake.toFixed(2)}</span>
          <span>GR ${gr}% · ACCU</span>
          <span>×${acc.martingale_mult.toFixed(2)}</span>
        </div>
        <div class="hl-trade-bar-wrap">
          <div class="hl-trade-bar-fill" id="hl-bar-${cid}" style="width:50%"></div>
        </div>
      </div>`;
  });

  hlPanelResults.slice(0, 4).forEach(r => {
    html += `
      <div class="hl-panel-result ${r.win ? 'win' : 'loss'}">
        <span class="hl-panel-result-icon">${r.win ? '✅' : '❌'}</span>
        <div class="hl-panel-result-info">
          <div class="hl-panel-result-sym">${r.sym}</div>
          <div class="hl-panel-result-pnl ${r.win ? 'win' : 'loss'}">${r.profit >= 0 ? '+' : ''}$${r.profit.toFixed(2)}</div>
        </div>
        <span style="font-family:var(--font-mono);font-size:0.65rem;color:var(--text-muted);">${r.time}</span>
      </div>`;
  });

  if (!openKeys.length && !hlPanelResults.length) {
    html = '<div class="hl-panel-empty">No open trades yet.<br>Click 🚀 TRADE to open one.</div>';
  }

  body.innerHTML = html;

  /* Update pill label if minimized */
  if (hlPanelMinimized) {
    const total = openKeys.length;
    document.getElementById('hl-pill-label').textContent =
      total > 0 ? `${total} LIVE POSITION${total > 1 ? 'S' : ''}` : 'LIVE POSITION';
  }
}

/* ── Add result after settlement ── */
function hlPanelAddResult(sym, profit, win) {
  hlPanelResults.unshift({ sym, profit, win, time: new Date().toLocaleTimeString() });
  if (hlPanelResults.length > 8) hlPanelResults.pop();

  if (hlPanelOpen && !hlPanelMinimized) {
    hlPanelRender();
  }

  /* If panel is closed, show pill as notification */
  if (!hlPanelOpen && !hlPanelMinimized) {
    const pill = document.getElementById('hl-live-pill');
    if (pill) {
      pill.classList.add('visible');
      document.getElementById('hl-pill-label').textContent = 'TRADE RESULT';
    }
  }
}
