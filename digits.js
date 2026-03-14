/**
 * digits.js — v4.0
 * Digits Analyzer + Trader with Martingale
 * Contract types: DIGITMATCH, DIGITDIFF, DIGITOVER, DIGITUNDER, DIGITEVEN, DIGITODD
 */

/* ── Constants ── */
const DIGIT_VOLS = [
  { symbol: '1HZ10V',  name: 'Volatility 10 (1s)'  },
  { symbol: '1HZ15V',  name: 'Volatility 15 (1s)'  },
  { symbol: '1HZ25V',  name: 'Volatility 25 (1s)'  },
  { symbol: '1HZ30V',  name: 'Volatility 30 (1s)'  },
  { symbol: '1HZ50V',  name: 'Volatility 50 (1s)'  },
  { symbol: '1HZ75V',  name: 'Volatility 75 (1s)'  },
  { symbol: '1HZ90V',  name: 'Volatility 90 (1s)'  },
  { symbol: '1HZ100V', name: 'Volatility 100 (1s)' },
  { symbol: 'R_10',    name: 'Volatility 10'        },
  { symbol: 'R_25',    name: 'Volatility 25'        },
  { symbol: 'R_50',    name: 'Volatility 50'        },
  { symbol: 'R_75',    name: 'Volatility 75'        },
  { symbol: 'R_100',   name: 'Volatility 100'       },
];
const DIGIT_HIST = 1000;
const DIGIT_MIN  = 50;

/* ── Global state ── */
let digitsAnalyzerInitialized = false;
let dStore = {};
let dWs    = null;

const digitTrade = {
  ws:            null,
  authorized:    false,
  token:         '',
  balance:       0,
  currency:      'USD',
  openContracts: {},
  pending:       {},
  req_id:        0,
};

/* ════════════════════════════════════════════
   INIT
   ════════════════════════════════════════════ */
