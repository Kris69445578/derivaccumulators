/**
 * digits.js
 * Digits Analyzer — live frequency tracker + real trade execution.
 * Contract types: DIGITMATCH, DIGITDIFF, DIGITOVER, DIGITUNDER, DIGITEVEN, DIGITODD
 */

let digitsAnalyzerInitialized = false;

const DIGIT_VOLS = [
  { symbol: '1HZ10V',  name: 'Vol 10 (1s)'  },
  { symbol: '1HZ15V',  name: 'Vol 15 (1s)'  },
  { symbol: '1HZ25V',  name: 'Vol 25 (1s)'  },
  { symbol: '1HZ30V',  name: 'Vol 30 (1s)'  },
  { symbol: '1HZ50V',  name: 'Vol 50 (1s)'  },
  { symbol: '1HZ75V',  name: 'Vol 75 (1s)'  },
  { symbol: '1HZ90V',  name: 'Vol 90 (1s)'  },
  { symbol: '1HZ100V', name: 'Vol 100 (1s)' },
  { symbol: 'R_10',    name: 'Vol 10'        },
  { symbol: 'R_25',    name: 'Vol 25'        },
  { symbol: 'R_50',    name: 'Vol 50'        },
  { symbol: 'R_75',    name: 'Vol 75'        },
  { symbol: 'R_100',   name: 'Vol 100'       },
];

const DIGIT_HIST = 1000;
const DIGIT_MIN  = 50;

/* Global trading state */
const digitTrade = {
  ws: null,
  authorized: false,
  token: '',
  balance: 0,
  currency: 'USD',
  openContracts: {},
  req_id: 0,
  pending: {},
};

let dStore = {};
let dWs = null;

