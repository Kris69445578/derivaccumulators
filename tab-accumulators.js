/**
 * tab-accumulators.js — Accumulators template
 * "Your stake grows by a chosen growth rate for every tick that stays within the barrier range."
 * contract_type ACCU · live proposal stream for barriers/max payout · buy · live position · close (sell)
 */
const AccumulatorsTab = (function () {
  const ID = 'tab-accumulators';
  const $ = function (s) { return document.getElementById('ac-' + s); };

  let inited = false, visible = false;
  let feed = null, tracker = null, propSub = null, propTimer = null, buying = false;
  let lastProposal = null;
  const stats = { pl: 0, w: 0, l: 0 };
  const history = [];

  function build() {
    return `
<div id="${ID}" class="tab-content">
  <div class="t-wrap">
    <div class="t-head">
      <div>
        <h2 class="t-title">🔄 Accumulators</h2>
        <p class="t-sub">Your stake grows by the chosen growth rate for every tick that stays inside the barrier range. Close any time to bank the profit — or the barrier knocks you out.</p>
      </div>
      <div id="ac-pill"></div>
    </div>

    <div class="t-grid">
      <div class="t-main">
        <div class="t-card">
          <div class="t-card-h">
            <select id="ac-symbol" class="t-select"><option>Loading markets…</option></select>
            <div class="t-price" id="ac-price">—</div>
          </div>
          <div class="t-card-b nopad"><canvas id="ac-chart" class="t-chart"></canvas></div>
        </div>

        <div class="t-card">
          <div class="t-card-h"><span class="t-card-title">Open positions</span></div>
          <div class="t-card-b"><div id="ac-positions" class="pos-list"></div></div>
        </div>

        <div class="t-card">
          <div class="t-card-h">
            <span class="t-card-title">Session history</span>
            <span class="t-muted" id="ac-stats">0 trades · P/L 0.00</span>
          </div>
          <div class="t-card-b nopad">
            <div class="hist-head hist-5"><span>Time</span><span>Market</span><span>Stake</span><span>Profit</span><span>Ticks</span></div>
            <div id="ac-history" class="hist-body"><div class="pos-empty">No trades yet</div></div>
          </div>
        </div>
      </div>

      <div class="t-side">
        <div class="t-card sticky">
          <div class="t-card-h"><span class="t-card-title">Trade ticket</span></div>
          <div class="t-card-b">
            <div class="t-field">
              <label>Growth rate</label>
              <div class="t-pills" id="ac-growth">
                <button type="button" class="t-pill active" data-v="0.01">1%</button>
                <button type="button" class="t-pill" data-v="0.02">2%</button>
                <button type="button" class="t-pill" data-v="0.03">3%</button>
                <button type="button" class="t-pill" data-v="0.04">4%</button>
                <button type="button" class="t-pill" data-v="0.05">5%</button>
              </div>
            </div>

            <div class="t-field">
              <label>Stake <span class="t-cur" id="ac-cur">USD</span></label>
              <div class="t-step">
                <button type="button" data-step="-1" data-target="ac-stake">−</button>
                <input id="ac-stake" type="number" min="1" step="1" value="10" inputmode="decimal">
                <button type="button" data-step="1" data-target="ac-stake">+</button>
              </div>
            </div>

            <div class="t-field">
              <label class="t-switch-row">
                <span>Take profit</span>
                <span class="t-switch"><input type="checkbox" id="ac-tp-on"><i></i></span>
              </label>
              <div class="t-step" id="ac-tp-wrap" style="display:none">
                <button type="button" data-step="-1" data-target="ac-tp">−</button>
                <input id="ac-tp" type="number" min="0.01" step="0.5" value="1" inputmode="decimal">
                <button type="button" data-step="1" data-target="ac-tp">+</button>
              </div>
            </div>

            <div class="t-kvs">
              <div class="t-kv"><span>Max payout</span><b id="ac-i-payout">—</b></div>
              <div class="t-kv"><span>Max ticks</span><b id="ac-i-ticks">—</b></div>
              <div class="t-kv"><span>Barrier range (±)</span><b id="ac-i-range">—</b></div>
              <div class="t-kv"><span>Tick-size barrier</span><b id="ac-i-tsb">—</b></div>
            </div>

            <div class="t-field">
              <label>Recent ticks stayed in range</label>
              <div class="stayed" id="ac-stayed"><span class="t-muted">—</span></div>
            </div>

            <div class="err-line" id="ac-err"></div>
            <button id="ac-buy" type="button" class="t-btn t-btn-buy">Buy</button>
            <div class="t-note">Accumulators have no fixed expiry. A tick outside the barrier range closes the contract and you lose your stake.</div>
          </div>
        </div>
      </div>
    </div>
  </div>
</div>`;
  }

  /* ── helpers ── */
  function growth() {
    const b = document.querySelector('#ac-growth .t-pill.active');
    return b ? parseFloat(b.getAttribute('data-v')) : 0.01;
  }

  function absB(v, spot) {
    if (v == null || v === '') return NaN;
    const str = String(v), n = parseFloat(str);
    if (!isFinite(n)) return NaN;
    return /^[+-]/.test(str) && isFinite(spot) ? spot + n : n;
  }

  function params() {
    const stake = UI.num($('stake'));
    const p = {
      amount: stake, basis: 'stake', contract_type: 'ACCU',
      currency: Deriv.currency(), underlying_symbol: feed.symbol, growth_rate: growth(),
    };
    if ($('tp-on').checked) {
      const tp = UI.num($('tp'));
      if (isFinite(tp) && tp > 0) p.limit_order = { take_profit: tp };
    }
    return p;
  }

  function setErr(msg) { $('err').textContent = msg || ''; }

  function updateButton() {
    const b = $('buy');
    if (!Deriv.isAuthed()) { b.textContent = 'Log in to trade'; b.disabled = buying; return; }
    if (!Deriv.trade.isOpen()) { b.textContent = 'Connecting…'; b.disabled = true; return; }
    b.textContent = buying ? 'Buying…' : 'Buy';
    b.disabled = buying;
  }

  /* ── proposal stream (live barriers / max payout) ── */
  function scheduleProposal() {
    clearTimeout(propTimer);
    propTimer = setTimeout(startProposal, 350);
  }

  function stopProposal() {
    clearTimeout(propTimer);
    if (propSub) { propSub.forget(); propSub = null; }
  }

  function startProposal() {
    stopProposal();
    if (!visible || !feed || !feed.symbol) return;
    const stake = UI.num($('stake'));
    if (!isFinite(stake) || stake <= 0) { setErr('Enter a stake above 0'); return; }
    setErr('');
    $('cur').textContent = Deriv.currency();
    const sock = Deriv.market();
    propSub = sock.subscribe(
      Object.assign({ proposal: 1 }, params()),
      function (m) {
        const p = m.proposal;
        if (!p) return;
        lastProposal = p;
        setErr('');
        const cd = p.contract_details || {}, vp = p.validation_params || {};
        const maxPayout = cd.maximum_payout != null ? Number(cd.maximum_payout) : Number(vp.max_payout);
        const maxTicks = cd.maximum_ticks != null ? cd.maximum_ticks : vp.max_ticks;
        $('i-payout').textContent = isFinite(maxPayout) ? Deriv.fmtMoney(maxPayout) : '—';
        $('i-ticks').textContent = maxTicks != null ? maxTicks : '—';
        $('i-tsb').textContent = cd.tick_size_barrier_percentage != null ? cd.tick_size_barrier_percentage + '%' : (cd.tick_size_barrier != null ? cd.tick_size_barrier : '—');
        const spot = Number(p.spot);
        const hi = absB(cd.high_barrier, spot), lo = absB(cd.low_barrier, spot);
        if (isFinite(hi) && isFinite(lo)) {
          $('i-range').textContent = ((hi - lo) / 2).toFixed(feed.pip);
          if (!tracker.openCount()) feed.chart.setBand(lo, hi);
        } else if (cd.barrier_spot_distance != null) {
          $('i-range').textContent = cd.barrier_spot_distance;
        }
        renderStayed(cd.ticks_stayed_in);
      },
      function (err) { setErr(UI.friendlyError(err)); }
    );
  }

  function renderStayed(arr) {
    const box = $('stayed');
    if (!Array.isArray(arr) || !arr.length) { box.innerHTML = '<span class="t-muted">—</span>'; return; }
    const tail = arr.slice(-24);
    const mx = Math.max.apply(null, tail.concat([1]));
    box.innerHTML = tail.map(function (v) {
      return '<i title="' + UI.esc(v) + ' ticks" style="height:' + Math.max(8, Math.round((v / mx) * 100)) + '%"></i>';
    }).join('');
  }

  /* ── buy ── */
  async function buy() {
    if (!Deriv.isAuthed()) { Deriv.login().catch(function (e) { UI.toast(UI.friendlyError(e), 'error'); }); return; }
    if (buying) return;
    const stake = UI.num($('stake'));
    if (!isFinite(stake) || stake <= 0) { setErr('Enter a stake above 0'); return; }
    buying = true; updateButton(); setErr('');
    try {
      const b = await Deriv.buyContract(params());
      UI.toast('Bought accumulator #' + b.contract_id + ' · ' + Deriv.fmtMoney(b.buy_price), 'success');
      tracker.track(b.contract_id);
    } catch (e) {
      setErr(UI.friendlyError(e));
      UI.toast('Buy failed: ' + UI.friendlyError(e), 'error');
    } finally {
      buying = false; updateButton();
    }
  }

  /* ── position callbacks ── */
  function onUpdate(p) {
    if (!feed) return;
    const lines = [];
    const entry = parseFloat(p.entry_spot);
    if (isFinite(entry)) lines.push({ y: entry, label: 'Entry', color: '#f59e0b' });
    feed.chart.setLines(lines);
    const spot = parseFloat(p.current_spot);
    const hi = absB(p.current_spot_high_barrier, spot), lo = absB(p.current_spot_low_barrier, spot);
    if (isFinite(hi) && isFinite(lo)) feed.chart.setBand(lo, hi);
  }

  function extra(p) {
    const g = p.growth_rate != null ? (Number(p.growth_rate) * 100).toFixed(0) + '%' : '—';
    return '<div><label>Ticks in</label><b>' + UI.esc(p.tick_passed != null ? p.tick_passed : 0) + '</b></div>'
         + '<div><label>Growth</label><b>' + UI.esc(g) + '</b></div>'
         + '<div><label>Spot</label><b>' + UI.esc(p.current_spot || p.exit_spot || '—') + '</b></div>';
  }

  function onSettled(info) {
    stats.pl += info.profit; info.profit >= 0 ? stats.w++ : stats.l++;
    history.unshift(info);
    if (history.length > 40) history.pop();
    feed && feed.chart.setLines([]);
    UI.toast((info.profit >= 0 ? '✓ WIN ' : '✗ LOSS ') + UI.signed(info.profit, info.currency) + ' · ' + info.symbol, info.profit >= 0 ? 'success' : 'error');
    renderHistory();
    startProposal();
  }

  function renderHistory() {
    const box = $('history');
    $('stats').textContent = (stats.w + stats.l) + ' trades · W ' + stats.w + ' / L ' + stats.l + ' · P/L ' + UI.signed(stats.pl);
    if (!history.length) { box.innerHTML = '<div class="pos-empty">No trades yet</div>'; return; }
    box.innerHTML = history.map(function (h) {
      return '<div class="hist-row hist-5"><span>' + UI.esc(UI.timeStr(h.purchase_time)) + '</span><span>' + UI.esc(h.symbol) + '</span>'
        + '<span>' + UI.esc(Deriv.fmt(h.buy_price, h.currency)) + '</span>'
        + '<span class="' + (h.profit >= 0 ? 'up' : 'down') + '">' + UI.esc(UI.signed(h.profit, h.currency)) + '</span>'
        + '<span>' + UI.esc(h.tick_passed != null ? h.tick_passed : '—') + '</span></div>';
    }).join('');
  }

  /* ── lifecycle ── */
  async function init() {
    if (inited) return;
    inited = true;

    UI.mountAccountPill($('pill'));
    tracker = new UI.PositionTracker($('positions'), {
      adoptFilter: function (p) { return p.contract_type === 'ACCU'; },
      onUpdate: onUpdate, onSettled: onSettled, extra: extra, emptyText: 'No open accumulators',
    });
    feed = new UI.MarketFeed({
      select: $('symbol'), canvas: $('chart'), priceEl: $('price'),
      contractTypes: ['ACCU'], count: 120, chartMax: 120, preferred: '1HZ100V',
      onSymbol: function () { feed.chart.setBand(NaN, NaN); lastProposal = null; if (visible) scheduleProposal(); },
    });

    $('growth').addEventListener('click', function (e) {
      const b = e.target.closest('.t-pill'); if (!b) return;
      document.querySelectorAll('#ac-growth .t-pill').forEach(function (x) { x.classList.toggle('active', x === b); });
      scheduleProposal();
    });
    $('stake').addEventListener('input', scheduleProposal);
    $('tp').addEventListener('input', scheduleProposal);
    $('tp-on').addEventListener('change', function () {
      $('tp-wrap').style.display = $('tp-on').checked ? '' : 'none';
      scheduleProposal();
    });
    $('buy').addEventListener('click', buy);

    Deriv.on('socket', function (s) {
      if (s.name === 'trade') {
        updateButton();
        if (s.status === 'open') { if (visible) { tracker.adopt(); startProposal(); } }
        if (s.status === 'closed' && visible) startProposal();   // fall back to public pricing
      }
    });
    Deriv.on('auth', function (a) {
      updateButton();
      if (!a.authed) tracker.clearAll();
      if (visible) scheduleProposal();
    });
    Deriv.on('account', function () { tracker.clearAll(); if (visible) scheduleProposal(); });

    await feed.loadSymbols();
    updateButton();
    if (visible) { feed.start(); startProposal(); }
  }

  function show() {
    visible = true;
    init().then(function () {
      if (!visible) return;
      feed.start();
      startProposal();
      if (Deriv.trade.isOpen()) tracker.adopt();
      updateButton();
    });
  }

  function hide() {
    visible = false;
    stopProposal();
    if (feed) feed.stop();
  }

  return { id: ID, build: build, show: show, hide: hide };
})();