function initializeDigitsAnalyzer() {
  if (digitsAnalyzerInitialized) return;
  digitsAnalyzerInitialized = true;

  /* clock */
  function updateTime() {
    var el = document.getElementById('digits-current-time');
    if (el) el.textContent = new Date().toLocaleTimeString();
  }
  setInterval(updateTime, 1000);
  updateTime();

  /* last digit = 2nd decimal place */
  function getDigit(v) {
    var s = v.toFixed(10).split('.');
    return s.length < 2 ? 0 : parseInt(s[1][1], 10);
  }

  /* ── Build cards ── */
  function buildDCards() {
    var c = document.getElementById('digits-cards-container');
    if (!c) return;

    DIGIT_VOLS.forEach(function(v) {
      var card = document.createElement('div');
      card.className = 'vol-card';

      function rowHTML(digits) {
        var cells = digits.map(function(d) {
          return '<div id="dcell-' + v.symbol + '-' + d + '" onclick="digitSelectForTrade(\'' + v.symbol + '\',' + d + ')" style="border-radius:50%;width:100%;aspect-ratio:1/1;display:flex;flex-direction:column;align-items:center;justify-content:center;border:2px solid var(--border);background:var(--bg-elevated);transition:background 0.3s,border-color 0.3s,transform 0.2s,box-shadow 0.2s;cursor:pointer;position:relative;">'
            + '<span style="font-family:var(--font-display);font-size:1rem;font-weight:800;color:var(--text-primary);line-height:1;">' + d + '</span>'
            + '<span id="dpct-' + v.symbol + '-' + d + '" style="font-family:var(--font-mono);font-size:0.58rem;color:var(--text-muted);margin-top:2px;">—</span>'
            + '</div>';
        }).join('');
        var csrs = digits.map(function(d) {
          return '<div id="dcsr-' + v.symbol + '-' + d + '" style="text-align:center;font-size:0.85rem;line-height:1;opacity:0;transition:opacity 0.15s,color 0.15s;">▲</div>';
        }).join('');
        return '<div style="display:grid;grid-template-columns:repeat(5,1fr);gap:6px;margin-bottom:2px;">' + cells + '</div>'
             + '<div style="display:grid;grid-template-columns:repeat(5,1fr);gap:6px;margin-bottom:8px;">' + csrs  + '</div>';
      }

      /* martingale dots */
      var martDots = '';
      for (var i = 0; i < 10; i++) {
        martDots += '<div id="dmart-dot-' + v.symbol + '-' + i + '" style="width:10px;height:4px;border-radius:3px;background:var(--border);transition:background 0.2s,transform 0.2s;"></div>';
      }

      card.innerHTML =
        '<div class="vol-title">'
          + '<span>' + v.name + '</span>'
          + '<span id="dp-' + v.symbol + '" style="font-family:var(--font-mono);font-size:0.9rem;font-weight:800;color:var(--accent);">—</span>'
        + '</div>'
        + '<div id="dtick-count-' + v.symbol + '" style="font-family:var(--font-mono);font-size:0.6rem;color:var(--text-muted);text-align:right;margin-bottom:10px;">0 / ' + DIGIT_HIST + ' ticks</div>'
        + rowHTML([0,1,2,3,4])
        + rowHTML([5,6,7,8,9])

        /* ── Trade panel ── */
        + '<div style="margin-top:10px;background:var(--bg-input);border:1px solid var(--border);border-radius:14px;padding:10px;">'

          /* contract type buttons */
          + '<div style="display:grid;grid-template-columns:repeat(3,1fr);gap:4px;margin-bottom:8px;">'
            + '<button class="dct-btn" id="dctbtn-' + v.symbol + '-DIGITMATCH"  onclick="digitSetContractType(\'' + v.symbol + '\',\'DIGITMATCH\',this)"  style="padding:6px 4px;border-radius:8px;background:var(--accent);border:1px solid var(--accent);color:#fff;font-family:var(--font-mono);font-size:0.62rem;font-weight:700;cursor:pointer;transition:all 0.15s;">🎯 Match</button>'
            + '<button class="dct-btn" id="dctbtn-' + v.symbol + '-DIGITDIFF"   onclick="digitSetContractType(\'' + v.symbol + '\',\'DIGITDIFF\',this)"   style="padding:6px 4px;border-radius:8px;background:var(--bg-elevated);border:1px solid var(--border);color:var(--text-secondary);font-family:var(--font-mono);font-size:0.62rem;font-weight:700;cursor:pointer;transition:all 0.15s;">❌ Differ</button>'
            + '<button class="dct-btn" id="dctbtn-' + v.symbol + '-DIGITOVER"   onclick="digitSetContractType(\'' + v.symbol + '\',\'DIGITOVER\',this)"   style="padding:6px 4px;border-radius:8px;background:var(--bg-elevated);border:1px solid var(--border);color:var(--text-secondary);font-family:var(--font-mono);font-size:0.62rem;font-weight:700;cursor:pointer;transition:all 0.15s;">⬆️ Over</button>'
            + '<button class="dct-btn" id="dctbtn-' + v.symbol + '-DIGITUNDER"  onclick="digitSetContractType(\'' + v.symbol + '\',\'DIGITUNDER\',this)"  style="padding:6px 4px;border-radius:8px;background:var(--bg-elevated);border:1px solid var(--border);color:var(--text-secondary);font-family:var(--font-mono);font-size:0.62rem;font-weight:700;cursor:pointer;transition:all 0.15s;">⬇️ Under</button>'
            + '<button class="dct-btn" id="dctbtn-' + v.symbol + '-DIGITEVEN"   onclick="digitSetContractType(\'' + v.symbol + '\',\'DIGITEVEN\',this)"   style="padding:6px 4px;border-radius:8px;background:var(--bg-elevated);border:1px solid var(--border);color:var(--text-secondary);font-family:var(--font-mono);font-size:0.62rem;font-weight:700;cursor:pointer;transition:all 0.15s;">🔵 Even</button>'
            + '<button class="dct-btn" id="dctbtn-' + v.symbol + '-DIGITODD"    onclick="digitSetContractType(\'' + v.symbol + '\',\'DIGITODD\',this)"    style="padding:6px 4px;border-radius:8px;background:var(--bg-elevated);border:1px solid var(--border);color:var(--text-secondary);font-family:var(--font-mono);font-size:0.62rem;font-weight:700;cursor:pointer;transition:all 0.15s;">🔴 Odd</button>'
          + '</div>'

          /* digit selector row */
          + '<div id="dsel-row-' + v.symbol + '" style="display:flex;align-items:center;gap:8px;margin-bottom:8px;">'
            + '<div style="font-family:var(--font-mono);font-size:0.6rem;color:var(--text-muted);text-transform:uppercase;letter-spacing:1px;">Digit:</div>'
            + '<div id="dsel-digit-' + v.symbol + '" style="width:30px;height:30px;border-radius:50%;background:var(--accent-glow);border:2px solid var(--accent);display:flex;align-items:center;justify-content:center;font-family:var(--font-display);font-size:0.95rem;font-weight:800;color:var(--accent);">0</div>'
            + '<div style="font-family:var(--font-mono);font-size:0.58rem;color:var(--text-muted);">tap digit above to select</div>'
          + '</div>'

          /* stake + duration */
          + '<div style="display:grid;grid-template-columns:1fr 1fr;gap:6px;margin-bottom:8px;">'
            + '<div>'
              + '<div style="font-family:var(--font-mono);font-size:0.58rem;color:var(--text-muted);text-transform:uppercase;letter-spacing:1px;margin-bottom:3px;">Stake ($)</div>'
              + '<input type="number" id="dstake-' + v.symbol + '" value="1.00" min="0.35" step="0.01" style="width:100%;background:var(--bg-elevated);border:1px solid var(--border);color:var(--text-primary);padding:6px 8px;border-radius:8px;font-family:var(--font-mono);font-size:0.85rem;font-weight:700;outline:none;transition:border-color 0.2s;"/>'
            + '</div>'
            + '<div>'
              + '<div style="font-family:var(--font-mono);font-size:0.58rem;color:var(--text-muted);text-transform:uppercase;letter-spacing:1px;margin-bottom:3px;">Duration (ticks)</div>'
              + '<input type="number" id="ddur-' + v.symbol + '" value="1" min="1" max="10" step="1" style="width:100%;background:var(--bg-elevated);border:1px solid var(--border);color:var(--text-primary);padding:6px 8px;border-radius:8px;font-family:var(--font-mono);font-size:0.85rem;font-weight:700;outline:none;transition:border-color 0.2s;"/>'
            + '</div>'
          + '</div>'

          /* martingale panel */
          + '<div style="background:var(--bg-elevated);border:1px solid var(--border);border-radius:10px;padding:8px 10px;margin-bottom:8px;">'
            + '<div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:6px;">'
              + '<div style="font-family:var(--font-mono);font-size:0.58rem;color:var(--text-muted);text-transform:uppercase;letter-spacing:1px;">Martingale on Loss</div>'
              + '<div id="dmart-toggle-' + v.symbol + '" onclick="digitToggleMart(\'' + v.symbol + '\')" data-on="1" style="width:32px;height:17px;border-radius:17px;background:var(--accent);cursor:pointer;position:relative;transition:background 0.2s;flex-shrink:0;">'
                + '<div id="dmart-thumb-' + v.symbol + '" style="position:absolute;width:11px;height:11px;background:#fff;border-radius:50%;top:3px;left:3px;transition:transform 0.2s;transform:translateX(14px);"></div>'
              + '</div>'
            + '</div>'
            + '<div style="display:grid;grid-template-columns:1fr 1fr;gap:6px;" id="dmart-fields-' + v.symbol + '">'
              + '<div>'
                + '<div style="font-family:var(--font-mono);font-size:0.55rem;color:var(--text-muted);text-transform:uppercase;letter-spacing:1px;margin-bottom:3px;">Multiplier (x)</div>'
                + '<input type="number" id="dmart-mult-' + v.symbol + '" value="2.0" min="1.1" max="10" step="0.1" style="width:100%;background:var(--bg-input);border:1px solid var(--border);color:var(--text-primary);padding:5px 8px;border-radius:7px;font-family:var(--font-mono);font-size:0.82rem;font-weight:700;outline:none;"/>'
              + '</div>'
              + '<div>'
                + '<div style="font-family:var(--font-mono);font-size:0.55rem;color:var(--text-muted);text-transform:uppercase;letter-spacing:1px;margin-bottom:3px;">Max Steps</div>'
                + '<input type="number" id="dmart-maxsteps-' + v.symbol + '" value="4" min="1" max="10" step="1" style="width:100%;background:var(--bg-input);border:1px solid var(--border);color:var(--text-primary);padding:5px 8px;border-radius:7px;font-family:var(--font-mono);font-size:0.82rem;font-weight:700;outline:none;"/>'
              + '</div>'
            + '</div>'
            + '<div style="display:flex;gap:3px;margin-top:6px;align-items:center;">'
              + '<div style="font-family:var(--font-mono);font-size:0.55rem;color:var(--text-muted);margin-right:4px;">Step:</div>'
              + '<div style="display:flex;gap:3px;">' + martDots + '</div>'
              + '<div id="dmart-curstake-' + v.symbol + '" style="font-family:var(--font-mono);font-size:0.6rem;color:var(--accent);margin-left:6px;font-weight:700;"></div>'
            + '</div>'
          + '</div>'

          /* trade button */
          + '<button id="dtrade-btn-' + v.symbol + '" onclick="digitPlaceTrade(\'' + v.symbol + '\')" style="width:100%;padding:11px;border-radius:10px;background:linear-gradient(135deg,var(--accent),#6366f1);border:none;color:#fff;font-family:var(--font-display);font-size:0.9rem;font-weight:800;cursor:pointer;transition:all 0.2s;letter-spacing:0.3px;">PLACE MATCH 0 TRADE</button>'

          /* active trade */
          + '<div id="dactive-' + v.symbol + '" style="display:none;margin-top:8px;background:var(--accent-glow);border:1px solid var(--accent);border-radius:10px;padding:8px 10px;">'
            + '<div style="display:flex;justify-content:space-between;align-items:center;">'
              + '<span id="dactive-label-' + v.symbol + '" style="font-family:var(--font-mono);font-size:0.68rem;color:var(--accent);font-weight:700;">OPEN…</span>'
              + '<span id="dactive-pnl-' + v.symbol + '" style="font-family:var(--font-display);font-size:0.9rem;font-weight:800;color:#34d399;">+$0.00</span>'
            + '</div>'
          + '</div>'

          /* result flash */
          + '<div id="dresult-' + v.symbol + '" style="display:none;margin-top:6px;border-radius:8px;padding:7px 10px;font-family:var(--font-mono);font-size:0.75rem;text-align:center;font-weight:700;"></div>'
        + '</div>'

        /* session stats */
        + '<div style="display:grid;grid-template-columns:repeat(3,1fr);gap:5px;margin-top:8px;">'
          + '<div style="background:var(--bg-elevated);border:1px solid var(--border);border-radius:8px;padding:5px;text-align:center;"><div style="font-family:var(--font-mono);font-size:0.5rem;color:var(--text-muted);text-transform:uppercase;margin-bottom:1px;">Wins</div><div id="dstat-wins-' + v.symbol + '" style="font-family:var(--font-display);font-size:0.9rem;font-weight:800;color:#34d399;">0</div></div>'
          + '<div style="background:var(--bg-elevated);border:1px solid var(--border);border-radius:8px;padding:5px;text-align:center;"><div style="font-family:var(--font-mono);font-size:0.5rem;color:var(--text-muted);text-transform:uppercase;margin-bottom:1px;">Losses</div><div id="dstat-losses-' + v.symbol + '" style="font-family:var(--font-display);font-size:0.9rem;font-weight:800;color:#f87171;">0</div></div>'
          + '<div style="background:var(--bg-elevated);border:1px solid var(--border);border-radius:8px;padding:5px;text-align:center;"><div style="font-family:var(--font-mono);font-size:0.5rem;color:var(--text-muted);text-transform:uppercase;margin-bottom:1px;">P&L</div><div id="dstat-pnl-' + v.symbol + '" style="font-family:var(--font-display);font-size:0.9rem;font-weight:800;color:var(--text-primary);">$0.00</div></div>'
        + '</div>';

      c.appendChild(card);

      dStore[v.symbol] = {
        prices:        [],
        currentDigit:  null,
        contractType:  'DIGITMATCH',
        selectedDigit: 0,
        wins:          0,
        losses:        0,
        pnl:           0,
        martStep:      0,
        baseStake:     1.0,
        ui: {
          price: card.querySelector('#dp-' + v.symbol),
          ticks: card.querySelector('#dtick-count-' + v.symbol),
          cells: (function() {
            var o = {};
            [0,1,2,3,4,5,6,7,8,9].forEach(function(d) { o[d] = card.querySelector('#dcell-' + v.symbol + '-' + d); });
            return o;
          }()),
          pcts: (function() {
            var o = {};
            [0,1,2,3,4,5,6,7,8,9].forEach(function(d) { o[d] = card.querySelector('#dpct-' + v.symbol + '-' + d); });
            return o;
          }()),
          csrs: (function() {
            var o = {};
            [0,1,2,3,4,5,6,7,8,9].forEach(function(d) { o[d] = card.querySelector('#dcsr-' + v.symbol + '-' + d); });
            return o;
          }()),
        },
      };
    });
  }

  /* ── Render digit frequencies ── */
  function renderDigits(sym) {
    var s = dStore[sym];
    if (!s || s.prices.length < DIGIT_MIN) return;
    var ui     = s.ui;
    var counts = new Array(10).fill(0);
    s.prices.forEach(function(p) { counts[getDigit(p)]++; });
    var total  = s.prices.length;
    var maxD   = 0, minD = 0;
    for (var d2 = 1; d2 < 10; d2++) {
      if (counts[d2] > counts[maxD]) maxD = d2;
      if (counts[d2] < counts[minD]) minD = d2;
    }
    if (ui.ticks) ui.ticks.textContent = total + ' / ' + DIGIT_HIST + ' ticks';
    for (var d = 0; d < 10; d++) {
      var pct   = (counts[d] / total * 100).toFixed(1);
      var cell  = ui.cells[d];
      var pctEl = ui.pcts[d];
      var csrEl = ui.csrs[d];
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
        csrEl.style.opacity = d === s.currentDigit ? '1' : '0';
        if (d === s.currentDigit) csrEl.style.color = d === maxD ? '#16a34a' : d === minD ? '#dc2626' : 'var(--accent)';
      }
    }
  }

  /* ── Data WebSocket (ticks feed) ── */
  function connectDWs() {
    if (dWs) { dWs.onclose = null; dWs.onerror = null; try { dWs.close(); } catch (e) {} dWs = null; }
    dWs = new WebSocket('wss://ws.binaryws.com/websockets/v3?app_id=129756');
    dWs.onopen = function() {
      DIGIT_VOLS.forEach(function(v, i) {
        setTimeout(function() {
          if (dWs && dWs.readyState === WebSocket.OPEN)
            dWs.send(JSON.stringify({ ticks_history: v.symbol, count: DIGIT_HIST, end: 'latest', style: 'ticks', subscribe: 1 }));
        }, i * 160);
      });
    };
    dWs.onmessage = function(e) {
      try {
        var d = JSON.parse(e.data);
        if (d.msg_type === 'history' && d.history && d.history.prices) {
          var sym   = d.echo_req && d.echo_req.ticks_history;
          var store = dStore[sym]; if (!sym || !store) return;
          store.prices = d.history.prices.map(function(p) { return parseFloat(p); }).slice(-DIGIT_HIST);
          var last = store.prices[store.prices.length - 1];
          store.currentDigit = getDigit(last);
          if (store.ui.price) store.ui.price.textContent = last.toFixed(5);
          if (store.ui.ticks) store.ui.ticks.textContent = store.prices.length + ' / ' + DIGIT_HIST + ' ticks';
          renderDigits(sym);
        }
        if (d.msg_type === 'tick') {
          var sym2  = d.tick.symbol;
          var store2= dStore[sym2]; if (!store2) return;
          var price = parseFloat(d.tick.quote);
          store2.prices.push(price);
          if (store2.prices.length > DIGIT_HIST) store2.prices.shift();
          store2.currentDigit = getDigit(price);
          if (store2.ui.price) store2.ui.price.textContent = price.toFixed(5);
          renderDigits(sym2);
        }
      } catch (ex) {}
    };
    dWs.onclose = function() { setTimeout(connectDWs, 3000); };
    dWs.onerror = function() { try { dWs.close(); } catch (e) {} };
  }

  buildDCards();
  connectDWs();
}

