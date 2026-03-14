/**
 * digits.js
 * Digits Analyzer tab — live digit frequency tracker.
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

function initializeDigitsAnalyzer() {
  if (digitsAnalyzerInitialized) return;
  digitsAnalyzerInitialized = true;

  const dStore = {};
  let dWs = null;

  /* ── Clock ── */
  function updateTime() {
    const el = document.getElementById('digits-current-time');
    if (el) el.textContent = new Date().toLocaleTimeString();
  }
  setInterval(updateTime, 1000);
  updateTime();

  /* ── 2nd decimal digit ── */
  function getDigit(v) {
    const s = v.toFixed(10).split('.');
    return s.length < 2 ? 0 : parseInt(s[1][1], 10);
  }

  /* ── Build digit cards ── */
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
              <div id="dcell-${v.symbol}-${d}" style="
                border-radius:50%;width:100%;aspect-ratio:1/1;
                display:flex;flex-direction:column;align-items:center;justify-content:center;
                border:2px solid var(--border);background:var(--bg-elevated);
                transition:background 0.3s,border-color 0.3s,transform 0.2s,box-shadow 0.2s;position:relative;">
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
      `;
      c.appendChild(card);

      dStore[v.symbol] = {
        prices: [],
        currentDigit: null,
        ui: {
          price: card.querySelector(`#dp-${v.symbol}`),
          ticks: card.querySelector(`#dtick-count-${v.symbol}`),
          cells: Object.fromEntries([0,1,2,3,4,5,6,7,8,9].map(d => [d, card.querySelector(`#dcell-${v.symbol}-${d}`)])),
          pcts:  Object.fromEntries([0,1,2,3,4,5,6,7,8,9].map(d => [d, card.querySelector(`#dpct-${v.symbol}-${d}`)])),
          csrs:  Object.fromEntries([0,1,2,3,4,5,6,7,8,9].map(d => [d, card.querySelector(`#dcsr-${v.symbol}-${d}`)]))
        }
      };
    });
  }

  /* ── Render digit grid ── */
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

    if (ui.ticks) ui.ticks.textContent = `${total} / ${DIGIT_HIST} ticks`;

    for (let d = 0; d < 10; d++) {
      const pct  = (counts[d] / total * 100).toFixed(1);
      const cell = ui.cells[d];
      const pctEl= ui.pcts[d];
      const csrEl= ui.csrs[d];
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

      pctEl.textContent      = pct + '%';
      cell.style.transform   = d === s.currentDigit ? 'scale(1.18)' : 'scale(1)';
      cell.style.zIndex      = d === s.currentDigit ? '2' : '0';
      cell.style.boxShadow   = d === s.currentDigit ? '0 4px 16px rgba(0,0,0,0.18)' : 'none';
      if (csrEl) {
        if (d === s.currentDigit) { csrEl.style.opacity = '1'; csrEl.style.color = d === maxD ? '#16a34a' : d === minD ? '#dc2626' : 'var(--accent)'; }
        else                      { csrEl.style.opacity = '0'; }
      }
    }
  }

  /* ── WebSocket ── */
  function connectDWs() {
    if (dWs) { dWs.onclose = null; dWs.onerror = null; try { dWs.close(); } catch (e) {} dWs = null; }
    dWs = new WebSocket('wss://ws.binaryws.com/websockets/v3?app_id=1089');

    dWs.onopen = () => {
      DIGIT_VOLS.forEach((v, i) => setTimeout(() => {
        if (dWs && dWs.readyState === WebSocket.OPEN)
          dWs.send(JSON.stringify({ ticks_history: v.symbol, count: DIGIT_HIST, end: 'latest', style: 'ticks', subscribe: 1 }));
      }, i * 160));
    };

    dWs.onmessage = e => {
      try {
        const d = JSON.parse(e.data);
        if (d.msg_type === 'history' && d.history?.prices) {
          const sym   = d.echo_req?.ticks_history;
          const store = dStore[sym]; if (!sym || !store) return;
          store.prices = d.history.prices.map(p => parseFloat(p)).slice(-DIGIT_HIST);
          const last   = store.prices[store.prices.length - 1];
          store.currentDigit = getDigit(last);
          if (store.ui.price) store.ui.price.textContent = last.toFixed(5);
          if (store.ui.ticks) store.ui.ticks.textContent = `${store.prices.length} / ${DIGIT_HIST} ticks`;
          renderDigits(sym);
        }
        if (d.msg_type === 'tick') {
          const { symbol: sym, quote } = d.tick;
          const store = dStore[sym]; if (!store) return;
          const price = parseFloat(quote);
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

  /* ── Digit selector buttons ── */
  document.querySelectorAll('.digit-btn').forEach(btn => {
    btn.addEventListener('click', function () {
      document.querySelectorAll('.digit-btn').forEach(b => b.classList.remove('active'));
      this.classList.add('active');
    });
  });

  buildDCards();
  connectDWs();
}