function initializeDigitsAnalyzer() {
  if (digitsAnalyzerInitialized) return;
  digitsAnalyzerInitialized = true;

  function updateTime() {
    const el = document.getElementById('digits-current-time');
    if (el) el.textContent = new Date().toLocaleTimeString();
  }
  setInterval(updateTime, 1000);
  updateTime();

  function getDigit(v) {
    const s = v.toFixed(10).split('.');
    return s.length < 2 ? 0 : parseInt(s[1][1], 10);
  }

  function buildDCards() {
    const c = document.getElementById('digits-cards-container');
    if (!c) return;

    DIGIT_VOLS.forEach(v => {
      const card = document.createElement('div');
      card.className = 'vol-card';

      function rowHTML(digits) {
        return `
          <div style="display:grid;grid-template-columns:repeat(5,1fr);gap:6px;margin-bottom:2px;">
            ${digits.map(d => `
              <div id="dcell-${v.symbol}-${d}" onclick="digitSelectForTrade('${v.symbol}',${d})" style="
                border-radius:50%;width:100%;aspect-ratio:1/1;
                display:flex;flex-direction:column;align-items:center;justify-content:center;
                border:2px solid var(--border);background:var(--bg-elevated);
                transition:background 0.3s,border-color 0.3s,transform 0.2s,box-shadow 0.2s;
                cursor:pointer;position:relative;">
                <span style="font-family:var(--font-display);font-size:1rem;font-weight:800;color:var(--text-primary);line-height:1;">${d}</span>
                <span id="dpct-${v.symbol}-${d}" style="font-family:var(--font-mono);font-size:0.58rem;color:var(--text-muted);margin-top:2px;">—</span>
              </div>
            `).join('')}
          </div>
          <div style="display:grid;grid-template-columns:repeat(5,1fr);gap:6px;margin-bottom:8px;">
            ${digits.map(d => `<div id="dcsr-${v.symbol}-${d}" style="text-align:center;font-size:0.85rem;line-height:1;opacity:0;transition:opacity 0.15s,color 0.15s;">▲</div>`).join('')}
          </div>`;
      }

      card.innerHTML = `
        <div class="vol-title">
          <span>${v.name}</span>
          <span id="dp-${v.symbol}" style="font-family:var(--font-mono);font-size:0.9rem;font-weight:800;color:var(--accent);">—</span>
        </div>
        <div id="dtick-count-${v.symbol}" style="font-family:var(--font-mono);font-size:0.6rem;color:var(--text-muted);text-align:right;margin-bottom:10px;">0 / ${DIGIT_HIST} ticks</div>
        ${rowHTML([0,1,2,3,4])}
        ${rowHTML([5,6,7,8,9])}

        <!-- TRADE PANEL -->
        <div style="margin-top:10px;background:var(--bg-input);border:1px solid var(--border);border-radius:14px;padding:10px;">

          <!-- Contract type buttons -->
          <div style="display:grid;grid-template-columns:repeat(3,1fr);gap:4px;margin-bottom:8px;">
            <button class="dct-btn active" onclick="digitSetContractType('${v.symbol}','DIGITMATCH',this)" style="padding:6px 4px;border-radius:8px;background:var(--accent);border:1px solid var(--accent);color:#fff;font-family:var(--font-mono);font-size:0.62rem;font-weight:700;cursor:pointer;transition:all 0.15s;">🎯 Match</button>
            <button class="dct-btn"        onclick="digitSetContractType('${v.symbol}','DIGITDIFF',this)"  style="padding:6px 4px;border-radius:8px;background:var(--bg-elevated);border:1px solid var(--border);color:var(--text-secondary);font-family:var(--font-mono);font-size:0.62rem;font-weight:700;cursor:pointer;transition:all 0.15s;">❌ Differ</button>
            <button class="dct-btn"        onclick="digitSetContractType('${v.symbol}','DIGITOVER',this)"  style="padding:6px 4px;border-radius:8px;background:var(--bg-elevated);border:1px solid var(--border);color:var(--text-secondary);font-family:var(--font-mono);font-size:0.62rem;font-weight:700;cursor:pointer;transition:all 0.15s;">⬆️ Over</button>
            <button class="dct-btn"        onclick="digitSetContractType('${v.symbol}','DIGITUNDER',this)" style="padding:6px 4px;border-radius:8px;background:var(--bg-elevated);border:1px solid var(--border);color:var(--text-secondary);font-family:var(--font-mono);font-size:0.62rem;font-weight:700;cursor:pointer;transition:all 0.15s;">⬇️ Under</button>
            <button class="dct-btn"        onclick="digitSetContractType('${v.symbol}','DIGITEVEN',this)"  style="padding:6px 4px;border-radius:8px;background:var(--bg-elevated);border:1px solid var(--border);color:var(--text-secondary);font-family:var(--font-mono);font-size:0.62rem;font-weight:700;cursor:pointer;transition:all 0.15s;">🔵 Even</button>
            <button class="dct-btn"        onclick="digitSetContractType('${v.symbol}','DIGITODD',this)"   style="padding:6px 4px;border-radius:8px;background:var(--bg-elevated);border:1px solid var(--border);color:var(--text-secondary);font-family:var(--font-mono);font-size:0.62rem;font-weight:700;cursor:pointer;transition:all 0.15s;">🔴 Odd</button>
          </div>

          <!-- Selected digit row -->
          <div id="dsel-row-${v.symbol}" style="display:flex;align-items:center;gap:8px;margin-bottom:8px;">
            <div style="font-family:var(--font-mono);font-size:0.6rem;color:var(--text-muted);text-transform:uppercase;letter-spacing:1px;">Digit:</div>
            <div id="dsel-digit-${v.symbol}" style="width:30px;height:30px;border-radius:50%;background:var(--accent-glow);border:2px solid var(--accent);display:flex;align-items:center;justify-content:center;font-family:var(--font-display);font-size:0.95rem;font-weight:800;color:var(--accent);">0</div>
            <div style="font-family:var(--font-mono);font-size:0.58rem;color:var(--text-muted);">tap digit above to select</div>
          </div>

          <!-- Stake + Duration -->
          <div style="display:grid;grid-template-columns:1fr 1fr;gap:6px;margin-bottom:8px;">
            <div>
              <div style="font-family:var(--font-mono);font-size:0.58rem;color:var(--text-muted);text-transform:uppercase;letter-spacing:1px;margin-bottom:3px;">Stake ($)</div>
              <input type="number" id="dstake-${v.symbol}" value="1.00" min="0.35" step="0.01"
                style="width:100%;background:var(--bg-elevated);border:1px solid var(--border);color:var(--text-primary);padding:6px 8px;border-radius:8px;font-family:var(--font-mono);font-size:0.85rem;font-weight:700;outline:none;transition:border-color 0.2s;"/>
            </div>
            <div>
              <div style="font-family:var(--font-mono);font-size:0.58rem;color:var(--text-muted);text-transform:uppercase;letter-spacing:1px;margin-bottom:3px;">Duration (ticks)</div>
              <input type="number" id="ddur-${v.symbol}" value="1" min="1" max="10" step="1"
                style="width:100%;background:var(--bg-elevated);border:1px solid var(--border);color:var(--text-primary);padding:6px 8px;border-radius:8px;font-family:var(--font-mono);font-size:0.85rem;font-weight:700;outline:none;transition:border-color 0.2s;"/>
            </div>
          </div>

          <!-- Trade button -->
          <button id="dtrade-btn-${v.symbol}" onclick="digitPlaceTrade('${v.symbol}')"
            style="width:100%;padding:11px;border-radius:10px;background:linear-gradient(135deg,var(--accent),#6366f1);border:none;color:#fff;font-family:var(--font-display);font-size:0.9rem;font-weight:800;cursor:pointer;transition:all 0.2s;letter-spacing:0.3px;">
            🎯 PLACE MATCH TRADE
          </button>

          <!-- Active trade -->
          <div id="dactive-${v.symbol}" style="display:none;margin-top:8px;background:var(--accent-glow);border:1px solid var(--accent);border-radius:10px;padding:8px 10px;">
            <div style="display:flex;justify-content:space-between;align-items:center;">
              <span id="dactive-label-${v.symbol}" style="font-family:var(--font-mono);font-size:0.68rem;color:var(--accent);font-weight:700;">OPEN…</span>
              <span id="dactive-pnl-${v.symbol}" style="font-family:var(--font-display);font-size:0.9rem;font-weight:800;color:#34d399;">+$0.00</span>
            </div>
          </div>

          <!-- Result flash -->
          <div id="dresult-${v.symbol}" style="display:none;margin-top:6px;border-radius:8px;padding:7px 10px;font-family:var(--font-mono);font-size:0.75rem;text-align:center;font-weight:700;"></div>
        </div>

        <!-- Per-symbol session stats -->
        <div style="display:grid;grid-template-columns:repeat(3,1fr);gap:5px;margin-top:8px;">
          <div style="background:var(--bg-elevated);border:1px solid var(--border);border-radius:8px;padding:5px;text-align:center;">
            <div style="font-family:var(--font-mono);font-size:0.5rem;color:var(--text-muted);text-transform:uppercase;margin-bottom:1px;">Wins</div>
            <div id="dstat-wins-${v.symbol}" style="font-family:var(--font-display);font-size:0.9rem;font-weight:800;color:#34d399;">0</div>
          </div>
          <div style="background:var(--bg-elevated);border:1px solid var(--border);border-radius:8px;padding:5px;text-align:center;">
            <div style="font-family:var(--font-mono);font-size:0.5rem;color:var(--text-muted);text-transform:uppercase;margin-bottom:1px;">Losses</div>
            <div id="dstat-losses-${v.symbol}" style="font-family:var(--font-display);font-size:0.9rem;font-weight:800;color:#f87171;">0</div>
          </div>
          <div style="background:var(--bg-elevated);border:1px solid var(--border);border-radius:8px;padding:5px;text-align:center;">
            <div style="font-family:var(--font-mono);font-size:0.5rem;color:var(--text-muted);text-transform:uppercase;margin-bottom:1px;">P&L</div>
            <div id="dstat-pnl-${v.symbol}" style="font-family:var(--font-display);font-size:0.9rem;font-weight:800;color:var(--text-primary);">$0.00</div>
          </div>
        </div>
      `;

      c.appendChild(card);

      dStore[v.symbol] = {
        prices: [],
        currentDigit: null,
        contractType: 'DIGITMATCH',
        selectedDigit: 0,
        wins: 0,
        losses: 0,
        pnl: 0,
        ui: {
          price: card.querySelector('#dp-' + v.symbol),
          ticks: card.querySelector('#dtick-count-' + v.symbol),
          cells: Object.fromEntries([0,1,2,3,4,5,6,7,8,9].map(d => [d, card.querySelector('#dcell-' + v.symbol + '-' + d)])),
          pcts:  Object.fromEntries([0,1,2,3,4,5,6,7,8,9].map(d => [d, card.querySelector('#dpct-'  + v.symbol + '-' + d)])),
          csrs:  Object.fromEntries([0,1,2,3,4,5,6,7,8,9].map(d => [d, card.querySelector('#dcsr-'  + v.symbol + '-' + d)]))
        }
      };
    });
  }

  function renderDigits(sym) {
    const s = dStore[sym];
    if (!s || s.prices.length < DIGIT_MIN) return;
    const ui = s.ui;
    const counts = new Array(10).fill(0);
    s.prices.forEach(p => counts[getDigit(p)]++);
    const total = s.prices.length;

    let maxD = 0, minD = 0;
    for (let d = 1; d < 10; d++) {
      if (counts[d] > counts[maxD]) maxD = d;
      if (counts[d] < counts[minD]) minD = d;
    }

    if (ui.ticks) ui.ticks.textContent = total + ' / ' + DIGIT_HIST + ' ticks';

    for (let d = 0; d < 10; d++) {
      const pct   = (counts[d] / total * 100).toFixed(1);
      const cell  = ui.cells[d];
      const pctEl = ui.pcts[d];
      const csrEl = ui.csrs[d];
      if (!cell || !pctEl) continue;

      if (d === maxD) {
        cell.style.background = 'rgba(22,163,74,0.15)'; cell.style.borderColor = '#16a34a';
        pctEl.style.color = '#16a34a'; cell.querySelector('span').style.color = '#16a34a';
      } else if (d === minD) {
        cell.style.background = 'rgba(220,38,38,0.12)'; cell.style.borderColor = '#dc2626';
        pctEl.style.color = '#dc2626'; cell.querySelector('span').style.color = '#dc2626';
      } else {
        cell.style.background = 'var(--bg-elevated)'; cell.style.borderColor = 'var(--border)';
        pctEl.style.color = 'var(--text-muted)'; cell.querySelector('span').style.color = 'var(--text-primary)';
      }

      pctEl.textContent    = pct + '%';
      cell.style.transform = d === s.currentDigit ? 'scale(1.18)' : 'scale(1)';
      cell.style.zIndex    = d === s.currentDigit ? '2' : '0';
      cell.style.boxShadow = d === s.currentDigit ? '0 4px 16px rgba(0,0,0,0.18)' : 'none';

      if (csrEl) {
        if (d === s.currentDigit) { csrEl.style.opacity = '1'; csrEl.style.color = d === maxD ? '#16a34a' : d === minD ? '#dc2626' : 'var(--accent)'; }
        else csrEl.style.opacity = '0';
      }
    }
  }

  function connectDWs() {
    if (dWs) { dWs.onclose = null; dWs.onerror = null; try { dWs.close(); } catch (e) {} dWs = null; }
    dWs = new WebSocket('wss://ws.binaryws.com/websockets/v3?app_id=129756');

    dWs.onopen = () => {
      DIGIT_VOLS.forEach((v, i) => setTimeout(() => {
        if (dWs && dWs.readyState === WebSocket.OPEN)
          dWs.send(JSON.stringify({ ticks_history: v.symbol, count: DIGIT_HIST, end: 'latest', style: 'ticks', subscribe: 1 }));
      }, i * 160));
    };

    dWs.onmessage = e => {
      try {
        const d = JSON.parse(e.data);
        if (d.msg_type === 'history' && d.history && d.history.prices) {
          const sym   = d.echo_req && d.echo_req.ticks_history;
          const store = dStore[sym]; if (!sym || !store) return;
          store.prices = d.history.prices.map(p => parseFloat(p)).slice(-DIGIT_HIST);
          const last   = store.prices[store.prices.length - 1];
          store.currentDigit = getDigit(last);
          if (store.ui.price) store.ui.price.textContent = last.toFixed(5);
          if (store.ui.ticks) store.ui.ticks.textContent = store.prices.length + ' / ' + DIGIT_HIST + ' ticks';
          renderDigits(sym);
        }
        if (d.msg_type === 'tick') {
          const sym   = d.tick.symbol;
          const store = dStore[sym]; if (!store) return;
          const price = parseFloat(d.tick.quote);
          store.prices.push(price);
          if (store.prices.length > DIGIT_HIST) store.prices.shift();
          store.currentDigit = getDigit(price);
          if (store.ui.price) store.ui.price.textContent = price.toFixed(5);
          renderDigits(sym);
        }
      } catch (ex) {}
    };

    dWs.onclose = () => setTimeout(connectDWs, 3000);
    dWs.onerror = () => { try { dWs.close(); } catch (e) {} };
  }

  buildDCards();
  connectDWs();
}