/* ════════════════════════════════════════════
   DIGIT TOKEN MODAL
   ════════════════════════════════════════════ */
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

document.addEventListener('click', function(e) {
  var overlay = document.getElementById('digit-token-overlay');
  if (overlay && e.target === overlay) digitCloseModal();
});

/* ════════════════════════════════════════════
   TRADING WebSocket
   ════════════════════════════════════════════ */
function digitConnectTrading() {
  var tokenInput = document.getElementById('digit-trade-token');
  var errEl      = document.getElementById('digit-modal-error');
  if (!tokenInput || !tokenInput.value.trim()) {
    if (errEl) errEl.textContent = 'Please enter your API token';
    digitToast('Enter your API token first', 'error');
    return;
  }
  var token = tokenInput.value.trim();
  digitTrade.token = token;
  if (digitTrade.ws) { try { digitTrade.ws.close(); } catch (e) {} digitTrade.ws = null; }
  digitTrade.authorized = false;

  var connBtn = document.getElementById('digit-conn-btn');
  if (connBtn) { connBtn.textContent = '⏳ Connecting…'; connBtn.disabled = true; }

  digitTrade.ws = new WebSocket('wss://ws.binaryws.com/websockets/v3?app_id=129756');

  digitTrade.ws.onopen = function() {
    digitTrade.ws.send(JSON.stringify({ authorize: token }));
  };
  digitTrade.ws.onmessage = function(e) {
    try { digitHandleMessage(JSON.parse(e.data)); } catch (ex) {}
  };
  digitTrade.ws.onclose = function() {
    digitTrade.authorized = false;
    digitUpdateConnectStatus(false);
  };
  digitTrade.ws.onerror = function() {
    try { digitTrade.ws.close(); } catch (e) {}
    digitTrade.authorized = false;
    digitUpdateConnectStatus(false);
  };
}

