/**
 * tab-risefall.js — Rise/Fall template
 * CALL / PUT (or CALLE / PUTE with "allow equals") · ticks / seconds / minutes / hours / days
 * stake or payout basis · live payout quotes · buy · live position · early close where allowed
 */
const RiseFallTab = (function () {
  const ID = 'tab-risefall';
  const $ = function (s) { return document.getElementById('rf-' + s); };

  let inited = false, visible = false;
  let feed = null, tracker = null, quoteTimer = null, quoteInt = null, quoteSeq = 0, buying = false;
  const stats = { pl: 0, w: 0, l: 0 };
  const history = [];

  const UNIT_LABEL = { t: 'ticks', s: 'seconds', m: 'minutes', h: 'hours', d: 'days' };
  const UNIT_DEFAULT = { t: 5, s: 15, m: 1, h: 1, d: 1 };

  function build() {
    return `
<div id="${ID}" class="tab-content">
  <div class="t-wrap">
    <div class="t-head">
      <div>
        <h2 class="t-title">📈 Rise / Fall</h2>
        <p class="t-sub">Predict whether the market will finish higher (Rise) or lower (Fall) than the entry spot when the contract ends.</p>
      </div>
      <div id="rf-pill"></div>
    </div>

    <div class="t-grid">
      <div class="t-main">
        <div class="t-card">
          <div class="t-card-h">
            <select id="rf-symbol" class="t-select"><option>Loading markets…</option></select>
            <div class="t-price" id="rf-price">—</div>
          </div>
          <div class="t-card-b nopad"><canvas id="rf-chart" class="t-chart"></canvas></div>
        </div>

        <div class="t-card">
          <div class="t-card-h"><span class="t-card-title">Open positions</span></div>
          <div class="t-card-b"><div id="rf-positions" class="pos-list"></div></div>
        </div>

        <div class="t-card">
          <div class="t-card-h">
            <span class="t-card-title">Session history</span>
            <span class="t-muted" id="rf-stats">0 trades · P/L 0.00</span>
          </div>
          <div class="t-card-b nopad">
            <div class="hist-head hist-5"><span>Time</span><span>Market</span><span>Type</span><span>Stake</span><span>Profit</span></div>
            <div id="rf-history" class="hist-body"><div class="pos-empty">No trades yet</div></div>
          </div>
        </div>
      </div>

      <div class="t-side">
        <div class="t-card sticky">
          <div class="t-card-h"><span class="t-card-title">Trade ticket</span></div>
          <div class="t-card-b">
            <div class="t-field">
              <label>Duration</label>
              <div class="t-row2">
                <div class="t-step">
                  <button type="button" data-step="-1" data-target="rf-dur">−</button>
                  <input id="rf-dur" type="number" min="1" step="1" value="5" inputmode="numeric">
                  <button type="button" data-step="1" data-target="rf-dur">+</button>
                </div>
                <select id="rf-unit" class="t-select">
                  <option value="t" selected>Ticks</option>
                  <option value="s">Seconds</option>
                  <option value="m">Minutes</option>
                  <option value="h">Hours</option>
                  <option value="d">Days</option>
                </select>
              </div>
            </div>

            <div class="t-field">
              <label>Amount <span class="t-cur" id="rf-cur">USD</span></label>
              <div class="t-pills" id="rf-basis">
                <button type="button" class="t-pill active" data-v="stake">Stake</button>
                <button type="button" class="t-pill" data-v="payout">Payout</button>
              </div>
              <div class="t-step" style="margin-top:8px">
                <button type="button" data-step="-1" data-target="rf-amount">−</button>
                <input id="rf-amount" type="number" min="1" step="1" value="10" inputmode="decimal">
                <button type="button" data-step="1" data-target="rf-amount">+</button>
              </div>
            </div>

            <div class="t-field">
              <label class="t-switch-row">
                <span>Allow equals</span>
                <span class="t-switch"><input type="checkbox" id="rf-eq"><i></i></span>
              </label>
            </div>

            <div class="rf-quotes">
              <div class="rf-q up"><span>Rise</span><b id="rf-q-up">—</b><small id="rf-p-up"></small></div>
              <div class="rf-q down"><span>Fall</span><b id="rf-q-down">—</b><small id="rf-p-down"></small></div>
            </div>

            <div class="err-line" id="rf-err"></div>
            <div class="t-btnrow">
              <button id="rf-buy-up" type="button" class="t-btn t-btn-rise">▲ Rise</button>
              <button id="rf-buy-down" type="button" class="t-btn t-btn-fall">▼ Fall</button>
            </div>
            <div class="t-note">Payout is quoted live. Minimum and maximum durations depend on the market — the API will tell you if a value isn't allowed.</div>
          </div>
        </div>
      </div>
    </div>
  </div>
</div>`;
  }

  /* ── helpers ── */
  function basis() {
    const b = document.querySelector('#rf-basis .t-pill.active');
    return b ? b.getAttribute('data-v') : 'stake';
  }

  function base() {
    return {
      amount: UI.num($('amount')), basis: basis(), currency: Deriv.currency(),
      duration: Math.round(UI.num($('dur'))), duration_unit: $('unit').value,
      underlying_symbol: feed.symbol,
    };
  }

  function types() {
    const eq = $('eq').checked;
    return { up: eq ? 'CALLE' : 'CALL', down: eq ? 'PUTE' : 'PUT' };
  }

  function validate() {
    const b = base();
    if (!isFinite(b.amount) || b.amount <= 0) return 'Enter an amount above 0';
    if (!isFinite(b.duration) || b.duration < 1) return 'Enter a duration of at least 1';
    return '';
  }

  function setErr(msg) { $('err').textContent = msg || ''; }

  function updateButtons() {
    const authed = Deriv.isAuthed();
    const ready = authed && Deriv.trade.isOpen();
    const up = $('buy-up'), dn = $('buy-down');
    if (!authed) { up.textContent = 'Log in to trade'; dn.textContent = 'Log in to trade'; up.disabled = dn.disabled = buying; return; }
    up.textContent = buying ? 'Buying…' : '▲ Rise';
    dn.textContent = buying ? 'Buying…' : '▼ Fall';
    up.disabled = dn.disabled = buying || !ready;
  }

  /* ── live quotes (one-off proposals, refreshed on change + every 8s) ── */
  function scheduleQuotes() {
    clearTimeout(quoteTimer);
    quoteTimer = setTimeout(fetchQuotes, 400);
  }

  function stopQuotes() {
    clearTimeout(quoteTimer);
    clearInterval(quoteInt); quoteInt = null;
    quoteSeq++;
  }

  function startQuotes() {
    stopQuotes();
    fetchQuotes();
    quoteInt = setInterval(fetchQuotes, 8000);
  }

  async function fetchQuotes() {
    if (!visible || !feed || !feed.symbol) return;
    $('cur').textContent = Deriv.currency();
    const bad = validate();
    if (bad) { setErr(bad); return; }
    const sock = Deriv.market();
    if (!sock.isOpen()) { try { await sock.ensure(); } catch (e) { return; } }
    const seq = ++quoteSeq;
    const t = types(), b = base();
    const get = function (ct) {
      return sock.send(Object.assign({ proposal: 1 }, b, { contract_type: ct })).then(
        function (m) { return { ok: m.proposal }; },
        function (e) { return { err: e }; }
      );
    };
    const r = await Promise.all([get(t.up), get(t.down)]);
    if (seq !== quoteSeq) return;                 // stale
    paintQuote('up', r[0]); paintQuote('down', r[1]);
    const firstErr = (r[0].err || r[1].err);
    setErr(firstErr ? UI.friendlyError(firstErr) : '');
  }

  function paintQuote(side, r) {
    const q = $('q-' + side), p = $('p-' + side);
    if (r.ok) {
      const payout = Number(r.ok.payout), ask = Number(r.ok.ask_price);
      q.textContent = Deriv.fmt(payout);
      p.textContent = ask > 0 ? '+' + (((payout - ask) / ask) * 100).toFixed(1) + '% · cost ' + Deriv.fmt(ask) : '';
    } else {
      q.textContent = '—'; p.textContent = '';
    }
  }

  /* ── buy ── */
  async function buy(dir) {
    if (!Deriv.isAuthed()) { Deriv.login().catch(function (e) { UI.toast(UI.friendlyError(e), 'error'); }); return; }
    if (buying) return;
    const bad = validate();
    if (bad) { setErr(bad); return; }
    buying = true; updateButtons(); setErr('');
    try {
      const b = await Deriv.buyContract(Object.assign(base(), { contract_type: types()[dir] }));
      UI.toast('Bought ' + types()[dir] + ' #' + b.contract_id + ' · ' + Deriv.fmtMoney(b.buy_price), 'success');
      tracker.track(b.contract_id);
    } catch (e) {
      setErr(UI.friendlyError(e));
      UI.toast('Buy failed: ' + UI.friendlyError(e), 'error');
    } finally {
      buying = false; updateButtons();
    }
  }

  /* ── position callbacks ── */
  function extra(p) {
    let left = '—';
    if (p.tick_count != null && p.tick_stream) left = Math.max(0, p.tick_count - p.tick_stream.length) + ' ticks';
    else if (p.date_expiry) { const s = Math.max(0, p.date_expiry - Math.floor(Date.now() / 1000)); left = s >= 3600 ? Math.floor(s / 3600) + 'h ' + Math.floor((s % 3600) / 60) + 'm' : Math.floor(s / 60) + 'm ' + (s % 60) + 's'; }
    return '<div><label>Entry spot</label><b>' + UI.esc(p.entry_spot || '—') + '</b></div>'
         + '<div><label>Current</label><b>' + UI.esc(p.current_spot || p.exit_spot || '—') + '</b></div>'
         + '<div><label>Left</label><b>' + UI.esc(p.is_sold === 1 ? 'ended' : left) + '</b></div>';
  }

  function onUpdate(p) {
    const e = parseFloat(p.entry_spot);
    feed.chart.setLines(isFinite(e) ? [{ y: e, label: 'Entry', color: '#f59e0b' }] : []);
  }

  function onSettled(info) {
    stats.pl += info.profit; info.profit >= 0 ? stats.w++ : stats.l++;
    history.unshift(info);
    if (history.length > 40) history.pop();
    if (!tracker.openCount()) feed.chart.setLines([]);
    UI.toast((info.profit >= 0 ? '✓ WIN ' : '✗ LOSS ') + UI.signed(info.profit, info.currency) + ' · ' + info.symbol, info.profit >= 0 ? 'success' : 'error');
    renderHistory();
  }

  function renderHistory() {
    const box = $('history');
    $('stats').textContent = (stats.w + stats.l) + ' trades · W ' + stats.w + ' / L ' + stats.l + ' · P/L ' + UI.signed(stats.pl);
    if (!history.length) { box.innerHTML = '<div class="pos-empty">No trades yet</div>'; return; }
    box.innerHTML = history.map(function (h) {
      return '<div class="hist-row hist-5"><span>' + UI.esc(UI.timeStr(h.purchase_time)) + '</span><span>' + UI.esc(h.symbol) + '</span>'
        + '<span>' + UI.esc(h.contract_type) + '</span><span>' + UI.esc(Deriv.fmt(h.buy_price, h.currency)) + '</span>'
        + '<span class="' + (h.profit >= 0 ? 'up' : 'down') + '">' + UI.esc(UI.signed(h.profit, h.currency)) + '</span></div>';
    }).join('');
  }

  /* ── lifecycle ── */
  async function init() {
    if (inited) return;
    inited = true;

    UI.mountAccountPill($('pill'));
    tracker = new UI.PositionTracker($('positions'), {
      adoptFilter: function (p) { return /^(CALL|PUT)E?$/.test(p.contract_type || ''); },
      onUpdate: onUpdate, onSettled: onSettled, extra: extra, emptyText: 'No open positions',
    });
    feed = new UI.MarketFeed({
      select: $('symbol'), canvas: $('chart'), priceEl: $('price'),
      contractTypes: ['CALL'], count: 120, chartMax: 120, preferred: 'R_100',
      onSymbol: function () { if (visible) scheduleQuotes(); },
    });

    $('basis').addEventListener('click', function (e) {
      const b = e.target.closest('.t-pill'); if (!b) return;
      document.querySelectorAll('#rf-basis .t-pill').forEach(function (x) { x.classList.toggle('active', x === b); });
      scheduleQuotes();
    });
    $('unit').addEventListener('change', function () {
      $('dur').value = UNIT_DEFAULT[$('unit').value] || 1;
      scheduleQuotes();
    });
    ['dur', 'amount'].forEach(function (k) { $(k).addEventListener('input', scheduleQuotes); });
    $('eq').addEventListener('change', scheduleQuotes);
    $('buy-up').addEventListener('click', function () { buy('up'); });
    $('buy-down').addEventListener('click', function () { buy('down'); });

    Deriv.on('socket', function (s) {
      if (s.name !== 'trade') return;
      updateButtons();
      if (s.status === 'open' && visible) { tracker.adopt(); scheduleQuotes(); }
      if (s.status === 'closed' && visible) scheduleQuotes();
    });
    Deriv.on('auth', function (a) { updateButtons(); if (!a.authed) tracker.clearAll(); if (visible) scheduleQuotes(); });
    Deriv.on('account', function () { tracker.clearAll(); if (visible) scheduleQuotes(); });

    await feed.loadSymbols();
    updateButtons();
    if (visible) { feed.start(); startQuotes(); }
  }

  function show() {
    visible = true;
    init().then(function () {
      if (!visible) return;
      feed.start();
      startQuotes();
      if (Deriv.trade.isOpen()) tracker.adopt();
      updateButtons();
    });
  }

  function hide() {
    visible = false;
    stopQuotes();
    if (feed) feed.stop();
  }

  return { id: ID, build: build, show: show, hide: hide };
})();