/* ══════════════════════════════════
   TRADING ENGINE
   ══════════════════════════════════ */

function digitSetContractType(sym, ct, btn) {
  if (!dStore[sym]) return;
  dStore[sym].contractType = ct;

  /* Update button styles within this card */
  const card = btn.closest('.vol-card');
  if (card) {
    card.querySelectorAll('.dct-btn').forEach(b => {
      b.style.background  = 'var(--bg-elevated)';
      b.style.borderColor = 'var(--border)';
      b.style.color       = 'var(--text-secondary)';
    });
  }
  btn.style.background  = 'var(--accent)';
  btn.style.borderColor = 'var(--accent)';
  btn.style.color       = '#fff';

  /* Show/hide digit selector */
  const selRow   = document.getElementById('dsel-row-' + sym);
  const needsDigit = ['DIGITMATCH','DIGITDIFF','DIGITOVER','DIGITUNDER'].includes(ct);
  if (selRow) selRow.style.display = needsDigit ? 'flex' : 'none';

  /* Update trade button label */
  const labels = {
    DIGITMATCH:  '🎯 PLACE MATCH TRADE',
    DIGITDIFF:   '❌ PLACE DIFFERS TRADE',
    DIGITOVER:   '⬆️ PLACE OVER TRADE',
    DIGITUNDER:  '⬇️ PLACE UNDER TRADE',
    DIGITEVEN:   '🔵 PLACE EVEN TRADE',
    DIGITODD:    '🔴 PLACE ODD TRADE',
  };
  const tradeBtn = document.getElementById('dtrade-btn-' + sym);
  if (tradeBtn) tradeBtn.textContent = labels[ct] || '🎰 PLACE TRADE';
}