function digitHandleMessage(d) {

  /* ── Authorize ── */
  if (d.msg_type === 'authorize') {
    var errEl  = document.getElementById('digit-modal-error');
    var connBtn= document.getElementById('digit-conn-btn');
    if (connBtn) { connBtn.disabled = false; }
    if (!d.error) {
      digitTrade.authorized = true;
      digitTrade.balance    = parseFloat(d.authorize.balance);
      digitTrade.currency   = d.authorize.currency;
      digitUpdateConnectStatus(true);
      digitToast('Connected · Balance: ' + digitTrade.balance.toFixed(2) + ' ' + digitTrade.currency, 'success');
      digitCloseModal();
      digitTrade.ws.send(JSON.stringify({ balance: 1, subscribe: 1 }));
    } else {
      if (errEl) errEl.textContent = 'Auth failed: ' + d.error.message;
      digitToast('Auth failed: ' + d.error.message, 'error');
      digitUpdateConnectStatus(false);
    }
    return;
  }

  /* ── Balance ── */
  if (d.msg_type === 'balance') {
    digitTrade.balance = parseFloat(d.balance.balance);
    var bal = document.getElementById('digit-balance-display');
    if (bal) bal.textContent = digitTrade.balance.toFixed(2) + ' ' + digitTrade.currency;
    return;
  }

  /* ── Buy confirmed ── */
  if (d.msg_type === 'buy') {
    var intent = digitTrade.pending[d.req_id];
    if (!intent) return;
    delete digitTrade.pending[d.req_id];
    if (d.error) {
      digitToast('Trade error: ' + d.error.message, 'error');
      digitSetTradeBtn(intent.sym, false);
      return;
    }
    var cid = d.buy.contract_id;
    digitTrade.openContracts[cid] = Object.assign({}, intent, { openTime: Date.now() });
    var activeEl    = document.getElementById('dactive-' + intent.sym);
    var activeLabel = document.getElementById('dactive-label-' + intent.sym);
    if (activeEl)    activeEl.style.display = 'block';
    if (activeLabel) activeLabel.textContent = intent.ct + ' · $' + intent.stake.toFixed(2) + ' · ' + intent.duration + 'T';
    digitToast('Opened: ' + intent.ct + ' on ' + intent.sym, 'success');
    digitTrade.ws.send(JSON.stringify({ proposal_open_contract: 1, contract_id: cid, subscribe: 1 }));
    return;
  }

  /* ── Contract update ── */
  if (d.msg_type === 'proposal_open_contract') {
    var poc  = d.proposal_open_contract;
    var cid2 = poc.contract_id;
    var info = digitTrade.openContracts[cid2];
    if (!info) return;

    var profit = parseFloat(poc.profit || 0);
    var pnlEl  = document.getElementById('dactive-pnl-' + info.sym);
    if (pnlEl) {
      pnlEl.textContent = (profit >= 0 ? '+' : '') + '$' + profit.toFixed(2);
      pnlEl.style.color = profit >= 0 ? '#34d399' : '#f87171';
    }
    if (!poc.is_sold) return;

    /* settled */
    var win = profit > 0;
    var s   = dStore[info.sym];
    if (s) {
      if (win) { s.wins++;   digitResetMart(info.sym); }
      else     { s.losses++; digitApplyMart(info.sym); }
      s.pnl += profit;
      digitUpdateStats(info.sym, s);
    }
    delete digitTrade.openContracts[cid2];

    var activeEl2 = document.getElementById('dactive-' + info.sym);
    if (activeEl2) activeEl2.style.display = 'none';

    var resEl = document.getElementById('dresult-' + info.sym);
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

/* ════════════════════════════════════════════
   PLACE TRADE
   ════════════════════════════════════════════ */
function digitPlaceTrade(sym) {
  if (!digitTrade.authorized) {
    digitToast('Connect your API token first', 'error');
    digitOpenModal();
    return;
  }

  var s = dStore[sym];
  if (!s) return;

  var alreadyOpen = Object.values(digitTrade.openContracts).some(function(c) { return c.sym === sym; });
  if (alreadyOpen) { digitToast(sym + ' already has an open trade', 'warning'); return; }

  var stakeInput = document.getElementById('dstake-' + sym);
  var durInput   = document.getElementById('ddur-'   + sym);
  var stake      = parseFloat(stakeInput ? stakeInput.value : '1') || 1.0;
  var duration   = parseInt(durInput   ? durInput.value   : '1') || 1;
  var ct         = s.contractType  || 'DIGITMATCH';
  var digit      = s.selectedDigit || 0;

  /* save base stake on step 0 */
  if (s.martStep === 0) s.baseStake = stake;

  if (stake    < 0.35) { digitToast('Minimum stake is $0.35', 'error'); return; }
  if (duration < 1 || duration > 10) { digitToast('Duration must be 1-10 ticks', 'error'); return; }

  var params = {
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

  var reqId = ++digitTrade.req_id;
  digitTrade.pending[reqId] = { sym: sym, ct: ct, stake: stake, duration: duration, digit: digit };
  digitTrade.ws.send(JSON.stringify({ buy: 1, price: stake, parameters: params, req_id: reqId }));
  digitSetTradeBtn(sym, true);
  digitToast('Sending ' + ct + ' on ' + sym + '...', 'info');
}

/* ════════════════════════════════════════════
   MARTINGALE
   ════════════════════════════════════════════ */
function digitToggleMart(sym) {
  var toggle = document.getElementById('dmart-toggle-' + sym);
  var thumb  = document.getElementById('dmart-thumb-'  + sym);
  var fields = document.getElementById('dmart-fields-' + sym);
  if (!toggle) return;
  var on    = toggle.getAttribute('data-on') === '1';
  var nowOn = !on;
  toggle.setAttribute('data-on', nowOn ? '1' : '0');
  toggle.style.background = nowOn ? 'var(--accent)' : 'var(--border)';
  if (thumb)  thumb.style.transform = nowOn ? 'translateX(14px)' : 'translateX(0)';
  if (fields) fields.style.opacity  = nowOn ? '1' : '0.4';
}

function digitGetMartEnabled(sym) {
  var toggle = document.getElementById('dmart-toggle-' + sym);
  return toggle ? toggle.getAttribute('data-on') === '1' : false;
}

function digitResetMart(sym) {
  var s = dStore[sym]; if (!s) return;
  s.martStep = 0;
  var stakeInput = document.getElementById('dstake-' + sym);
  if (stakeInput) stakeInput.value = s.baseStake.toFixed(2);
  digitUpdateMartUI(sym);
}

function digitApplyMart(sym) {
  var s = dStore[sym]; if (!s) return;
  if (!digitGetMartEnabled(sym)) return;

  var multEl   = document.getElementById('dmart-mult-'     + sym);
  var maxStEl  = document.getElementById('dmart-maxsteps-' + sym);
  var mult     = parseFloat(multEl  ? multEl.value  : '2') || 2.0;
  var maxSteps = parseInt(  maxStEl ? maxStEl.value : '4') || 4;

  s.martStep++;

  if (s.martStep > maxSteps) {
    digitToast('Max martingale steps on ' + sym + ' — resetting', 'warning');
    digitResetMart(sym);
    return;
  }

  var newStake = parseFloat((s.baseStake * Math.pow(mult, s.martStep)).toFixed(2));
  if (newStake < 0.35) newStake = 0.35;

  var stakeInput = document.getElementById('dstake-' + sym);
  if (stakeInput) stakeInput.value = newStake.toFixed(2);

  digitUpdateMartUI(sym);
  digitToast('Martingale step ' + s.martStep + ' on ' + sym + ' → $' + newStake.toFixed(2), 'warning');
}

function digitUpdateMartUI(sym) {
  var s = dStore[sym]; if (!s) return;
  var maxStEl  = document.getElementById('dmart-maxsteps-' + sym);
  var maxSteps = parseInt(maxStEl ? maxStEl.value : '4') || 4;
  var stakeEl  = document.getElementById('dstake-' + sym);
  var curStake = stakeEl ? parseFloat(stakeEl.value) : s.baseStake;
  var labelEl  = document.getElementById('dmart-curstake-' + sym);
  if (labelEl) labelEl.textContent = s.martStep > 0 ? ('x' + s.martStep + ' · $' + curStake.toFixed(2)) : '';
  for (var i = 0; i < 10; i++) {
    var dot = document.getElementById('dmart-dot-' + sym + '-' + i);
    if (!dot) continue;
    if (i < s.martStep) {
      dot.style.background = s.martStep >= maxSteps ? '#f87171' : '#fbbf24';
      dot.style.transform  = 'scaleY(1.8)';
    } else {
      dot.style.background = 'var(--border)';
      dot.style.transform  = 'scaleY(1)';
    }
  }
}

/* ════════════════════════════════════════════
   UI HELPERS
   ════════════════════════════════════════════ */
function digitGetTradeLabel(sym) {
  var s      = dStore[sym];
  var ct     = s ? s.contractType  : 'DIGITMATCH';
  var digit  = s ? s.selectedDigit : 0;
  var ctNames = {
    DIGITMATCH:  'MATCH',
    DIGITDIFF:   'DIFFERS',
    DIGITOVER:   'OVER',
    DIGITUNDER:  'UNDER',
    DIGITEVEN:   'EVEN',
    DIGITODD:    'ODD',
  };
  var ctName = ctNames[ct] || ct;
  /* Even and Odd don't need a digit */
  if (ct === 'DIGITEVEN' || ct === 'DIGITODD') {
    return 'PLACE ' + ctName + ' TRADE';
  }
  return 'PLACE ' + ctName + ' ' + digit + ' TRADE';
}

function digitSetContractType(sym, ct, btn) {
  if (!dStore[sym]) return;
  dStore[sym].contractType = ct;
  var card = btn.closest('.vol-card');
  if (card) {
    card.querySelectorAll('.dct-btn').forEach(function(b) {
      b.style.background  = 'var(--bg-elevated)';
      b.style.borderColor = 'var(--border)';
      b.style.color       = 'var(--text-secondary)';
    });
  }
  btn.style.background  = 'var(--accent)';
  btn.style.borderColor = 'var(--accent)';
  btn.style.color       = '#fff';
  var selRow = document.getElementById('dsel-row-' + sym);
  if (selRow) selRow.style.display = ['DIGITMATCH','DIGITDIFF','DIGITOVER','DIGITUNDER'].includes(ct) ? 'flex' : 'none';
  var tradeBtn = document.getElementById('dtrade-btn-' + sym);
  if (tradeBtn) tradeBtn.textContent = digitGetTradeLabel(sym);
}

function digitSelectForTrade(sym, d) {
  if (!dStore[sym]) return;
  dStore[sym].selectedDigit = d;
  var el = document.getElementById('dsel-digit-' + sym);
  if (el) el.textContent = d;
  /* refresh trade button label to show selected digit */
  var btn = document.getElementById('dtrade-btn-' + sym);
  if (btn && !btn.disabled) btn.textContent = digitGetTradeLabel(sym);
}

function digitSetTradeBtn(sym, loading) {
  var btn = document.getElementById('dtrade-btn-' + sym);
  if (!btn) return;
  if (loading) {
    btn.disabled = true; btn.textContent = '⏳ WAITING FOR RESULT…'; btn.style.opacity = '0.6';
  } else {
    btn.disabled = false; btn.style.opacity = '1';
    btn.textContent = digitGetTradeLabel(sym);
  }
}

function digitUpdateStats(sym, s) {
  var wE = document.getElementById('dstat-wins-'   + sym);
  var lE = document.getElementById('dstat-losses-' + sym);
  var pE = document.getElementById('dstat-pnl-'    + sym);
  if (wE) wE.textContent = s.wins;
  if (lE) lE.textContent = s.losses;
  if (pE) { pE.textContent = (s.pnl >= 0 ? '+' : '') + '$' + s.pnl.toFixed(2); pE.style.color = s.pnl >= 0 ? '#34d399' : '#f87171'; }
}

function digitUpdateConnectStatus(connected) {
  var dot  = document.getElementById('digit-conn-dot');
  var lbl  = document.getElementById('digit-conn-label');
  var btn  = document.getElementById('digit-conn-btn');
  var bal  = document.getElementById('digit-balance-display');
  var hdot = document.getElementById('digit-conn-dot-header');
  var hlbl = document.getElementById('digit-conn-label-header');
  var hbtn = document.getElementById('digit-header-btn');
  var balTxt = connected ? digitTrade.balance.toFixed(2) + ' ' + digitTrade.currency : '';
  if (dot)  dot.style.background  = connected ? '#34d399' : '#f87171';
  if (lbl)  lbl.textContent       = connected ? 'CONNECTED' : 'DISCONNECTED';
  if (btn)  { btn.textContent = connected ? '🔌 Disconnect' : '🔗 Connect & Start Trading'; btn.disabled = false; }
  if (bal)  bal.textContent       = balTxt;
  if (hdot) hdot.style.background = connected ? '#34d399' : '#f87171';
  if (hlbl) hlbl.textContent      = connected ? balTxt : 'NOT CONNECTED';
  if (hbtn) { hbtn.textContent = connected ? '✅ CONNECTED' : '🔗 CONNECT'; hbtn.style.background = connected ? '#059669' : 'var(--accent)'; }
}

function digitToast(msg, type) {
  type = type || 'info';
  if (typeof accToast === 'function') { accToast(msg, type); return; }
  var el = document.createElement('div');
  el.className = 'acc-toast ' + type; el.textContent = msg;
  var c = document.getElementById('acc-toast-container');
  if (c) { c.appendChild(el); setTimeout(function() { if (el.parentNode) el.parentNode.removeChild(el); }, 4200); }
}
