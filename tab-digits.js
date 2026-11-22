/**
 * tab-digits.js — Digits template
 * Matches/Differs · Even/Odd · Over/Under  (DIGITMATCH/DIGITDIFF, DIGITEVEN/DIGITODD, DIGITOVER/DIGITUNDER)
 * Live last-digit frequency analysis over the last 100–1000 ticks + live payout quotes + buy.
 */
const DigitsTab = (function () {
  const ID = 'tab-digits';
  const $ = function (s) { return document.getElementById('dg-' + s); };

  let inited = false, visible = false;
  let feed = null, tracker = null, quoteTimer = null, quoteSeq = 0, buying = false;
  let mode = 'match';          // match | eo | ou
  let digit = 5;
  const stats = { pl: 0, w: 0, l: 0 };
  const history = [];

  const MODES = {
    match: { a: ['DIGITMATCH', 'Matches'],  b: ['DIGITDIFF',  'Differs'], needsDigit: true  },
    eo:    { a: ['DIGITEVEN',  'Even'],     b: ['DIGITODD',   'Odd'],     needsDigit: false },
    ou:    { a: ['DIGITOVER',  'Over'],     b: ['DIGITUNDER', 'Under'],   needsDigit: true  },
  };

  function build() {
    let digitBtns = '';
    for (let i = 0; i < 10; i++) digitBtns += '<button type="button" class="dg-pick' + (i === 5 ? ' active' : '') + '" data-d="' + i + '">' + i + '</button>';
    let bars = '';
    for (let i = 0; i < 10; i++) bars += '<div class="dg-col" data-d="' + i + '"><span class="dg-pct">0%</span><div class="dg-bar"><i></i></div><b>' + i + '</b></div>';

    return `
<div id="${ID}" class="tab-content">
  <div class="t-wrap">
    <div class="t-head">
      <div>
        <h2 class="t-title">🔢 Digits</h2>
        <p class="t-sub">Trade the last digit of the market price. Live digit frequencies help you spot patterns — they are not a guarantee of what comes next.</p>
      </div>
      <div id="dg-pill"></div>
    </div>

    <div class="t-grid">
      <div class="t-main">
        <div class="t-card">
          <div class="t-card-h">
            <select id="dg-symbol" class="t-select"><option>Loading markets…</option></select>
            <div class="t-price" id="dg-price">—</div>
          </div>
          <div class="t-card-b nopad"><canvas id="dg-chart" class="t-chart short"></canvas></div>
        </div>

        <div class="t-card">
          <div class="t-card-h">
            <span class="t-card-title">Last-digit distribution</span>
            <select id="dg-sample" class="t-select sm">
              <option value="100">Last 100 ticks</option>
              <option value="250">Last 250 ticks</option>
              <option value="500">Last 500 ticks</option>
              <option value="1000" selected>Last 1000 ticks</option>
            </select>
          </div>
          <div class="t-card-b">
            <div class="dg-cols" id="dg-cols">${bars}</div>
            <div class="dg-strip-label">Recent digits</div>
            <div class="dg-strip" id="dg-strip"></div>
            <div class="dg-summary" id="dg-summary"></div>
          </div>
        </div>

        <div class="t-card">
          <div class="t-card-h"><span class="t-card-title">Open positions</span></div>
          <div class="t-card-b"><div id="dg-positions" class="pos-list"></div></div>
        </div>

        <div class="t-card">
          <div class="t-card-h">
            <span class="t-card-title">Session history</span>
            <span class="t-muted" id="dg-stats">0 trades · P/L 0.00</span>
          </div>
          <div class="t-card-b nopad">
            <div class="hist-head hist-5"><span>Time</span><span>Market</span><span>Type</span><span>Stake</span><span>Profit</span></div>
            <div id="dg-history" class="hist-body"><div class="pos-empty">No trades yet</div></div>
          </div>
        </div>
      </div>

      <div class="t-side">
        <div class="t-card sticky">
          <div class="t-card-h"><span class="t-card-title">Trade ticket</span></div>
          <div class="t-card-b">
            <div class="t-field">
              <label>Trade type</label>
              <div class="t-pills" id="dg-mode">
                <button type="button" class="t-pill active" data-v="match">Matches / Differs</button>
                <button type="button" class="t-pill" data-v="eo">Even / Odd</button>
                <button type="button" class="t-pill" data-v="ou">Over / Under</button>
              </div>
            </div>

            <div class="t-field" id="dg-digit-wrap">
              <label>Last digit prediction</label>
              <div class="dg-picks" id="dg-picks">${digitBtns}</div>
            </div>

            <div class="t-field">
              <label>Duration (ticks)</label>
              <div class="t-step">
                <button type="button" data-step="-1" data-target="dg-dur">−</button>
                <input id="dg-dur" type="number" min="1" max="10" step="1" value="1" inputmode="numeric">
                <button type="button" data-step="1" data-target="dg-dur">+</button>
              </div>
            </div>

            <div class="t-field">
              <label>Stake <span class="t-cur" id="dg-cur">USD</span></label>
              <div class="t-step">
                <button type="button" data-step="-1" data-target="dg-stake">−</button>
                <input id="dg-stake" type="number" min="1" step="1" value="10" inputmode="decimal">
                <button type="button" data-step="1" data-target="dg-stake">+</button>
              </div>
            </div>

            <div class="dg-hint" id="dg-hint"></div>

            <div class="rf-quotes">
              <div class="rf-q up"><span id="dg-qa-name">Matches</span><b id="dg-q-a">—</b><small id="dg-p-a"></small></div>
              <div class="rf-q down"><span id="dg-qb-name">Differs</span><b id="dg-q-b">—</b><small id="dg-p-b"></small></div>
            </div>

            <div class="err-line" id="dg-err"></div>
            <div class="t-btnrow">
              <button id="dg-buy-a" type="button" class="t-btn t-btn-rise">Matches</button>
              <button id="dg-buy-b" type="button" class="t-btn t-btn-fall">Differs</button>
            </div>
          </div>
        </div>
      </div>
    </div>
  </div>
</div>`;
  }

  /* ── analysis ── */
  function sampleSize() { return parseInt($('sample').value, 10) || 1000; }

  function digitsOf(quotes, pip, n) {
    return quotes.slice(-n).map(function (q) { return Deriv.lastDigit(q, pip); });
  }

  function paintDistribution() {
    if (!feed) return;
    const n = sampleSize();
    const ds = digitsOf(feed.quotes, feed.pip, n);
    const counts = new Array(10).fill(0);
    ds.forEach(function (d) { counts[d]++; });
    const total = ds.length || 1;
    const pcts = counts.map(function (c) { return (c / total) * 100; });
    const mx = Math.max.apply(null, pcts), mn = Math.min.apply(null, pcts);
    const lastD = ds.length ? ds[ds.length - 1] : -1;

    document.querySelectorAll('#dg-cols .dg-col').forEach(function (col) {
      const d = Number(col.getAttribute('data-d'));
      col.querySelector('.dg-pct').textContent = ds.length ? pcts[d].toFixed(1) + '%' : '0%';
      col.querySelector('.dg-bar i').style.height = (ds.length && mx > 0 ? Math.max(3, (pcts[d] / mx) * 100) : 3) + '%';
      col.classList.toggle('max', ds.length > 0 && pcts[d] === mx);
      col.classList.toggle('min', ds.length > 0 && pcts[d] === mn);
      col.classList.toggle('now', d === lastD);
    });

    const strip = ds.slice(-30);
    $('strip').innerHTML = strip.map(function (d) { return '<i class="' + (d % 2 ? 'o' : 'e') + '">' + d + '</i>'; }).join('');

    if (ds.length) {
      const hiD = pcts.indexOf(mx), loD = pcts.indexOf(mn);
      $('summary').innerHTML = 'Sample: <b>' + ds.length + '</b> ticks · Most frequent <b>' + hiD + '</b> (' + mx.toFixed(1) + '%) · Least frequent <b>' + loD + '</b> (' + mn.toFixed(1) + '%)';
    } else {
      $('summary').textContent = 'Collecting ticks…';
    }

    /* hint for the chosen prediction */
    let hint = '';
    if (ds.length) {
      if (mode === 'match') hint = 'Digit ' + digit + ' appeared in ' + pcts[digit].toFixed(1) + '% of the sample (10% is average).';
      else if (mode === 'eo') {
        const ev = counts[0] + counts[2] + counts[4] + counts[6] + counts[8];
        hint = 'Even ' + ((ev / total) * 100).toFixed(1) + '% · Odd ' + (((total - ev) / total) * 100).toFixed(1) + '% in the sample.';
      } else {
        let over = 0, under = 0;
        for (let d = 0; d < 10; d++) { if (d > digit) over += counts[d]; if (d < digit) under += counts[d]; }
        hint = 'Over ' + digit + ': ' + ((over / total) * 100).toFixed(1) + '% · Under ' + digit + ': ' + ((under / total) * 100).toFixed(1) + '% in the sample.';
      }
    }
    $('hint').textContent = hint;
  }

  /* ── ticket ── */
  function setMode(m) {
    mode = m;
    document.querySelectorAll('#dg-mode .t-pill').forEach(function (b) { b.classList.toggle('active', b.getAttribute('data-v') === m); });
    const M = MODES[m];
    $('digit-wrap').style.display = M.needsDigit ? '' : 'none';
    $('qa-name').textContent = M.a[1]; $('qb-name').textContent = M.b[1];
    $('buy-a').textContent = M.a[1]; $('buy-b').textContent = M.b[1];
    $('q-a').textContent = '—'; $('q-b').textContent = '—'; $('p-a').textContent = ''; $('p-b').textContent = '';
    updateButtons();
    paintDistribution();
    scheduleQuotes();
  }

  function base() {
    const p = {
      amount: UI.num($('stake')), basis: 'stake', currency: Deriv.currency(),
      duration: Math.round(UI.num($('dur'))), duration_unit: 't',
      underlying_symbol: feed.symbol,
    };
    if (MODES[mode].needsDigit) p.barrier = String(digit);
    return p;
  }

  function validate() {
    const b = base();
    if (!isFinite(b.amount) || b.amount <= 0) return 'Enter a stake above 0';
    if (!isFinite(b.duration) || b.duration < 1 || b.duration > 10) return 'Duration must be 1–10 ticks';
    return '';
  }

  function setErr(msg) { $('err').textContent = msg || ''; }

  function updateButtons() {
    const authed = Deriv.isAuthed();
    const ready = authed && Deriv.trade.isOpen();
    const a = $('buy-a'), b = $('buy-b'), M = MODES[mode];
    a.textContent = authed ? (buying ? 'Buying…' : M.a[1]) : 'Log in to trade';
    b.textContent = authed ? (buying ? 'Buying…' : M.b[1]) : 'Log in to trade';
    a.disabled = b.disabled = authed ? (buying || !ready) : buying;
  }

  function scheduleQuotes() {
    clearTimeout(quoteTimer);
    quoteTimer = setTimeout(fetchQuotes, 400);
  }

  async function fetchQuotes() {
    if (!visible || !feed || !feed.symbol) return;
    $('cur').textContent = Deriv.currency();
    const bad = validate();
    if (bad) { setErr(bad); return; }
    const sock = Deriv.market();
    if (!sock.isOpen()) { try { await sock.ensure(); } catch (e) { return; } }
    const seq = ++quoteSeq;
    const M = MODES[mode], b = base();
    const get = function (ct) {
      return sock.send(Object.assign({ proposal: 1 }, b, { contract_type: ct })).then(
        function (m) { return { ok: m.proposal }; },
        function (e) { return { err: e }; }
      );
    };
    const r = await Promise.all([get(M.a[0]), get(M.b[0])]);
    if (seq !== quoteSeq) return;
    ['a', 'b'].forEach(function (k, i) {
      const x = r[i];
      if (x.ok) {
        const payout = Number(x.ok.payout), ask = Number(x.ok.ask_price);
        $('q-' + k).textContent = Deriv.fmt(payout);
        $('p-' + k).textContent = ask > 0 ? '+' + (((payout - ask) / ask) * 100).toFixed(1) + '%' : '';
      } else { $('q-' + k).textContent = '—'; $('p-' + k).textContent = ''; }
    });
    const firstErr = r[0].err || r[1].err;
    setErr(firstErr ? UI.friendlyError(firstErr) : '');
  }

  async function buy(which) {
    if (!Deriv.isAuthed()) { Deriv.login().catch(function (e) { UI.toast(UI.friendlyError(e), 'error'); }); return; }
    if (buying) return;
    const bad = validate();
    if (bad) { setErr(bad); return; }
    const ct = MODES[mode][which][0];
    buying = true; updateButtons(); setErr('');
    try {
      const b = await Deriv.buyContract(Object.assign(base(), { contract_type: ct }));
      UI.toast('Bought ' + ct.replace('DIGIT', '') + ' #' + b.contract_id + ' · ' + Deriv.fmtMoney(b.buy_price), 'success');
      tracker.track(b.contract_id);
    } catch (e) {
      setErr(UI.friendlyError(e));
      UI.toast('Buy failed: ' + UI.friendlyError(e), 'error');
    } finally {
      buying = false; updateButtons();
    }
  }

  /* ── positions ── */
  function extra(p) {
    let left = '—';
    if (p.tick_count != null && p.tick_stream) left = Math.max(0, p.tick_count - p.tick_stream.length) + ' ticks';
    return '<div><label>Barrier</label><b>' + UI.esc(p.barrier != null ? p.barrier : '—') + '</b></div>'
         + '<div><label>Entry</label><b>' + UI.esc(p.entry_spot || '—') + '</b></div>'
         + '<div><label>Left</label><b>' + UI.esc(p.is_sold === 1 ? 'ended' : left) + '</b></div>';
  }

  function onSettled(info) {
    stats.pl += info.profit; info.profit >= 0 ? stats.w++ : stats.l++;
    history.unshift(info);
    if (history.length > 40) history.pop();
    UI.toast((info.profit >= 0 ? '✓ WIN ' : '✗ LOSS ') + UI.signed(info.profit, info.currency) + ' · ' + info.symbol, info.profit >= 0 ? 'success' : 'error');
    renderHistory();
  }

  function renderHistory() {
    const box = $('history');
    $('stats').textContent = (stats.w + stats.l) + ' trades · W ' + stats.w + ' / L ' + stats.l + ' · P/L ' + UI.signed(stats.pl);
    if (!history.length) { box.innerHTML = '<div class="pos-empty">No trades yet</div>'; return; }
    box.innerHTML = history.map(function (h) {
      return '<div class="hist-row hist-5"><span>' + UI.esc(UI.timeStr(h.purchase_time)) + '</span><span>' + UI.esc(h.symbol) + '</span>'
        + '<span>' + UI.esc(String(h.contract_type).replace('DIGIT', '')) + '</span><span>' + UI.esc(Deriv.fmt(h.buy_price, h.currency)) + '</span>'
        + '<span class="' + (h.profit >= 0 ? 'up' : 'down') + '">' + UI.esc(UI.signed(h.profit, h.currency)) + '</span></div>';
    }).join('');
  }

  /* ── lifecycle ── */
  async function init() {
    if (inited) return;
    inited = true;

    UI.mountAccountPill($('pill'));
    tracker = new UI.PositionTracker($('positions'), {
      adoptFilter: function (p) { return /^DIGIT/.test(p.contract_type || ''); },
      onSettled: onSettled, extra: extra, emptyText: 'No open positions',
    });
    feed = new UI.MarketFeed({
      select: $('symbol'), canvas: $('chart'), priceEl: $('price'),
      contractTypes: ['DIGITMATCH'], count: 1000, chartMax: 80, keep: 1000, preferred: 'R_100',
      onHistory: paintDistribution, onTick: paintDistribution,
      onSymbol: function () { if (visible) scheduleQuotes(); },
    });

    $('mode').addEventListener('click', function (e) { const b = e.target.closest('.t-pill'); if (b) setMode(b.getAttribute('data-v')); });
    $('picks').addEventListener('click', function (e) {
      const b = e.target.closest('.dg-pick'); if (!b) return;
      digit = Number(b.getAttribute('data-d'));
      document.querySelectorAll('#dg-picks .dg-pick').forEach(function (x) { x.classList.toggle('active', x === b); });
      paintDistribution(); scheduleQuotes();
    });
    $('sample').addEventListener('change', paintDistribution);
    ['dur', 'stake'].forEach(function (k) { $(k).addEventListener('input', scheduleQuotes); });
    $('buy-a').addEventListener('click', function () { buy('a'); });
    $('buy-b').addEventListener('click', function () { buy('b'); });

    Deriv.on('socket', function (s) {
      if (s.name !== 'trade') return;
      updateButtons();
      if (s.status === 'open' && visible) { tracker.adopt(); scheduleQuotes(); }
      if (s.status === 'closed' && visible) scheduleQuotes();
    });
    Deriv.on('auth', function (a) { updateButtons(); if (!a.authed) tracker.clearAll(); if (visible) scheduleQuotes(); });
    Deriv.on('account', function () { tracker.clearAll(); if (visible) scheduleQuotes(); });

    await feed.loadSymbols();
    setMode('match');
    if (visible) feed.start();
  }

  function show() {
    visible = true;
    init().then(function () {
      if (!visible) return;
      feed.start();
      scheduleQuotes();
      if (Deriv.trade.isOpen()) tracker.adopt();
      updateButtons();
    });
  }

  function hide() {
    visible = false;
    clearTimeout(quoteTimer); quoteSeq++;
    if (feed) feed.stop();
  }

  return { id: ID, build: build, show: show, hide: hide };
})();