function digitSelectForTrade(sym, d) {
  if (!dStore[sym]) return;
  dStore[sym].selectedDigit = d;
  const el = document.getElementById('dsel-digit-' + sym);
  if (el) el.textContent = d;
}


/* ── Digit Token Modal ── */
function digitOpenModal() {
  var overlay = document.getElementById('digit-token-overlay');
  if (overlay) {
    overlay.style.display = 'flex';
    setTimeout(function() {
      var inp = document.getElementById('digit-trade-token');
      if (inp) inp.focus();
    }, 200);
  }
}

function digitCloseModal() {
  var overlay = document.getElementById('digit-token-overlay');
  if (overlay) overlay.style.display = 'none';
  var err = document.getElementById('digit-modal-error');
  if (err) err.textContent = '';
}

// Close on backdrop click
document.addEventListener('click', function(e) {
  var overlay = document.getElementById('digit-token-overlay');
  if (overlay && e.target === overlay) digitCloseModal();
});

function digitConnectTrading() {
  const tokenInput = document.getElementById('digit-trade-token');
  if (!tokenInput || !tokenInput.value.trim()) {
    digitToast('Enter your API token first', 'error');
    return;
  }
  const token = tokenInput.value.trim();
  digitTrade.token = token;
  if (digitTrade.ws) { try { digitTrade.ws.close(); } catch (e) {} digitTrade.ws = null; }
  digitTrade.authorized = false;

  digitTrade.ws = new WebSocket('wss://ws.binaryws.com/websockets/v3?app_id=129756');

  digitTrade.ws.onopen = () => {
    digitTrade.ws.send(JSON.stringify({ authorize: token }));
    digitToast('Connecting…', 'info');
  };

  digitTrade.ws.onmessage = e => {
    try { digitHandleMessage(JSON.parse(e.data)); } catch (ex) {}
  };

  digitTrade.ws.onclose = () => {
    digitTrade.authorized = false;
    digitUpdateConnectStatus(false);
  };

  digitTrade.ws.onerror = () => {
    try { digitTrade.ws.close(); } catch (e) {}
    digitTrade.authorized = false;
    digitUpdateConnectStatus(false);
  };
}

