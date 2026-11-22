/**
 * shared-ui.js — building blocks used by every template tab
 *   toast · esc · TickChart · fillSymbolSelect · mountAccountPill · PositionTracker · stake steppers
 */
(function (global) {
  'use strict';

  /* ───────────────────────── basics ───────────────────────── */
  function esc(s) {
    return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c];
    });
  }

  function toast(msg, type) {
    const box = document.getElementById('toast-container');
    if (!box) return;
    const el = document.createElement('div');
    el.className = 'jt-toast ' + (type || 'info');
    el.textContent = msg;
    box.appendChild(el);
    setTimeout(function () { if (el.parentNode) el.parentNode.removeChild(el); }, 4800);
  }

  function num(el, fallback) {
    const v = parseFloat(el && el.value);
    return isFinite(v) ? v : (fallback == null ? NaN : fallback);
  }

  function signed(n, cur) {
    if (typeof n !== 'number' || !isFinite(n)) return '—';
    return (n >= 0 ? '+' : '−') + Deriv.fmt(Math.abs(n), cur);
  }

  function timeStr(epoch) {
    const d = epoch ? new Date(epoch * 1000) : new Date();
    return d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' });
  }

  function cssVar(name) {
    return getComputedStyle(document.documentElement).getPropertyValue(name).trim();
  }

  function friendlyError(e) {
    if (!e) return 'Something went wrong';
    return e.message || String(e);
  }

  /* delegated +/- stepper buttons: <button data-step="-1" data-target="inputId"> */
  document.addEventListener('click', function (e) {
    const b = e.target.closest && e.target.closest('[data-step]');
    if (!b) return;
    const inp = document.getElementById(b.getAttribute('data-target'));
    if (!inp) return;
    const step = parseFloat(b.getAttribute('data-step'));
    const min = inp.min !== '' ? parseFloat(inp.min) : -Infinity;
    const max = inp.max !== '' ? parseFloat(inp.max) : Infinity;
    const dec = (inp.step && inp.step.indexOf('.') >= 0) ? inp.step.split('.')[1].length : 0;
    let v = (parseFloat(inp.value) || 0) + step;
    v = Math.min(max, Math.max(min, v));
    inp.value = v.toFixed(dec);
    inp.dispatchEvent(new Event('input', { bubbles: true }));
    inp.dispatchEvent(new Event('change', { bubbles: true }));
  });

  /* ───────────────────────── tick chart ───────────────────────── */
  class TickChart {
    constructor(canvas, opts) {
      opts = opts || {};
      this.cv = canvas;
      this.ctx = canvas && canvas.getContext ? canvas.getContext('2d') : null;
      this.max = opts.max || 150;
      this.data = [];            // [{t,q}]
      this.pip = 2;
      this.band = null;          // {low,high}
      this.lines = [];           // [{y,label,color}]
      this._raf = null;
      const self = this;
      this._onResize = function () { self.draw(); };
      window.addEventListener('resize', this._onResize);
    }
    setHistory(prices, times, pip) {
      this.pip = pip || this.pip;
      this.data = prices.map(function (q, i) { return { t: times[i], q: Number(q) }; }).slice(-this.max);
      this.draw();
    }
    push(q, t, pip) {
      if (pip) this.pip = pip;
      this.data.push({ t: t, q: Number(q) });
      if (this.data.length > this.max) this.data.shift();
      this.draw();
    }
    clear() { this.data = []; this.band = null; this.lines = []; this.draw(); }
    setBand(low, high) { this.band = (isFinite(low) && isFinite(high)) ? { low: low, high: high } : null; this.draw(); }
    setLines(lines) { this.lines = lines || []; this.draw(); }

    draw() {
      if (this._raf) return;
      const self = this;
      this._raf = requestAnimationFrame(function () { self._raf = null; self._paint(); });
    }

    _paint() {
      const cv = this.cv, ctx = this.ctx;
      if (!cv || !ctx || !cv.clientWidth) return;
      const dpr = window.devicePixelRatio || 1;
      const W = cv.clientWidth, H = cv.clientHeight;
      if (cv.width !== Math.round(W * dpr) || cv.height !== Math.round(H * dpr)) {
        cv.width = Math.round(W * dpr); cv.height = Math.round(H * dpr);
      }
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      ctx.clearRect(0, 0, W, H);

      const accent = cssVar('--accent') || '#3b82f6';
      const muted  = cssVar('--text-muted') || '#7c8db5';
      const border = cssVar('--border') || '#1e2f4a';
      const text   = cssVar('--text-primary') || '#fff';

      const d = this.data;
      if (d.length < 2) {
        ctx.fillStyle = muted; ctx.font = '12px JetBrains Mono, monospace'; ctx.textAlign = 'center';
        ctx.fillText('Waiting for ticks…', W / 2, H / 2);
        return;
      }

      const padL = 8, padR = 64, padT = 14, padB = 14;
      let lo = Infinity, hi = -Infinity;
      d.forEach(function (p) { if (p.q < lo) lo = p.q; if (p.q > hi) hi = p.q; });
      if (this.band) { lo = Math.min(lo, this.band.low); hi = Math.max(hi, this.band.high); }
      this.lines.forEach(function (l) { if (isFinite(l.y)) { lo = Math.min(lo, l.y); hi = Math.max(hi, l.y); } });
      if (hi === lo) { hi += 1; lo -= 1; }
      const span = hi - lo; lo -= span * 0.08; hi += span * 0.08;

      const x = function (i) { return padL + (W - padL - padR) * (i / (d.length - 1)); };
      const y = function (v) { return padT + (H - padT - padB) * (1 - (v - lo) / (hi - lo)); };

      /* grid */
      ctx.strokeStyle = border; ctx.lineWidth = 1; ctx.globalAlpha = 0.5;
      for (let g = 0; g <= 4; g++) {
        const gy = padT + (H - padT - padB) * (g / 4);
        ctx.beginPath(); ctx.moveTo(padL, gy); ctx.lineTo(W - padR + 6, gy); ctx.stroke();
        ctx.globalAlpha = 0.9; ctx.fillStyle = muted; ctx.font = '10px JetBrains Mono, monospace'; ctx.textAlign = 'left';
        ctx.fillText((hi - (hi - lo) * (g / 4)).toFixed(this.pip), W - padR + 8, gy + 3);
        ctx.globalAlpha = 0.5;
      }
      ctx.globalAlpha = 1;

      /* barrier band (accumulators) */
      if (this.band) {
        const by1 = y(this.band.high), by2 = y(this.band.low);
        const bx = Math.max(padL, x(d.length - 1) - 90);
        ctx.fillStyle = 'rgba(16,185,129,0.12)';
        ctx.fillRect(bx, by1, W - padR + 6 - bx, by2 - by1);
        ctx.strokeStyle = 'rgba(16,185,129,0.8)'; ctx.setLineDash([5, 4]);
        ctx.beginPath(); ctx.moveTo(bx, by1); ctx.lineTo(W - padR + 6, by1); ctx.moveTo(bx, by2); ctx.lineTo(W - padR + 6, by2); ctx.stroke();
        ctx.setLineDash([]);
      }

      /* price line + fill */
      ctx.beginPath();
      d.forEach(function (p, i) { if (i) ctx.lineTo(x(i), y(p.q)); else ctx.moveTo(x(i), y(p.q)); });
      ctx.strokeStyle = accent; ctx.lineWidth = 1.8; ctx.lineJoin = 'round'; ctx.stroke();
      ctx.lineTo(x(d.length - 1), H - padB); ctx.lineTo(x(0), H - padB); ctx.closePath();
      const grad = ctx.createLinearGradient(0, padT, 0, H);
      grad.addColorStop(0, accent + '33'); grad.addColorStop(1, accent + '00');
      ctx.fillStyle = grad; ctx.fill();

      /* extra horizontal lines (entry etc.) */
      this.lines.forEach(function (l) {
        if (!isFinite(l.y)) return;
        const ly = y(l.y);
        ctx.strokeStyle = l.color || text; ctx.setLineDash([3, 3]); ctx.lineWidth = 1;
        ctx.beginPath(); ctx.moveTo(padL, ly); ctx.lineTo(W - padR + 6, ly); ctx.stroke(); ctx.setLineDash([]);
        if (l.label) { ctx.fillStyle = l.color || text; ctx.font = '10px JetBrains Mono, monospace'; ctx.textAlign = 'left'; ctx.fillText(l.label, padL + 4, ly - 3); }
      });

      /* last price tag + dot */
      const last = d[d.length - 1], ly = y(last.q), lx = x(d.length - 1);
      ctx.fillStyle = accent; ctx.beginPath(); ctx.arc(lx, ly, 3.5, 0, 7); ctx.fill();
      const tag = last.q.toFixed(this.pip);
      ctx.font = '700 10px JetBrains Mono, monospace';
      const tw = ctx.measureText(tag).width + 10;
      ctx.fillRect(W - padR + 6, ly - 8, tw, 16);
      ctx.fillStyle = '#fff'; ctx.textAlign = 'left'; ctx.fillText(tag, W - padR + 11, ly + 3);
    }
  }

  /* ───────────────────────── symbol <select> ───────────────────────── */
  const MARKET_LABEL = {
    synthetic_index: 'Derived indices', forex: 'Forex', indices: 'Stock indices',
    commodities: 'Commodities', cryptocurrency: 'Cryptocurrencies', stocks: 'Stocks',
  };
  function marketLabel(m) {
    return MARKET_LABEL[m] || String(m || 'Other').replace(/_/g, ' ').replace(/\b\w/g, function (c) { return c.toUpperCase(); });
  }

  function fillSymbolSelect(sel, list, preferred) {
    const prev = preferred || sel.value;
    const groups = {};
    list.forEach(function (s) { (groups[s.market] = groups[s.market] || []).push(s); });
    const order = Object.keys(groups).sort(function (a, b) {
      if (a === 'synthetic_index') return -1; if (b === 'synthetic_index') return 1; return a < b ? -1 : 1;
    });
    let html = '';
    order.forEach(function (m) {
      html += '<optgroup label="' + esc(marketLabel(m)) + '">';
      groups[m].forEach(function (s) {
        const closed = s.exchange_is_open === 0;
        html += '<option value="' + esc(s.underlying_symbol) + '"' + (closed ? ' disabled' : '') + '>'
              + esc(s.underlying_symbol_name || s.underlying_symbol) + (closed ? ' (closed)' : '') + '</option>';
      });
      html += '</optgroup>';
    });
    sel.innerHTML = html;
    const wanted = [prev, 'R_100', '1HZ100V', 'R_50', 'R_10'];
    for (let i = 0; i < wanted.length; i++) {
      const o = wanted[i] && sel.querySelector('option[value="' + wanted[i] + '"]:not([disabled])');
      if (o) { sel.value = wanted[i]; return; }
    }
    const first = sel.querySelector('option:not([disabled])');
    if (first) sel.value = first.value;
  }

  /* ───────────────────────── account pill ───────────────────────── */
  function mountAccountPill(el) {
    function render() {
      if (!Deriv.isAuthed()) {
        el.className = 'acct-pill acct-out';
        el.innerHTML = '<span class="acct-dot"></span><span>Not logged in</span><button class="acct-login" type="button">Log in to trade</button>';
        return;
      }
      const a = Deriv.active();
      if (!a) { el.className = 'acct-pill acct-out'; el.innerHTML = '<span class="acct-dot"></span><span>No trading account found</span>'; return; }
      const demo = a.type === 'demo';
      el.className = 'acct-pill ' + (demo ? 'acct-demo' : 'acct-real');
      el.innerHTML = '<span class="acct-dot"></span><b>' + (demo ? 'DEMO' : 'REAL') + '</b><span class="acct-id">' + esc(a.id) + '</span><span class="acct-bal">' + esc(Deriv.fmtMoney(a.balance, a.currency)) + '</span>';
    }
    el.addEventListener('click', function (e) {
      if (e.target.closest('.acct-login')) Deriv.login().catch(function (er) { toast(friendlyError(er), 'error'); });
    });
    ['auth', 'account', 'accounts', 'balance'].forEach(function (ev) { Deriv.on(ev, render); });
    render();
  }

  /* ───────────────────────── open-position tracker ───────────────────────── */
  const FINAL = { won: 1, lost: 1, sold: 1, cancelled: 1 };

  class PositionTracker {
    /**
     * @param el    container element
     * @param opts  { adoptFilter(poc)->bool, onSettled(info), onUpdate(poc), extra(poc)->html, emptyText }
     * Cards are created once and patched in place, so the "Close position" button is never
     * replaced under the user's finger while ticks stream in.
     */
    constructor(el, opts) {
      this.el = el;
      this.opts = opts || {};
      this.cards = new Map();   // id -> {sub, poc, done, timer, node}
      const self = this;
      el.addEventListener('click', function (e) {
        const b = e.target.closest('[data-sell]');
        if (b) self.sell(b.getAttribute('data-sell'), b);
      });
      this._empty = document.createElement('div');
      this._empty.className = 'pos-empty';
      this._empty.textContent = this.opts.emptyText || 'No open positions';
      el.appendChild(this._empty);
    }

    has(id) { return this.cards.has(String(id)); }
    openCount() { let n = 0; this.cards.forEach(function (c) { if (!c.done) n++; }); return n; }

    _syncEmpty() { this._empty.style.display = this.cards.size ? 'none' : ''; }

    _makeNode(id) {
      const n = document.createElement('div');
      n.className = 'pos-card';
      n.innerHTML =
        '<div class="pos-top"><span class="pos-type" data-f="type">#' + esc(id) + '</span><span class="pos-status live" data-f="status">● LIVE</span></div>' +
        '<div class="pos-grid">' +
          '<div><label data-f="bidlabel">Bid</label><b data-f="bid">—</b></div>' +
          '<div><label>Stake</label><b data-f="stake">—</b></div>' +
          '<div><label>Profit</label><b data-f="profit">—</b></div>' +
          '<span class="pos-extra" data-f="extra"></span>' +
        '</div>' +
        '<button class="pos-sell" data-sell="' + esc(id) + '" hidden>Close position</button>';
      return n;
    }

    track(contractId) {
      const id = String(contractId);
      if (this.cards.has(id)) return;
      const self = this;
      const card = { sub: null, poc: null, done: false, timer: null, node: this._makeNode(id) };
      this.cards.set(id, card);
      this.el.insertBefore(card.node, this.el.firstChild);
      this._syncEmpty();
      card.sub = Deriv.trade.subscribe(
        { proposal_open_contract: 1, contract_id: Number(contractId) },
        function (m) { if (m.proposal_open_contract && m.proposal_open_contract.contract_id) self._update(id, m.proposal_open_contract); },
        function (err) { toast('Position ' + id + ': ' + friendlyError(err), 'error'); }
      );
    }

    /** One-off look at everything open on this account (e.g. after a page refresh). */
    adopt() {
      if (!Deriv.trade.isOpen()) return;
      const self = this;
      let sub = Deriv.trade.subscribe({ proposal_open_contract: 1 }, function (m) {
        const p = m.proposal_open_contract;
        if (!p || !p.contract_id || p.is_sold === 1) return;
        if (self.opts.adoptFilter && !self.opts.adoptFilter(p)) return;
        if (!self.has(p.contract_id)) self.track(p.contract_id);
      }, function () {});
      setTimeout(function () { if (sub) { sub.forget(); sub = null; } }, 4000);
    }

    async sell(id, btn) {
      if (btn) btn.disabled = true;
      try {
        const r = await Deriv.sellContract(id);
        if (r && typeof r.sold_for === 'number') toast('Sold for ' + Deriv.fmtMoney(r.sold_for), 'success');
      } catch (e) {
        toast('Sell failed: ' + friendlyError(e), 'error');
        if (btn) btn.disabled = false;
      }
    }

    _paint(card, p) {
      const q = function (f) { return card.node.querySelector('[data-f="' + f + '"]'); };
      const cur = p.currency || Deriv.currency();
      const profit = Number(p.profit);
      const cls = !isFinite(profit) ? '' : (profit >= 0 ? 'up' : 'down');
      q('type').textContent = (p.contract_type || '') + ' · ' + (p.underlying_symbol || '');
      const st = q('status');
      st.className = 'pos-status ' + (card.done ? cls : 'live');
      st.textContent = card.done ? String(p.status || 'closed').toUpperCase() : '● LIVE';
      q('bidlabel').textContent = card.done ? 'Sold for' : 'Bid';
      q('bid').textContent = Deriv.fmt(Number(card.done ? p.sell_price : p.bid_price), cur);
      q('stake').textContent = Deriv.fmt(Number(p.buy_price), cur);
      const pf = q('profit'); pf.className = cls; pf.textContent = signed(profit, cur);
      if (this.opts.extra) q('extra').innerHTML = this.opts.extra(p);
      const btn = card.node.querySelector('.pos-sell');
      btn.hidden = card.done || p.is_valid_to_sell !== 1;
      card.node.classList.toggle('done', card.done);
      card.node.classList.toggle('up', card.done && cls === 'up');
      card.node.classList.toggle('down', card.done && cls === 'down');
    }

    _update(id, poc) {
      const card = this.cards.get(id);
      if (!card || card.done) return;
      card.poc = poc;
      const finished = poc.is_sold === 1 || FINAL[poc.status];
      if (finished) {
        card.done = true;
        if (card.sub) { card.sub.forget(); card.sub = null; }
      }
      this._paint(card, poc);
      if (this.opts.onUpdate) { try { this.opts.onUpdate(poc); } catch (e) { console.error(e); } }
      if (finished) {
        let profit = Number(poc.profit);
        if (!isFinite(profit)) profit = Number(poc.sell_price || 0) - Number(poc.buy_price || 0);
        const info = {
          contract_id: poc.contract_id, contract_type: poc.contract_type, symbol: poc.underlying_symbol,
          buy_price: Number(poc.buy_price), sell_price: Number(poc.sell_price), profit: profit,
          status: poc.status || (profit >= 0 ? 'won' : 'lost'), entry_spot: poc.entry_spot, exit_spot: poc.exit_spot,
          purchase_time: poc.purchase_time, currency: poc.currency, tick_passed: poc.tick_passed, shortcode: poc.shortcode,
        };
        const self = this;
        card.timer = setTimeout(function () {
          self.cards.delete(id);
          if (card.node.parentNode) card.node.parentNode.removeChild(card.node);
          self._syncEmpty();
        }, 12000);
        if (this.opts.onSettled) { try { this.opts.onSettled(info); } catch (e) { console.error(e); } }
      }
    }

    clearAll() {
      this.cards.forEach(function (c) {
        if (c.sub) c.sub.forget();
        clearTimeout(c.timer);
        if (c.node.parentNode) c.node.parentNode.removeChild(c.node);
      });
      this.cards.clear();
      this._syncEmpty();
    }
  }

  /* ───────────────────────── market feed (symbols + ticks + chart) ───────────────────────── */
  class MarketFeed {
    /**
     * o: { select, canvas, priceEl, contractTypes[], count, chartMax, preferred, onHistory(feed), onTick(tick, feed), onSymbol(sym) }
     */
    constructor(o) {
      this.o = o;
      this.chart = new TickChart(o.canvas, { max: o.chartMax || 120 });
      this.quotes = []; this.times = [];
      this.pip = 2; this.symbol = ''; this.sub = null; this.running = false;
      this.loaded = false;
    }

    async loadSymbols() {
      const self = this;
      try {
        const list = await Deriv.activeSymbols(this.o.contractTypes);
        fillSymbolSelect(this.o.select, list, this.o.preferred);
        this.symbol = this.o.select.value;
        this.o.select.onchange = function () {
          self.symbol = self.o.select.value;
          self.restart();
          if (self.o.onSymbol) self.o.onSymbol(self.symbol);
        };
        this.loaded = true;
        if (this.o.onSymbol) this.o.onSymbol(this.symbol);
      } catch (e) {
        this.o.select.innerHTML = '<option value="">Could not load markets</option>';
        toast('Could not load markets: ' + friendlyError(e), 'error');
        this.loaded = false;
      }
    }

    start() {
      if (this.running || !this.symbol) return;
      this.running = true;
      this._begin();
    }
    stop() {
      this.running = false;
      if (this.sub) { this.sub.forget(); this.sub = null; }
    }
    restart() {
      if (!this.running) return;
      if (this.sub) { this.sub.forget(); this.sub = null; }
      this._begin();
    }

    _begin() {
      const self = this;
      this.quotes = []; this.times = [];
      this.chart.clear();
      if (this.o.priceEl) this.o.priceEl.textContent = '—';
      this.sub = Deriv.streamTicks(this.symbol, this.o.count || 120,
        function (h) {
          self.pip = h.pip;
          self.quotes = h.prices.map(Number); self.times = h.times.slice();
          self.chart.setHistory(h.prices, h.times, h.pip);
          self._price(self.quotes[self.quotes.length - 1], null);
          if (self.o.onHistory) self.o.onHistory(self);
        },
        function (t) {
          const prev = self.quotes.length ? self.quotes[self.quotes.length - 1] : null;
          self.pip = t.pip || self.pip;
          self.quotes.push(t.quote); self.times.push(t.epoch);
          const cap = self.o.keep || 5000;
          if (self.quotes.length > cap) { self.quotes.shift(); self.times.shift(); }
          self.chart.push(t.quote, t.epoch, self.pip);
          self._price(t.quote, prev);
          if (self.o.onTick) self.o.onTick(t, self);
        },
        function (err) { toast('Tick stream: ' + friendlyError(err), 'error'); }
      );
    }

    _price(q, prev) {
      const el = this.o.priceEl;
      if (!el || q == null) return;
      el.textContent = Number(q).toFixed(this.pip);
      el.classList.remove('up', 'down');
      if (prev != null && q !== prev) el.classList.add(q > prev ? 'up' : 'down');
    }

    last() { return this.quotes.length ? this.quotes[this.quotes.length - 1] : null; }
  }

  global.UI = {
    esc: esc, toast: toast, num: num, signed: signed, timeStr: timeStr, cssVar: cssVar, friendlyError: friendlyError,
    TickChart: TickChart, fillSymbolSelect: fillSymbolSelect, mountAccountPill: mountAccountPill,
    PositionTracker: PositionTracker, MarketFeed: MarketFeed,
  };
})(window);
