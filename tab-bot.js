/**
 * tab-bot.js — Bot template (strategy builder + runner)
 *
 * Three "blocks":  1 Trade parameters · 2 Purchase conditions · 3 Restart / risk conditions
 * Trade types: Rise/Fall · Even/Odd · Over/Under · Matches/Differs · Accumulators
 * Entry conditions: every tick · tick streak · last-digit rule · price vs SMA · RSI(14)
 * Money management: martingale (multiplier, max steps), reset on win, session TP / SL, max trades, cooldown
 * Accumulators: auto-close at profit % of stake and/or after N ticks
 * The bot keeps running when you switch tabs. Strategy can be saved, exported and imported.
 */
const BotTab = (function () {
  const ID = 'tab-bot';
  const LS_CFG = 'jahim_bot_cfg_v2';
  const $ = function (s) { return document.getElementById('bt-' + s); };

  let inited = false, visible = false;
  let tracker = null, tickSub = null, loadedSymbols = false;

  const run = {
    on: false, busy: false, ticks: [], pip: 2, symbol: '', cfg: null,
    stake: 0, step: 0, n: 0, w: 0, l: 0, pl: 0, staked: 0,
    lastEnd: 0, currentId: null, selling: false, errors: 0, cooldownT: null,
  };
  const journal = [];
  const trades = [];

  const SIDES = {
    RISEFALL:  [['up', 'Rise'], ['down', 'Fall'], ['follow', 'Follow signal'], ['reverse', 'Reverse signal']],
    EVENODD:   [['DIGITEVEN', 'Even'], ['DIGITODD', 'Odd']],
    OVERUNDER: [['DIGITOVER', 'Over'], ['DIGITUNDER', 'Under']],
    MATCHDIFF: [['DIGITMATCH', 'Matches'], ['DIGITDIFF', 'Differs']],
  };

  /* ───────────────────────── markup ───────────────────────── */
  function build() {
    return `
<div id="${ID}" class="tab-content">
  <div class="t-wrap">
    <div class="t-head">
      <div>
        <h2 class="t-title">🤖 Bot</h2>
        <p class="t-sub">Build an automated strategy from three blocks, then run it. Test on a <b>demo</b> account first — automated trading can lose money quickly.</p>
      </div>
      <div id="bt-pill"></div>
    </div>

    <div class="t-grid bot-grid">
      <div class="t-main">

        <div class="bot-block b1">
          <div class="bot-block-h"><span>1</span> Trade parameters</div>
          <div class="bot-block-b">
            <div class="t-row3">
              <div class="t-field"><label>Market</label><select id="bt-symbol" class="t-select"><option>Loading…</option></select></div>
              <div class="t-field"><label>Trade type</label>
                <select id="bt-type" class="t-select">
                  <option value="RISEFALL">Rise / Fall</option>
                  <option value="EVENODD">Even / Odd</option>
                  <option value="OVERUNDER">Over / Under</option>
                  <option value="MATCHDIFF">Matches / Differs</option>
                  <option value="ACCU">Accumulators</option>
                </select></div>
              <div class="t-field" data-types="RISEFALL EVENODD OVERUNDER MATCHDIFF"><label>Contract</label><select id="bt-side" class="t-select"></select></div>
            </div>
            <div class="t-row3">
              <div class="t-field"><label>Stake <span class="t-cur" id="bt-cur">USD</span></label><input id="bt-stake" class="t-input" type="number" min="0.35" step="0.01" value="1"></div>
              <div class="t-field" data-types="RISEFALL EVENODD OVERUNDER MATCHDIFF"><label>Duration (ticks)</label><input id="bt-dur" class="t-input" type="number" min="1" max="10" step="1" value="5"></div>
              <div class="t-field" data-types="OVERUNDER MATCHDIFF"><label>Digit (0–9)</label><input id="bt-digit" class="t-input" type="number" min="0" max="9" step="1" value="5"></div>
              <div class="t-field" data-types="ACCU"><label>Growth rate</label>
                <select id="bt-growth" class="t-select"><option value="0.01">1%</option><option value="0.02">2%</option><option value="0.03">3%</option><option value="0.04">4%</option><option value="0.05">5%</option></select></div>
              <div class="t-field" data-types="ACCU"><label>Close at profit (% of stake)</label><input id="bt-atp" class="t-input" type="number" min="0" step="1" value="10"></div>
              <div class="t-field" data-types="ACCU"><label>…or after N ticks (0 = off)</label><input id="bt-amax" class="t-input" type="number" min="0" step="1" value="0"></div>
            </div>
          </div>
        </div>

        <div class="bot-block b2">
          <div class="bot-block-h"><span>2</span> Purchase conditions</div>
          <div class="bot-block-b">
            <div class="t-row3">
              <div class="t-field"><label>Buy when</label>
                <select id="bt-entry" class="t-select">
                  <option value="any">Every time (no condition)</option>
                  <option value="streak">N ticks in a row go…</option>
                  <option value="digit">Last digit rule…</option>
                  <option value="sma">Price vs SMA…</option>
                  <option value="rsi">RSI (14) threshold…</option>
                </select></div>
              <div class="t-field" data-entry="streak"><label>Ticks in a row</label><input id="bt-streakn" class="t-input" type="number" min="2" max="10" value="3"></div>
              <div class="t-field" data-entry="streak"><label>Direction</label><select id="bt-streakdir" class="t-select"><option value="up">Rising</option><option value="down">Falling</option></select></div>
              <div class="t-field" data-entry="digit"><label>Last digit is</label>
                <select id="bt-digitop" class="t-select"><option value="eq">equal to</option><option value="ne">not equal to</option><option value="gt">greater than</option><option value="lt">less than</option><option value="even">even</option><option value="odd">odd</option></select></div>
              <div class="t-field" data-entry="digit"><label>Digit</label><input id="bt-digitval" class="t-input" type="number" min="0" max="9" value="5"></div>
              <div class="t-field" data-entry="sma"><label>SMA period</label><input id="bt-smap" class="t-input" type="number" min="2" max="100" value="20"></div>
              <div class="t-field" data-entry="sma"><label>Price is</label><select id="bt-smapos" class="t-select"><option value="above">above SMA</option><option value="below">below SMA</option></select></div>
              <div class="t-field" data-entry="rsi"><label>Oversold ≤ (rise)</label><input id="bt-rsilo" class="t-input" type="number" min="1" max="49" value="30"></div>
              <div class="t-field" data-entry="rsi"><label>Overbought ≥ (fall)</label><input id="bt-rsihi" class="t-input" type="number" min="51" max="99" value="70"></div>
            </div>
            <div class="t-note" id="bt-entry-note"></div>
          </div>
        </div>

        <div class="bot-block b3">
          <div class="bot-block-h"><span>3</span> Restart &amp; risk conditions</div>
          <div class="bot-block-b">
            <div class="t-row3">
              <div class="t-field"><label class="t-switch-row"><span>Martingale on loss</span><span class="t-switch"><input type="checkbox" id="bt-mart"><i></i></span></label></div>
              <div class="t-field"><label>Multiplier ×</label><input id="bt-mult" class="t-input" type="number" min="1" step="0.1" value="2"></div>
              <div class="t-field"><label>Max steps</label><input id="bt-steps" class="t-input" type="number" min="1" step="1" value="4"></div>
            </div>
            <div class="t-row3">
              <div class="t-field"><label>Take profit (session) <span class="t-cur" id="bt-cur2">USD</span></label><input id="bt-tp" class="t-input" type="number" min="0" step="0.5" value="5"></div>
              <div class="t-field"><label>Stop loss (session) <span class="t-cur" id="bt-cur3">USD</span></label><input id="bt-sl" class="t-input" type="number" min="0" step="0.5" value="5"></div>
              <div class="t-field"><label>Max trades (0 = ∞)</label><input id="bt-max" class="t-input" type="number" min="0" step="1" value="0"></div>
            </div>
            <div class="t-row3">
              <div class="t-field"><label>Cooldown between trades (s)</label><input id="bt-cool" class="t-input" type="number" min="0" step="1" value="2"></div>
              <div class="t-field"><label class="t-switch-row"><span>Reset stake after a win</span><span class="t-switch"><input type="checkbox" id="bt-reset" checked><i></i></span></label></div>
              <div class="t-field"></div>
            </div>
            <div class="t-note">Take profit / stop loss are measured over this run. A value of 0 turns that limit off.</div>
          </div>
        </div>

        <div class="t-card">
          <div class="t-card-h"><span class="t-card-title">Journal</span><button type="button" class="t-btn-mini" id="bt-clearlog">Clear</button></div>
          <div class="t-card-b"><div class="bot-journal" id="bt-journal"><div class="pos-empty">Nothing yet — press Run</div></div></div>
        </div>

        <div class="t-card">
          <div class="t-card-h"><span class="t-card-title">Transactions</span></div>
          <div class="t-card-b nopad">
            <div class="hist-head hist-6"><span>Time</span><span>Type</span><span>Entry</span><span>Exit</span><span>Stake</span><span>Profit</span></div>
            <div id="bt-trades" class="hist-body"><div class="pos-empty">No trades yet</div></div>
          </div>
        </div>
      </div>

      <div class="t-side">
        <div class="t-card sticky">
          <div class="t-card-h"><span class="t-card-title">Run</span><span class="bot-state off" id="bt-state">STOPPED</span></div>
          <div class="t-card-b">
            <div class="bot-live"><span id="bt-livesym">—</span><b id="bt-liveprice">—</b><em id="bt-livedigit"></em></div>
            <div class="bot-stats">
              <div><label>Profit / loss</label><b id="bt-s-pl">0.00</b></div>
              <div><label>Runs</label><b id="bt-s-n">0</b></div>
              <div><label>Won / Lost</label><b id="bt-s-wl">0 / 0</b></div>
              <div><label>Total stake</label><b id="bt-s-staked">0.00</b></div>
              <div><label>Next stake</label><b id="bt-s-stake">—</b></div>
              <div><label>Martingale step</label><b id="bt-s-step">0</b></div>
            </div>
            <div class="err-line" id="bt-err"></div>
            <div class="t-btnrow">
              <button id="bt-run" type="button" class="t-btn t-btn-rise">▶ Run</button>
              <button id="bt-stop" type="button" class="t-btn t-btn-fall" disabled>■ Stop</button>
            </div>
            <div class="t-field" style="margin-top:14px"><label>Current contract</label><div id="bt-positions" class="pos-list"></div></div>
            <div class="bot-cfgbar">
              <button type="button" class="t-btn-mini" id="bt-save">Save</button>
              <button type="button" class="t-btn-mini" id="bt-load">Load</button>
              <button type="button" class="t-btn-mini" id="bt-export">Export</button>
              <button type="button" class="t-btn-mini" id="bt-import">Import</button>
              <input type="file" id="bt-file" accept="application/json,.json" hidden>
            </div>
          </div>
        </div>
      </div>
    </div>
  </div>
</div>`;
  }

  /* ───────────────────────── config ───────────────────────── */
  const FIELDS = ['symbol', 'type', 'side', 'stake', 'dur', 'digit', 'growth', 'atp', 'amax', 'entry', 'streakn', 'streakdir',
                  'digitop', 'digitval', 'smap', 'smapos', 'rsilo', 'rsihi', 'steps', 'mult', 'tp', 'sl', 'max', 'cool'];
  const CHECKS = ['mart', 'reset'];

  function readCfg() {
    const c = {};
    FIELDS.forEach(function (f) { c[f] = $(f).value; });
    CHECKS.forEach(function (f) { c[f] = $(f).checked; });
    return c;
  }

  function writeCfg(c) {
    if (c.type) { $('type').value = c.type; refreshSides(); }
    FIELDS.forEach(function (f) {
      if (c[f] == null || f === 'type') return;
      const el = $(f);
      if (el.tagName === 'SELECT' && !Array.prototype.some.call(el.options, function (o) { return o.value === String(c[f]); })) return;
      el.value = c[f];
    });
    CHECKS.forEach(function (f) { if (c[f] != null) $(f).checked = !!c[f]; });
    applyVisibility();
  }

  function numCfg(c) {
    return {
      type: c.type, symbol: c.symbol, side: c.side, entry: c.entry,
      stake: parseFloat(c.stake), dur: parseInt(c.dur, 10), digit: parseInt(c.digit, 10),
      growth: parseFloat(c.growth), atp: parseFloat(c.atp), amax: parseInt(c.amax, 10) || 0,
      streakn: parseInt(c.streakn, 10), streakdir: c.streakdir, digitop: c.digitop, digitval: parseInt(c.digitval, 10),
      smap: parseInt(c.smap, 10), smapos: c.smapos, rsilo: parseFloat(c.rsilo), rsihi: parseFloat(c.rsihi),
      mart: !!c.mart, mult: parseFloat(c.mult), steps: parseInt(c.steps, 10), reset: !!c.reset,
      tp: parseFloat(c.tp) || 0, sl: parseFloat(c.sl) || 0, max: parseInt(c.max, 10) || 0, cool: Math.max(0, parseFloat(c.cool) || 0),
    };
  }

  function validateCfg(c) {
    if (!c.symbol) return 'Pick a market';
    if (!isFinite(c.stake) || c.stake <= 0) return 'Stake must be above 0';
    if (c.type !== 'ACCU' && (!isFinite(c.dur) || c.dur < 1 || c.dur > 10)) return 'Duration must be 1–10 ticks';
    if ((c.type === 'OVERUNDER' || c.type === 'MATCHDIFF') && !(c.digit >= 0 && c.digit <= 9)) return 'Digit must be 0–9';
    if (c.mart && (!isFinite(c.mult) || c.mult < 1)) return 'Martingale multiplier must be at least 1';
    if (c.mart && (!isFinite(c.steps) || c.steps < 1)) return 'Martingale max steps must be at least 1';
    if (c.entry === 'streak' && !(c.streakn >= 2)) return 'Streak length must be at least 2';
    if (c.entry === 'sma' && !(c.smap >= 2)) return 'SMA period must be at least 2';
    if (c.entry === 'digit' && (c.digitop === 'eq' || c.digitop === 'ne' || c.digitop === 'gt' || c.digitop === 'lt') && !(c.digitval >= 0 && c.digitval <= 9)) return 'Entry digit must be 0–9';
    if (c.type === 'RISEFALL' && (c.side === 'follow' || c.side === 'reverse') && (c.entry === 'any' || c.entry === 'digit')) {
      return '"' + (c.side === 'follow' ? 'Follow' : 'Reverse') + ' signal" needs a streak, SMA or RSI condition (they give a direction)';
    }
    return '';
  }

  function applyVisibility() {
    const t = $('type').value, e = $('entry').value;
    document.querySelectorAll('#tab-bot [data-types]').forEach(function (el) {
      el.style.display = el.getAttribute('data-types').split(' ').indexOf(t) >= 0 ? '' : 'none';
    });
    document.querySelectorAll('#tab-bot [data-entry]').forEach(function (el) {
      el.style.display = el.getAttribute('data-entry') === e ? '' : 'none';
    });
    const notes = {
      any: 'Buys as soon as the previous contract has finished (after the cooldown).',
      streak: 'Looks at the most recent ticks; fires when they all moved the same way.',
      digit: 'Looks at the last digit of the latest tick.',
      sma: 'Compares the latest price with the simple moving average of the last N ticks.',
      rsi: 'RSI(14) on tick prices. Oversold gives a Rise signal, overbought a Fall signal.',
    };
    $('entry-note').textContent = notes[e] || '';
  }

  function refreshSides() {
    const t = $('type').value, sel = $('side');
    const list = SIDES[t] || [];
    const prev = sel.value;
    sel.innerHTML = list.map(function (o) { return '<option value="' + o[0] + '">' + o[1] + '</option>'; }).join('');
    if (list.some(function (o) { return o[0] === prev; })) sel.value = prev;
  }

  /* ───────────────────────── indicators / signals ───────────────────────── */
  function sma(a, n) {
    if (a.length < n) return null;
    let s = 0; for (let i = a.length - n; i < a.length; i++) s += a[i];
    return s / n;
  }

  function rsi(a, n) {
    n = n || 14;
    if (a.length < n + 1) return null;
    let g = 0, l = 0;
    for (let i = a.length - n; i < a.length; i++) {
      const d = a[i] - a[i - 1];
      if (d > 0) g += d; else l -= d;
    }
    if (g + l === 0) return 50;
    return 100 - 100 / (1 + g / (l || 1e-12));
  }

  /** -> {ok:boolean, dir:'up'|'down'|null} */
  function evaluate(c) {
    const t = run.ticks, last = t[t.length - 1];
    if (last == null) return { ok: false };
    switch (c.entry) {
      case 'any': return { ok: true, dir: null };
      case 'streak': {
        if (t.length < c.streakn + 1) return { ok: false };
        for (let i = t.length - c.streakn; i < t.length; i++) {
          const d = t[i] - t[i - 1];
          if (c.streakdir === 'up' ? !(d > 0) : !(d < 0)) return { ok: false };
        }
        return { ok: true, dir: c.streakdir };
      }
      case 'digit': {
        const d = Deriv.lastDigit(last, run.pip);
        const v = c.digitval;
        const ok = c.digitop === 'eq' ? d === v : c.digitop === 'ne' ? d !== v : c.digitop === 'gt' ? d > v :
                   c.digitop === 'lt' ? d < v : c.digitop === 'even' ? d % 2 === 0 : d % 2 === 1;
        return { ok: ok, dir: null };
      }
      case 'sma': {
        const m = sma(t, c.smap);
        if (m == null) return { ok: false };
        const above = last > m, below = last < m;
        if (c.smapos === 'above' && above) return { ok: true, dir: 'up' };
        if (c.smapos === 'below' && below) return { ok: true, dir: 'down' };
        return { ok: false };
      }
      case 'rsi': {
        const r = rsi(t, 14);
        if (r == null) return { ok: false };
        if (r <= c.rsilo) return { ok: true, dir: 'up' };
        if (r >= c.rsihi) return { ok: true, dir: 'down' };
        return { ok: false };
      }
    }
    return { ok: false };
  }

  /** Builds the proposal/buy parameters for the next trade (or null if the signal gives no usable direction). */
  function contractParams(c, sig) {
    const p = { amount: round2(run.stake), basis: 'stake', currency: Deriv.currency(), underlying_symbol: c.symbol };
    if (c.type === 'ACCU') { p.contract_type = 'ACCU'; p.growth_rate = c.growth; return p; }
    p.duration = c.dur; p.duration_unit = 't';
    if (c.type === 'RISEFALL') {
      let dir = c.side;
      if (dir === 'follow') dir = sig.dir;
      else if (dir === 'reverse') dir = sig.dir ? (sig.dir === 'up' ? 'down' : 'up') : null;
      if (!dir) return null;
      p.contract_type = dir === 'up' ? 'CALL' : 'PUT';
      return p;
    }
    p.contract_type = c.side;
    if (c.type === 'OVERUNDER' || c.type === 'MATCHDIFF') p.barrier = String(c.digit);
    return p;
  }

  function round2(n) { return Math.round(n * 100) / 100; }

  /* ───────────────────────── engine ───────────────────────── */
  function log(msg, cls) {
    journal.unshift({ t: UI.timeStr(), msg: msg, cls: cls || '' });
    if (journal.length > 150) journal.pop();
    renderJournal();
  }

  function renderJournal() {
    const box = $('journal');
    if (!journal.length) { box.innerHTML = '<div class="pos-empty">Nothing yet — press Run</div>'; return; }
    box.innerHTML = journal.map(function (j) {
      return '<div class="jl ' + j.cls + '"><time>' + UI.esc(j.t) + '</time><span>' + UI.esc(j.msg) + '</span></div>';
    }).join('');
  }

  function setState(on) {
    run.on = on;
    const st = $('state');
    st.textContent = on ? 'RUNNING' : 'STOPPED';
    st.className = 'bot-state ' + (on ? 'on' : 'off');
    $('run').disabled = on; $('stop').disabled = !on;
    document.querySelectorAll('#tab-bot .bot-block input, #tab-bot .bot-block select').forEach(function (el) { el.disabled = on; });
  }

  function paintStats() {
    const cur = Deriv.currency();
    const pl = $('s-pl');
    pl.textContent = UI.signed(run.pl, cur); pl.className = run.pl > 0 ? 'up' : run.pl < 0 ? 'down' : '';
    $('s-n').textContent = run.n; $('s-wl').textContent = run.w + ' / ' + run.l;
    $('s-staked').textContent = Deriv.fmt(run.staked, cur);
    $('s-stake').textContent = run.on ? Deriv.fmt(run.stake, cur) : '—';
    $('s-step').textContent = run.step;
    ['cur', 'cur2', 'cur3'].forEach(function (k) { $(k).textContent = cur; });
  }

  function start() {
    $('err').textContent = '';
    if (!Deriv.isAuthed()) { Deriv.login().catch(function (e) { UI.toast(UI.friendlyError(e), 'error'); }); return; }
    if (!Deriv.trade.isOpen()) { $('err').textContent = 'Trading connection is not ready yet — try again in a moment.'; return; }
    const c = numCfg(readCfg());
    const bad = validateCfg(c);
    if (bad) { $('err').textContent = bad; return; }
    const a = Deriv.active();
    if (a && a.type === 'real') {
      const ok = window.confirm('You are about to run this bot on your REAL account (' + a.id + ').\n\nIt will place trades automatically with real money until it hits a limit or you press Stop.\n\nContinue?');
      if (!ok) return;
    }
    run.cfg = c; run.symbol = c.symbol; run.stake = c.stake; run.step = 0;
    run.n = run.w = run.l = 0; run.pl = 0; run.staked = 0; run.busy = false; run.lastEnd = 0;
    run.currentId = null; run.selling = false; run.errors = 0; run.ticks = [];
    setState(true); paintStats();
    $('livesym').textContent = c.symbol;
    log('Bot started on ' + (a ? a.id : '') + ' · ' + c.type + ' · ' + c.symbol + ' · stake ' + Deriv.fmt(c.stake), 'info');

    if (tickSub) tickSub.forget();
    tickSub = Deriv.streamTicks(c.symbol, 120,
      function (h) { run.pip = h.pip; run.ticks = h.prices.map(Number); },
      onTick,
      function (e) { log('Tick stream error: ' + UI.friendlyError(e), 'err'); }
    );
  }

  function stop(reason) {
    if (!run.on) return;
    setState(false);
    clearTimeout(run.cooldownT);
    if (tickSub) { tickSub.forget(); tickSub = null; }
    paintStats();
    log('Bot stopped' + (reason ? ' — ' + reason : '') + (run.currentId ? ' (open contract #' + run.currentId + ' will still settle)' : ''), 'warn');
    if (reason) UI.toast('Bot stopped — ' + reason, 'warning');
  }

  function onTick(t) {
    run.pip = t.pip || run.pip;
    run.ticks.push(t.quote);
    if (run.ticks.length > 300) run.ticks.shift();
    $('liveprice').textContent = t.quote.toFixed(run.pip);
    $('livedigit').textContent = 'digit ' + Deriv.lastDigit(t.quote, run.pip);

    if (!run.on || run.busy) return;
    const c = run.cfg;
    if (Date.now() - run.lastEnd < c.cool * 1000) return;
    if (c.max && run.n >= c.max) { stop('max trades reached'); return; }
    const sig = evaluate(c);
    if (!sig.ok) return;
    const p = contractParams(c, sig);
    if (!p) return;
    place(p, sig);
  }

  async function place(p, sig) {
    run.busy = true;
    if (p.amount > (Deriv.active() ? Deriv.active().balance : Infinity)) {
      log('Stake ' + Deriv.fmt(p.amount) + ' is above your balance', 'err');
      run.busy = false; stop('stake exceeds balance'); return;
    }
    try {
      const b = await Deriv.buyContract(p);
      run.errors = 0;
      run.currentId = b.contract_id; run.selling = false;
      run.staked += Number(b.buy_price) || p.amount;
      log('Bought ' + p.contract_type + (p.barrier ? ' @' + p.barrier : '') + ' #' + b.contract_id + ' for ' + Deriv.fmt(Number(b.buy_price)), 'info');
      paintStats();
      tracker.track(b.contract_id);
      /* run.busy stays true until the contract settles */
    } catch (e) {
      run.busy = false; run.lastEnd = Date.now();
      run.errors++;
      log('Buy failed: ' + UI.friendlyError(e), 'err');
      if (e.code === 'buy_unknown') { stop('a buy may or may not have gone through — check your statement'); return; }
      if (e.code === 'not_connected' || e.code === 'not_authed') { stop('connection lost'); return; }
      if (run.errors >= 3) stop('3 failed buys in a row: ' + UI.friendlyError(e));
    }
  }

  function onPositionUpdate(poc) {
    const c = run.cfg;
    if (!c || c.type !== 'ACCU' || poc.contract_type !== 'ACCU' || String(poc.contract_id) !== String(run.currentId)) return;
    if (run.selling || poc.is_sold === 1 || poc.is_valid_to_sell !== 1) return;
    const profit = Number(poc.profit), stake = Number(poc.buy_price);
    const hitTp = c.atp > 0 && isFinite(profit) && profit >= (stake * c.atp) / 100;
    const hitTicks = c.amax > 0 && Number(poc.tick_passed) >= c.amax;
    if (hitTp || hitTicks) {
      run.selling = true;
      log('Closing accumulator #' + poc.contract_id + (hitTp ? ' (profit target)' : ' (tick limit)'), 'info');
      Deriv.sellContract(poc.contract_id).catch(function (e) {
        log('Close failed: ' + UI.friendlyError(e), 'err');
        run.selling = false;
      });
    }
  }

  function onSettled(info) {
    trades.unshift(info);
    if (trades.length > 60) trades.pop();
    renderTrades();
    if (String(info.contract_id) !== String(run.currentId)) return;   // an adopted/old contract, not the bot's

    run.currentId = null; run.selling = false;
    run.n++; run.pl += info.profit;
    const win = info.profit >= 0;
    win ? run.w++ : run.l++;
    log((win ? 'WIN ' : 'LOSS ') + UI.signed(info.profit, info.currency) + ' · #' + info.contract_id, win ? 'win' : 'loss');

    const c = run.cfg;
    if (win) {
      if (c.reset) { run.stake = c.stake; run.step = 0; }
    } else if (c.mart) {
      run.step++;
      if (run.step > c.steps) { run.step = 0; run.stake = c.stake; log('Martingale max steps reached — stake reset', 'warn'); }
      else run.stake = round2(c.stake * Math.pow(c.mult, run.step));
    }
    paintStats();
    run.lastEnd = Date.now();
    run.busy = false;

    if (!run.on) return;
    if (c.tp && run.pl >= c.tp) stop('take profit reached (' + UI.signed(run.pl, info.currency) + ')');
    else if (c.sl && run.pl <= -c.sl) stop('stop loss reached (' + UI.signed(run.pl, info.currency) + ')');
    else if (c.max && run.n >= c.max) stop('max trades reached');
  }

  function renderTrades() {
    const box = $('trades');
    if (!trades.length) { box.innerHTML = '<div class="pos-empty">No trades yet</div>'; return; }
    box.innerHTML = trades.map(function (h) {
      return '<div class="hist-row hist-6"><span>' + UI.esc(UI.timeStr(h.purchase_time)) + '</span><span>' + UI.esc(String(h.contract_type).replace('DIGIT', '')) + '</span>'
        + '<span>' + UI.esc(h.entry_spot || '—') + '</span><span>' + UI.esc(h.exit_spot || '—') + '</span>'
        + '<span>' + UI.esc(Deriv.fmt(h.buy_price, h.currency)) + '</span>'
        + '<span class="' + (h.profit >= 0 ? 'up' : 'down') + '">' + UI.esc(UI.signed(h.profit, h.currency)) + '</span></div>';
    }).join('');
  }

  /* ───────────────────────── save / load ───────────────────────── */
  function saveCfg() {
    try { localStorage.setItem(LS_CFG, JSON.stringify(readCfg())); UI.toast('Strategy saved in this browser', 'success'); }
    catch (e) { UI.toast('Could not save: ' + UI.friendlyError(e), 'error'); }
  }
  function loadCfg(silent) {
    try {
      const raw = localStorage.getItem(LS_CFG);
      if (!raw) { if (!silent) UI.toast('No saved strategy yet', 'warning'); return; }
      writeCfg(JSON.parse(raw));
      if (!silent) UI.toast('Strategy loaded', 'success');
    } catch (e) { if (!silent) UI.toast('Could not load strategy', 'error'); }
  }
  function exportCfg() {
    const blob = new Blob([JSON.stringify(readCfg(), null, 2)], { type: 'application/json' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob); a.download = 'jahim-bot-strategy.json';
    document.body.appendChild(a); a.click(); a.remove();
    setTimeout(function () { URL.revokeObjectURL(a.href); }, 1000);
  }
  function importCfg(file) {
    if (!file) return;
    const r = new FileReader();
    r.onload = function () {
      try { const c = JSON.parse(r.result); if (!c || typeof c !== 'object') throw new Error('bad file'); writeCfg(c); UI.toast('Strategy imported', 'success'); }
      catch (e) { UI.toast('That file is not a valid strategy', 'error'); }
    };
    r.readAsText(file);
  }

  /* ───────────────────────── lifecycle ───────────────────────── */
  async function loadSymbols() {
    try {
      const list = await Deriv.activeSymbols();
      UI.fillSymbolSelect($('symbol'), list, 'R_100');
      loadedSymbols = true;
      loadCfg(true);
    } catch (e) {
      $('symbol').innerHTML = '<option value="">Could not load markets</option>';
      UI.toast('Could not load markets: ' + UI.friendlyError(e), 'error');
    }
  }

  async function init() {
    if (inited) return;
    inited = true;
    UI.mountAccountPill($('pill'));
    tracker = new UI.PositionTracker($('positions'), {
      onUpdate: onPositionUpdate, onSettled: onSettled, emptyText: 'No open contract',
      extra: function (p) {
        return '<div><label>Entry</label><b>' + UI.esc(p.entry_spot || '—') + '</b></div>'
             + '<div><label>Current</label><b>' + UI.esc(p.current_spot || p.exit_spot || '—') + '</b></div>'
             + (p.tick_passed != null ? '<div><label>Ticks in</label><b>' + UI.esc(p.tick_passed) + '</b></div>' : '');
      },
    });

    refreshSides(); applyVisibility();
    $('type').addEventListener('change', function () { refreshSides(); applyVisibility(); });
    $('entry').addEventListener('change', applyVisibility);
    $('run').addEventListener('click', start);
    $('stop').addEventListener('click', function () { stop('stopped by you'); });
    $('clearlog').addEventListener('click', function () { journal.length = 0; renderJournal(); });
    $('save').addEventListener('click', saveCfg);
    $('load').addEventListener('click', function () { loadCfg(false); });
    $('export').addEventListener('click', exportCfg);
    $('import').addEventListener('click', function () { $('file').click(); });
    $('file').addEventListener('change', function () { importCfg($('file').files[0]); $('file').value = ''; });

    Deriv.on('socket', function (s) {
      if (s.name === 'trade' && s.status === 'open' && !run.on) tracker.adopt();
    });
    Deriv.on('auth', function (a) { if (!a.authed) { stop('logged out'); tracker.clearAll(); } paintStats(); });
    Deriv.on('account', function () { if (run.on) stop('account changed'); tracker.clearAll(); paintStats(); });
    Deriv.on('balance', paintStats);

    window.addEventListener('beforeunload', function (e) {
      if (run.on) { e.preventDefault(); e.returnValue = ''; }
    });

    await loadSymbols();
    paintStats();
  }

  function show() { visible = true; init(); paintStats(); }
  function hide() { visible = false; }   /* the bot keeps running in the background */

  return { id: ID, build: build, show: show, hide: hide };
})();