function digitHandleMessage(d) {

  /* Authorize */
  if (d.msg_type === 'authorize') {
    if (!d.error) {
      digitTrade.authorized = true;
      digitTrade.balance    = parseFloat(d.authorize.balance);
      digitTrade.currency   = d.authorize.currency;
      digitUpdateConnectStatus(true);
      digitToast('✅ Connected · Balance: ' + digitTrade.balance.toFixed(2) + ' ' + digitTrade.currency, 'success');
      digitCloseModal();
      digitTrade.ws.send(JSON.stringify({ balance: 1, subscribe: 1 }));
    } else {
      digitToast('Auth failed: ' + d.error.message, 'error');
      digitUpdateConnectStatus(false);
    }
    return;
  }

  /* Balance */
  if (d.msg_type === 'balance') {
    digitTrade.balance = parseFloat(d.balance.balance);
    const el = document.getElementById('digit-balance-display');
    if (el) el.textContent = digitTrade.balance.toFixed(2) + ' ' + digitTrade.currency;
    return;
  }

  /* Buy */
  if (d.msg_type === 'buy') {
    const intent = digitTrade.pending[d.req_id];
    if (!intent) return;
    delete digitTrade.pending[d.req_id];

    if (d.error) {
      digitToast('Trade error: ' + d.error.message, 'error');
      digitSetTradeBtn(intent.sym, false);
      return;
    }

    const cid = d.buy.contract_id;
    digitTrade.openContracts[cid] = Object.assign({}, intent, { openTime: Date.now() });

    const activeEl    = document.getElementById('dactive-' + intent.sym);
    const activeLabel = document.getElementById('dactive-label-' + intent.sym);
    if (activeEl)    activeEl.style.display = 'block';
    if (activeLabel) activeLabel.textContent = intent.ct + ' · $' + intent.stake.toFixed(2) + ' · ' + intent.duration + 'T';

    digitToast('Opened: ' + intent.ct + ' on ' + intent.sym, 'success');
    digitTrade.ws.send(JSON.stringify({ proposal_open_contract: 1, contract_id: cid, subscribe: 1 }));
    return;
  }

  /* Contract update */
  if (d.msg_type === 'proposal_open_contract') {
    const poc  = d.proposal_open_contract;
    const cid  = poc.contract_id;
    const info = digitTrade.openContracts[cid];
    if (!info) return;

    const profit = parseFloat(poc.profit || 0);

    const pnlEl = document.getElementById('dactive-pnl-' + info.sym);
    if (pnlEl) {
      pnlEl.textContent = (profit >= 0 ? '+' : '') + '$' + profit.toFixed(2);
      pnlEl.style.color = profit >= 0 ? '#34d399' : '#f87171';
    }

    if (!poc.is_sold) return;

    /* Settled */
    const win = profit > 0;
    const s   = dStore[info.sym];
    if (s) {
      if (win) s.wins++; else s.losses++;
      s.pnl += profit;
      digitUpdateStats(info.sym, s);
    }

    delete digitTrade.openContracts[cid];

    const activeEl = document.getElementById('dactive-' + info.sym);
    if (activeEl) activeEl.style.display = 'none';

    const resEl = document.getElementById('dresult-' + info.sym);
    if (resEl) {
      resEl.style.display    = 'block';
      resEl.style.background = win ? 'rgba(52,211,153,0.15)' : 'rgba(248,113,113,0.15)';
      resEl.style.border     = '1px solid ' + (win ? 'rgba(52,211,153,0.4)' : 'rgba(248,113,113,0.4)');
      resEl.style.color      = win ? '#34d399' : '#f87171';
      resEl.textContent      = (win ? '✅ WIN' : '❌ LOSS') + '  ·  ' + (profit >= 0 ? '+' : '') + '$' + profit.toFixed(2);
      setTimeout(function() { if (resEl) resEl.style.display = 'none'; }, 4000);
    }

    digitSetTradeBtn(info.sym, false);
    digitToast((win ? '✅ WIN' : '❌ LOSS') + ' ' + info.sym + ': ' + (profit >= 0 ? '+' : '') + '$' + profit.toFixed(2), win ? 'success' : 'error');
    return;
  }
}

function digitPlaceTrade(sym) {
  if (!digitTrade.authorized) {
    digitToast('Connect your API token in the panel at the top of this tab first', 'error');
    const panel = document.getElementById('digit-connect-panel');
    if (panel) panel.scrollIntoView({ behavior: 'smooth' });
    return;
  }

  const s = dStore[sym];
  if (!s) return;

  const alreadyOpen = Object.values(digitTrade.openContracts).some(function(c) { return c.sym === sym; });
  if (alreadyOpen) { digitToast(sym + ' already has an open trade', 'warning'); return; }

  const stake    = parseFloat(document.getElementById('dstake-' + sym).value) || 1.0;
  const duration = parseInt(document.getElementById('ddur-'   + sym).value)   || 5;
  const ct       = s.contractType || 'DIGITMATCH';
  const digit    = s.selectedDigit;

  if (stake < 0.35) { digitToast('Minimum stake is $0.35', 'error'); return; }
  if (duration < 1 || duration > 10) { digitToast('Duration must be 1–10 ticks', 'error'); return; }

  const params = {
    amount:        stake,
    basis:         'stake',
    contract_type: ct,
    currency:      digitTrade.currency,
    duration:      duration,
    duration_unit: 't',
    symbol:        sym,
  };

  if (['DIGITMATCH','DIGITDIFF','DIGITOVER','DIGITUNDER'].includes(ct)) {
    params.barrier = String(digit);
  }

  const reqId = ++digitTrade.req_id;
  digitTrade.pending[reqId] = { sym: sym, ct: ct, stake: stake, duration: duration, digit: digit };

  digitTrade.ws.send(JSON.stringify({ buy: 1, price: stake, parameters: params, req_id: reqId }));
  digitSetTradeBtn(sym, true);
  digitToast('Sending ' + ct + ' on ' + sym + '…', 'info');
}

function digitSetTradeBtn(sym, loading) {
  const btn = document.getElementById('dtrade-btn-' + sym);
  if (!btn) return;
  if (loading) {
    btn.disabled      = true;
    btn.textContent   = '⏳ WAITING FOR RESULT…';
    btn.style.opacity = '0.6';
  } else {
    btn.disabled      = false;
    btn.style.opacity = '1';
    const s = dStore[sym];
    const ct = s ? s.contractType : 'DIGITMATCH';
    var labels = { DIGITMATCH:'🎯 PLACE MATCH TRADE', DIGITDIFF:'❌ PLACE DIFFERS TRADE', DIGITOVER:'⬆️ PLACE OVER TRADE', DIGITUNDER:'⬇️ PLACE UNDER TRADE', DIGITEVEN:'🔵 PLACE EVEN TRADE', DIGITODD:'🔴 PLACE ODD TRADE' };
    btn.textContent = labels[ct] || '🎰 PLACE TRADE';
  }
}

function digitUpdateStats(sym, s) {
  var wE = document.getElementById('dstat-wins-'   + sym);
  var lE = document.getElementById('dstat-losses-' + sym);
  var pE = document.getElementById('dstat-pnl-'    + sym);
  if (wE) wE.textContent = s.wins;
  if (lE) lE.textContent = s.losses;
  if (pE) {
    pE.textContent = (s.pnl >= 0 ? '+' : '') + '$' + s.pnl.toFixed(2);
    pE.style.color = s.pnl >= 0 ? '#34d399' : '#f87171';
  }
}

function digitUpdateConnectStatus(connected) {
  /* Modal elements */
  var dot = document.getElementById('digit-conn-dot');
  var lbl = document.getElementById('digit-conn-label');
  var btn = document.getElementById('digit-conn-btn');
  var bal = document.getElementById('digit-balance-display');
  if (dot) dot.style.background = connected ? '#34d399' : '#f87171';
  if (lbl) lbl.textContent      = connected ? 'CONNECTED' : 'DISCONNECTED';
  if (btn) btn.textContent      = connected ? '🔌 Disconnect' : '🔗 Connect & Start Trading';
  if (bal) bal.textContent      = connected ? digitTrade.balance.toFixed(2) + ' ' + digitTrade.currency : '';

  /* Header mini-status */
  var hdot = document.getElementById('digit-conn-dot-header');
  var hlbl = document.getElementById('digit-conn-label-header');
  var hbtn = document.getElementById('digit-header-btn');
  if (hdot) hdot.style.background = connected ? '#34d399' : '#f87171';
  if (hlbl) hlbl.textContent = connected
    ? digitTrade.balance.toFixed(2) + ' ' + digitTrade.currency
    : 'NOT CONNECTED';
  if (hbtn) {
    hbtn.textContent = connected ? '✅ CONNECTED' : '🔗 CONNECT';
    hbtn.style.background = connected ? '#059669' : 'var(--accent)';
  }
}

function digitToast(msg, type) {
  type = type || 'info';
  if (typeof accToast === 'function') { accToast(msg, type); return; }
  var el = document.createElement('div');
  el.className   = 'acc-toast ' + type;
  el.textContent = msg;
  var container  = document.getElementById('acc-toast-container');
  if (container) { container.appendChild(el); setTimeout(function() { if (el.parentNode) el.parentNode.removeChild(el); }, 4200); }
}
