/**
 * accumulator-bot.js
 * Deriv Accumulator Bot — WebSocket trading, martingale, daily P&L.
 * Manual-trigger mode only: trades fire from HL Analysis TRADE button.
 * UPDATED: TP default 10%, Martingale default 10x, Auto re-entry on loss (IMMEDIATE)
 */

const ACC_SYMBOLS  = ["1HZ10V","1HZ15V","1HZ30V","1HZ50V","1HZ25V","1HZ75V","1HZ90V","1HZ100V","R_10","R_25","R_50","R_75","R_100"];
const ACC_WS_URL   = 'wss://ws.binaryws.com/websockets/v3?app_id=129756';

const accTickBufs  = {};
ACC_SYMBOLS.forEach(s => { accTickBufs[s] = []; });

/* ── State ── */
const acc = {
  connected: false,
  trading_paused: false,
  balance: 0,
  daily_profit: 0,
  current_day: null,
  trades: [],
  open_trades: new Set(),
  contracts_info: {},
  contracts_map: {},
  pending: {},
  martingale_mult: 1.0,
  consecutive_losses: 0,
  wins: 0,
  losses: 0,
  ws: null,
  req_counter: 0,
  pnl_history: [],
  active_symbols: new Set(["1HZ15V"]),
  tick_prices: {},
  tick_dirs: {},
  last_trade_time: {},
  pending_auto_retry: {}, // Track symbols waiting for auto re-entry
};

/* ── Fast poll timers ── */
const acc_poll_timers = {};

/* ── Config helpers ── */
function accGetCfg() {
  return {
    token:       document.getElementById('acc-cfg-token').value.trim(),
    currency:    document.getElementById('acc-cfg-currency').value,
    base_stake:  parseFloat(document.getElementById('acc-cfg-stake').value) || 1.0,
    growth_rate: (parseFloat(document.getElementById('acc-cfg-growth').value) || 5) / 100,
    tp_trade:    (parseFloat(document.getElementById('acc-cfg-tp-trade').value) || 10) / 100, // Default 10%
    daily_tp:    parseFloat(document.getElementById('acc-cfg-daily-tp').value) || 10,
    mart_enabled:document.getElementById('acc-cfg-mart-on').checked,
    mart_mult:   parseFloat(document.getElementById('acc-cfg-mult').value) || 10, // Default 10x
    mart_max:    parseFloat(document.getElementById('acc-cfg-maxmult').value) || 50,
    reset_win:   document.getElementById('acc-cfg-reset-win').checked,
    cooldown_ms: (parseFloat(document.getElementById('acc-cfg-cooldown').value) || 3) * 1000,
  };
}

function accGetCurrentStake(cfg) {
  cfg = cfg || accGetCfg();
  return parseFloat((cfg.base_stake * acc.martingale_mult).toFixed(2));
}

function accTodayStr() { return new Date().toDateString(); }

/* ── Connection ── */
function accToggleConnect() {
  acc.connected ? accDisconnect() : accDoConnect();
}

function accDoConnect() {
  const cfg = accGetCfg();
  if (!cfg.token || cfg.token.length < 5) { accToast('Please enter a valid API token', 'error'); return; }
  try {
    acc.ws = new WebSocket(ACC_WS_URL);
    acc.ws.onopen    = accOnOpen;
    acc.ws.onmessage = accOnMessage;
    acc.ws.onerror   = accOnError;
    acc.ws.onclose   = accOnClose;
    accSetStatus('connecting');
    document.getElementById('acc-btn-connect').textContent = 'CONNECTING...';
    document.getElementById('acc-btn-connect').disabled = true;
    accLog('Connecting to Deriv WS (app_id 129756)...', 'info');
  } catch (e) {
    accToast('WebSocket error: ' + e.message, 'error');
    accLog('WS error: ' + e.message, 'error');
  }
}

function accDisconnect() {
  if (acc.ws) { acc.ws.close(); acc.ws = null; }
  acc.connected = false;
  acc.open_trades.clear();
  acc.pending = {};
  acc.pending_auto_retry = {};
  acc.contracts_info = {};
  acc.contracts_map  = {};
  accSetStatus('offline');
  document.getElementById('acc-btn-connect').textContent = 'CONNECT';
  document.getElementById('acc-btn-connect').disabled    = false;
  document.getElementById('acc-btn-pause').disabled      = true;
  document.getElementById('acc-btn-stop').disabled       = true;
  accRenderActiveTrades();
  accLog('Disconnected', 'warning');
}

function accWsSend(obj) {
  if (acc.ws && acc.ws.readyState === WebSocket.OPEN) acc.ws.send(JSON.stringify(obj));
}

/* ── WS event handlers ── */
function accOnOpen() {
  accLog('WS open — authorizing...', 'info');
  accWsSend({ authorize: accGetCfg().token });
}

function accOnError() {
  accToast('Connection error — check token or network', 'error');
  accLog('WS connection error', 'error');
  accDisconnect();
}

function accOnClose() {
  if (acc.connected) { accToast('Connection closed', 'warning'); accLog('Connection closed unexpectedly', 'warning'); }
  accDisconnect();
}

function accOnMessage(evt) {
  let data;
  try { data = JSON.parse(evt.data); } catch (e) { return; }

  /* ── Authorize ── */
  if (data.authorize !== undefined) {
    if (!data.error) {
      acc.connected = true;
      document.getElementById('acc-btn-connect').textContent = 'DISCONNECT';
      document.getElementById('acc-btn-connect').disabled    = false;
      document.getElementById('acc-btn-pause').disabled      = false;
      document.getElementById('acc-btn-stop').disabled       = false;
      accSetStatus('online');
      accToast('Authorized — MANUAL trading ready', 'success');
      accLog('✓ Authorized. Subscribing to balance & ticks...', 'success');
      accWsSend({ balance: 1, subscribe: 1 });
      acc.active_symbols.forEach(sym => accWsSend({ ticks: sym, subscribe: 1 }));
      acc.active_symbols.forEach(sym => { if (!accTickBufs[sym]) accTickBufs[sym] = []; });
    } else {
      accToast('Auth failed: ' + data.error.message, 'error');
      accLog('Auth error: ' + data.error.message, 'error');
      accDisconnect();
    }
    return;
  }

  /* ── Balance ── */
  if (data.balance) {
    acc.balance = parseFloat(data.balance.balance);
    if (acc.current_day === null) {
      acc.current_day = accTodayStr();
      accLog(`Balance: $${acc.balance.toFixed(2)} — day tracking started`, 'info');
    }
    accUpdateUI();
    return;
  }

  /* ── Tick ── */
  if (data.tick) {
    const { symbol: sym, quote } = data.tick;
    const price = parseFloat(quote);
    const prev  = acc.tick_prices[sym];
    acc.tick_dirs[sym]   = prev === undefined ? 'flat' : price > prev ? 'up' : price < prev ? 'down' : 'flat';
    acc.tick_prices[sym] = price;
    accUpdateSymbolCard(sym, price, acc.tick_dirs[sym]);
    if (!accTickBufs[sym]) accTickBufs[sym] = [];
    accTickBufs[sym].push(price);
    if (accTickBufs[sym].length > 200) accTickBufs[sym].shift();
    accCheckNewDay();
    return;
  }

  /* ── Proposal → immediately buy ── */
  if (data.proposal !== undefined && data.req_id !== undefined) {
    const intent = acc.pending[data.req_id];
    if (!intent) return;
    delete acc.pending[data.req_id];
    if (data.error) {
      accLog(`Proposal error [${intent.sym}]: ${data.error.message}`, 'error');
      acc.open_trades.delete(intent.sym);
      accRenderActiveTrades();
      return;
    }
    const buyReqId = ++acc.req_counter;
    acc.pending[buyReqId] = intent;
    accWsSend({ buy: data.proposal.id, price: data.proposal.ask_price, req_id: buyReqId });
    return;
  }

  /* ── Buy confirmed ── */
  if (data.buy !== undefined && data.req_id !== undefined) {
    const intent = acc.pending[data.req_id];
    if (!intent) return;
    delete acc.pending[data.req_id];
    if (data.error) {
      accLog(`Buy error [${intent.sym}]: ${data.error.message}`, 'error');
      acc.open_trades.delete(intent.sym);
      accRenderActiveTrades();
      return;
    }
    const cid = data.buy.contract_id;
    acc.contracts_info[cid]    = { sym: intent.sym, stake: intent.stake, openTime: Date.now() };
    acc.contracts_map[intent.sym] = cid;
    acc.open_trades.add(intent.sym);
    accRenderActiveTrades();
    accLog(`✓ OPENED → ${intent.sym} | $${intent.stake.toFixed(2)} | ×${acc.martingale_mult.toFixed(2)}`, 'trade');
    accToast(`Opened: ${intent.sym} @ $${intent.stake.toFixed(2)}`, 'success');
    accWsSend({ proposal_open_contract: 1, contract_id: cid, subscribe: 1 });
    accStartFastPoll(cid);
    return;
  }

  /* ── POC update ── */
  if (data.proposal_open_contract) {
    const poc = data.proposal_open_contract;
    const cid = poc.contract_id;
    if (!acc.contracts_info[cid]) return;
    const { sym, stake } = acc.contracts_info[cid];

    if (!poc.is_sold) {
      accUpdateActiveTradeUI(cid, parseFloat(poc.profit || 0));
      return;
    }

    accStopFastPoll(cid);
    const profit = parseFloat(poc.profit || 0);
    const win    = profit > 0;

    acc.daily_profit += profit;
    if (win) {
      acc.wins++;
      if (accGetCfg().reset_win) accResetMartingale();
      accLog(`✓ WIN ${sym}: +$${profit.toFixed(2)} | Mart ×1`, 'success');
    } else {
      acc.losses++;
      accIncreaseMartingale();
      accLog(`✗ LOSS ${sym}: $${profit.toFixed(2)} | Mart → ×${acc.martingale_mult.toFixed(2)}`, 'error');
      
      // AUTO RE-ENTRY ON LOSS - Immediate execution (no cooldown)
      // Check if auto mode is active by looking for hlAutoMode in global scope
      const autoModeActive = typeof window.hlAutoMode !== 'undefined' ? window.hlAutoMode : false;
      
      if (autoModeActive && !acc.trading_paused) {
        accLog(`🔄 AUTO RE-ENTRY triggered for ${sym} with martingale ×${acc.martingale_mult.toFixed(2)}`, 'info');
        
        // Schedule re-entry after a very short delay (just to ensure contract is fully settled)
        setTimeout(() => {
          if (!acc.open_trades.has(sym) && !acc.trading_paused && acc.connected) {
            // Directly call send proposal to bypass cooldown
            const cfg = accGetCfg();
            accLog(`🚀 AUTO RE-ENTRY EXECUTING ${sym} | Stake $${accGetCurrentStake(cfg).toFixed(2)} | ×${acc.martingale_mult.toFixed(2)}`, 'trade');
            accSendProposal(sym, cfg);
          }
        }, 300); // 300ms delay for immediate but safe re-entry
      }
    }

    acc.trades.unshift({ time: new Date().toLocaleTimeString(), sym, profit, stake, mult: acc.martingale_mult, win });
    acc.pnl_history.push(acc.daily_profit);
    if (acc.pnl_history.length > 80) acc.pnl_history.shift();

    // Only set last_trade_time for manual trades, not auto re-entries
    const autoModeActive = typeof window.hlAutoMode !== 'undefined' ? window.hlAutoMode : false;
    if (!autoModeActive) {
      acc.last_trade_time[sym] = Date.now();
    }
    
    acc.open_trades.delete(sym);
    delete acc.contracts_info[cid];
    delete acc.contracts_map[sym];

    accRenderActiveTrades();
    accRenderTradeLog();
    accDrawChart();
    accUpdateUI();
    
    // Call hlPanelAddResult if it exists
    if (typeof window.hlPanelAddResult === 'function') {
      window.hlPanelAddResult(sym, profit, win);
    }
    
    accToast(`${win ? '✓ WIN' : '✗ LOSS'} ${sym}: ${profit >= 0 ? '+' : ''}$${profit.toFixed(2)}`, win ? 'success' : 'error');

    const cfg = accGetCfg();
    if (acc.daily_profit >= cfg.daily_tp) {
      acc.trading_paused = true;
      accToast(`Daily TP $${cfg.daily_tp.toFixed(2)} reached — paused`, 'warning');
      accLog(`★ DAILY TP $${cfg.daily_tp.toFixed(2)} REACHED — paused`, 'warning');
      accUpdateUI();
    }
  }
}

/* ── Fast polling ── */
function accStartFastPoll(cid) {
  accStopFastPoll(cid);
  acc_poll_timers[cid] = setInterval(() => {
    if (!acc.contracts_info[cid]) { accStopFastPoll(cid); return; }
    accWsSend({ proposal_open_contract: 1, contract_id: cid });
  }, 500);
}

function accStopFastPoll(cid) {
  if (acc_poll_timers[cid]) { clearInterval(acc_poll_timers[cid]); delete acc_poll_timers[cid]; }
}

/* ── Trade actions ── */
function accManualOpenTrade(sym, isAutoReEntry = false) {
  if (!acc.active_symbols.has(sym)) return;
  if (acc.open_trades.has(sym)) { 
    accToast(`${sym} already has an open position`, 'warning'); 
    return; 
  }
  
  const cfg = accGetCfg();
  
  // Skip cooldown check for auto re-entry
  if (!isAutoReEntry) {
    const now = Date.now();
    const last= acc.last_trade_time[sym] || 0;
    if ((now - last) < cfg.cooldown_ms) {
      accToast(`Cooldown active for ${sym} — wait ${Math.ceil((cfg.cooldown_ms - (now - last)) / 1000)}s`, 'warning');
      return;
    }
  }
  
  accLog(`🚀 ${isAutoReEntry ? 'AUTO RE-ENTRY' : 'MANUAL'} TRADE ${sym} | Stake $${accGetCurrentStake(cfg).toFixed(2)} | ×${acc.martingale_mult.toFixed(2)}`, 'trade');
  accSendProposal(sym, cfg);
}

function accSendProposal(sym, cfg) {
  const stake = accGetCurrentStake(cfg);
  const reqId = ++acc.req_counter;
  acc.pending[reqId] = { sym, stake };
  
  // Calculate take profit amount based on stake percentage
  const tpAmount = stake * cfg.tp_trade;
  
  accWsSend({
    proposal: 1, amount: stake, basis: 'stake', contract_type: 'ACCU',
    currency: cfg.currency, growth_rate: cfg.growth_rate, symbol: sym,
    limit_order: { take_profit: parseFloat(tpAmount.toFixed(2)) },
    req_id: reqId,
  });
}

/* ── Martingale ── */
function accResetMartingale() {
  if (acc.martingale_mult !== 1.0) { acc.martingale_mult = 1.0; acc.consecutive_losses = 0; accUpdateMartingaleUI(); }
}

function accIncreaseMartingale() {
  const cfg = accGetCfg();
  acc.consecutive_losses++;
  if (!cfg.mart_enabled) return;
  let n = acc.martingale_mult * cfg.mart_mult;
  if (n > cfg.mart_max) n = cfg.mart_max;
  acc.martingale_mult = parseFloat(n.toFixed(4));
  accUpdateMartingaleUI();
}

function accManualResetMartingale() {
  accResetMartingale();
  acc.consecutive_losses = 0;
  accToast('Martingale manually reset to ×1.00', 'success');
  accLog('Manual martingale reset → ×1.00', 'info');
  accUpdateUI();
}

/* ── Controls ── */
function accSaveConfig() {
  const cfg = accGetCfg();
  acc.martingale_mult = 1.0;
  document.getElementById('acc-stat-tp-val').textContent      = cfg.daily_tp.toFixed(2);
  document.getElementById('acc-daily-tp-progress').textContent = cfg.daily_tp.toFixed(2);
  accToast('Configuration saved', 'success');
  accLog('Config saved — MANUAL MODE enabled', 'info');
  accUpdateUI();
}

function accTogglePause() {
  acc.trading_paused = !acc.trading_paused;
  const btn = document.getElementById('acc-btn-pause');
  btn.textContent  = acc.trading_paused ? 'RESUME' : 'PAUSE';
  btn.className    = acc.trading_paused ? 'acc-btn acc-btn-primary' : 'acc-btn acc-btn-warning';
  accToast(acc.trading_paused ? 'Trading paused' : 'Trading resumed', acc.trading_paused ? 'warning' : 'success');
  accLog(acc.trading_paused ? 'Trading PAUSED by user' : 'Trading RESUMED by user', acc.trading_paused ? 'warning' : 'success');
  accUpdateUI();
}

function accEmergencyStop() {
  acc.trading_paused = true;
  accToast('Emergency stop — all new trades blocked', 'warning');
  accLog('⚠ EMERGENCY STOP — trading blocked', 'error');
  document.getElementById('acc-btn-pause').textContent = 'RESUME';
  document.getElementById('acc-btn-pause').className   = 'acc-btn acc-btn-primary';
  accUpdateUI();
}

/* ── Day reset ── */
function accCheckNewDay() {
  const today = accTodayStr();
  if (acc.current_day && acc.current_day !== today) {
    acc.current_day   = today;
    acc.daily_profit  = 0;
    acc.trading_paused= false;
    acc.wins = 0; acc.losses = 0;
    acc.trades        = [];
    acc.pnl_history   = [];
    accResetMartingale();
    accDrawChart();
    accToast('New trading day — all stats reset', 'success');
    accLog('★ NEW DAY: ' + today + ' — stats reset', 'success');
    document.getElementById('acc-btn-pause').textContent = 'PAUSE';
    document.getElementById('acc-btn-pause').className   = 'acc-btn acc-btn-warning';
    accUpdateUI();
  }
}

/* ── Status ── */
function accSetStatus(s) {
  const dot = document.getElementById('acc-status-dot');
  const txt = document.getElementById('acc-status-text');
  if (!dot || !txt) return;
  dot.className = 'acc-status-dot';
  if      (s === 'online')     { txt.textContent = 'LIVE'; }
  else if (s === 'offline')    { dot.classList.add('offline');  txt.textContent = 'OFFLINE'; }
  else if (s === 'connecting') { txt.textContent = 'CONNECTING...'; }
  else if (s === 'paused')     { dot.classList.add('paused');   txt.textContent = 'PAUSED'; }
}

/* ── UI updates ── */
function accUpdateUI() {
  const cfg  = accGetCfg();
  const pnlEl= document.getElementById('acc-stat-pnl');
  const sb   = document.getElementById('acc-stat-balance');
  if (sb)    sb.textContent = `$${acc.balance.toFixed(2)}`;
  const sc   = document.getElementById('acc-stat-currency');
  if (sc)    sc.textContent = cfg.currency;
  if (pnlEl) { pnlEl.textContent = `${acc.daily_profit >= 0 ? '+' : ''}$${acc.daily_profit.toFixed(2)}`; pnlEl.className = 'acc-stat-value ' + (acc.daily_profit >= 0 ? 'green' : 'red'); }
  const st   = document.getElementById('acc-stat-trades');
  if (st)    st.textContent = acc.trades.length;
  const wr   = document.getElementById('acc-stat-wr');
  if (wr)    wr.textContent = `W: ${acc.wins}  L: ${acc.losses}`;
  const sk   = document.getElementById('acc-stat-stake');
  if (sk)    sk.textContent = `$${accGetCurrentStake(cfg).toFixed(2)}`;
  const ml   = document.getElementById('acc-stat-mult-label');
  if (ml)    ml.textContent = `×${acc.martingale_mult.toFixed(2)} martingale`;

  const pct  = Math.min(100, Math.max(0, (acc.daily_profit / cfg.daily_tp) * 100));
  const pb   = document.getElementById('acc-daily-progress-bar');
  if (pb)    pb.style.width = pct + '%';
  const dp   = document.getElementById('acc-daily-pnl-progress');
  if (dp)    dp.textContent = `$${acc.daily_profit.toFixed(2)}`;
  const dtp  = document.getElementById('acc-daily-tp-progress');
  if (dtp)   dtp.textContent = cfg.daily_tp.toFixed(2);
  const stpv = document.getElementById('acc-stat-tp-val');
  if (stpv)  stpv.textContent = cfg.daily_tp.toFixed(2);

  if (acc.trading_paused) accSetStatus('paused');
  else if (acc.connected)  accSetStatus('online');
  else                     accSetStatus('offline');

  const chip = document.getElementById('acc-trading-status-chip');
  if (chip) chip.innerHTML = acc.trading_paused
    ? `<span class="acc-chip acc-chip-yellow">PAUSED</span>`
    : acc.connected
      ? `<span class="acc-chip acc-chip-green">MANUAL READY</span>`
      : `<span class="acc-chip acc-chip-blue">WAITING</span>`;

  accUpdateMartingaleUI();
  accUpdateIndicatorsRow();
}

function accUpdateMartingaleUI() {
  const mult = acc.martingale_mult;
  const me   = document.getElementById('acc-mart-mult-display');
  if (me) { me.textContent = `×${mult.toFixed(2)}`; me.className = 'acc-mart-mult' + (mult >= 100 ? ' danger' : mult >= 10 ? ' warning' : ''); }
  const ms   = document.getElementById('acc-mart-stake-display');
  if (ms) ms.textContent = `Next stake: $${accGetCurrentStake().toFixed(2)}`;
  const cl   = document.getElementById('acc-consec-losses');
  if (cl) cl.textContent = acc.consecutive_losses;
  const steps= document.getElementById('acc-mart-steps');
  if (steps) {
    const n = Math.min(acc.consecutive_losses, 10);
    steps.innerHTML = '';
    for (let i = 0; i < 10; i++) {
      const d = document.createElement('div');
      d.className = 'acc-mart-step' + (i < n ? (' filled' + (n >= 7 ? ' danger' : '')) : '');
      steps.appendChild(d);
    }
  }
}

function accUpdateIndicatorsRow() {
  const row = document.getElementById('acc-indicators-row');
  if (!row) return;
  row.innerHTML = '';
  acc.active_symbols.forEach(sym => {
    const price  = acc.tick_prices[sym];
    const dir    = acc.tick_dirs[sym] || 'flat';
    const dotCls = dir === 'up' ? 'acc-dot-green' : dir === 'down' ? 'acc-dot-red' : 'acc-dot-muted';
    const isOpen = acc.open_trades.has(sym);
    row.innerHTML += `<div class="acc-ind-chip" style="${isOpen ? 'border-color:var(--accent);' : ''}">${isOpen ? '<span style="color:#fbbf24">●</span> ' : ''}<div class="acc-ind-dot ${dotCls}"></div><span style="color:var(--accent);margin-left:2px">${sym}</span>&nbsp;<span style="color:var(--text-secondary)">${price ? price.toFixed(5) : '—'}</span></div>`;
  });
}

function accRenderActiveTrades() {
  const area = document.getElementById('acc-active-trades-area');
  if (!area) return;
  const keys = [...acc.open_trades];
  if (!keys.length) {
    area.innerHTML = '<div class="acc-no-trades">No open positions</div>';
  } else {
    area.innerHTML = keys.map(sym => {
      const cid  = acc.contracts_map[sym];
      const info = acc.contracts_info[cid] || {};
      return `<div class="acc-active-card" id="acc-active-${cid}"><div class="acc-spin"></div><div><div class="acc-active-sym">${sym}</div><div class="acc-active-meta">Stake: $${(info.stake || 0).toFixed(2)} · ACCU · GR ${(accGetCfg().growth_rate * 100).toFixed(0)}%</div></div><div style="flex:1"></div><div class="acc-active-pnl" id="acc-pnl-${cid}">+$0.00</div></div>`;
    }).join('');
  }
  if (typeof window.hlPanelRender === 'function') {
    window.hlPanelRender();
  }
}

function accUpdateActiveTradeUI(cid, profit) {
  const el = document.getElementById('acc-pnl-' + cid);
  if (el) { el.textContent = `${profit >= 0 ? '+' : ''}$${profit.toFixed(2)}`; el.style.color = profit >= 0 ? '#34d399' : '#f87171'; }

  const hlPnl = document.getElementById('hl-pnl-' + cid);
  if (hlPnl) { hlPnl.textContent = `${profit >= 0 ? '+' : ''}$${profit.toFixed(2)}`; hlPnl.className = 'hl-trade-pnl' + (profit < 0 ? ' neg' : ''); }

  const info    = acc.contracts_info[cid] || {};
  const stake   = info.stake || 1;
  const pct     = Math.min(100, Math.max(0, Math.round((profit / stake) * 100 + 50)));
  const barFill = document.getElementById('hl-bar-' + cid);
  if (barFill) barFill.style.width = pct + '%';

  const pill = document.getElementById('hl-live-pill');
  if (pill && pill.classList.contains('visible')) {
    const total = [...acc.open_trades].length;
    document.getElementById('hl-pill-label').textContent = total > 0
      ? `${total} LIVE · ${profit >= 0 ? '+' : ''}$${profit.toFixed(2)}`
      : 'LIVE POSITION';
  }
}

function accRenderTradeLog() {
  const log = document.getElementById('acc-trade-log');
  if (!log) return;
  const lc = document.getElementById('acc-log-count');
  if (lc) lc.textContent = `${acc.trades.length} trades`;
  if (!acc.trades.length) { log.innerHTML = '<div class="acc-no-trades">No trades yet</div>'; return; }
  log.innerHTML = acc.trades.slice(0, 60).map(t =>
    `<div class="acc-trade-entry"><span class="acc-trade-time">${t.time}</span><span class="acc-trade-sym">${t.sym}</span><span class="acc-trade-result ${t.win ? 'win' : 'loss'}">${t.win ? '● WIN' : '● LOSS'}</span><span class="acc-trade-profit ${t.profit >= 0 ? 'pos' : 'neg'}">${t.profit >= 0 ? '+' : ''}$${t.profit.toFixed(2)}</span><span class="acc-trade-mult">×${t.mult.toFixed(1)}</span></div>`
  ).join('');
}

function accBuildSymbolCards() {
  const g = document.getElementById('acc-symbols-grid');
  if (!g) return;
  g.innerHTML = ACC_SYMBOLS.map(sym =>
    `<div class="acc-symbol-card ${acc.active_symbols.has(sym) ? 'active' : ''}" id="acc-sym-${sym}" onclick="accToggleSymbol('${sym}')"><span class="acc-symbol-tick" id="acc-tick-${sym}">—</span><div class="acc-symbol-name">${sym}</div><div class="acc-symbol-price" id="acc-price-${sym}">—</div></div>`
  ).join('');
}

function accUpdateSymbolCard(sym, price, dir) {
  const prEl = document.getElementById('acc-price-' + sym);
  const tkEl = document.getElementById('acc-tick-' + sym);
  if (prEl) prEl.textContent = price.toFixed(5);
  if (tkEl) { tkEl.textContent = dir === 'up' ? '▲' : dir === 'down' ? '▼' : '—'; tkEl.className = 'acc-symbol-tick ' + (dir === 'up' ? 'up' : dir === 'down' ? 'down' : ''); }
  accUpdateIndicatorsRow();
}

function accToggleSymbol(sym) {
  if (acc.active_symbols.has(sym)) { acc.active_symbols.delete(sym); }
  else { acc.active_symbols.add(sym); if (acc.connected) accWsSend({ ticks: sym, subscribe: 1 }); if (!accTickBufs[sym]) accTickBufs[sym] = []; }
  accBuildSymbolCards();
}

/* ── P&L Chart ── */
function accDrawChart() {
  const canvas = document.getElementById('acc-pnl-chart');
  if (!canvas) return;
  const ctx = canvas.getContext('2d');
  const dpr = window.devicePixelRatio || 1;
  canvas.width  = canvas.offsetWidth * dpr;
  canvas.height = canvas.offsetHeight * dpr;
  ctx.scale(dpr, dpr);
  const w = canvas.offsetWidth, h = canvas.offsetHeight;
  ctx.clearRect(0, 0, w, h);

  const isDark = document.documentElement.getAttribute('data-theme') === 'dark';
  const data   = acc.pnl_history;

  if (data.length < 2) {
    ctx.fillStyle = isDark ? 'rgba(74,99,117,0.5)' : 'rgba(100,120,160,0.4)';
    ctx.font = '11px JetBrains Mono, monospace';
    ctx.textAlign = 'center';
    ctx.fillText('No trade data yet', w / 2, h / 2);
    return;
  }

  const pad = { top: 10, bot: 10, left: 6, right: 6 };
  const gw = w - pad.left - pad.right;
  const gh = h - pad.top - pad.bot;
  const min = Math.min(...data, 0), max = Math.max(...data, 0.01);
  const toX = i => pad.left + (i / (data.length - 1)) * gw;
  const toY = v => pad.top + (1 - (v - min) / (max - min)) * gh;

  ctx.strokeStyle = isDark ? 'rgba(74,99,117,0.4)' : 'rgba(180,200,230,0.6)';
  ctx.lineWidth = 1;
  ctx.setLineDash([4, 4]);
  ctx.beginPath(); ctx.moveTo(pad.left, toY(0)); ctx.lineTo(pad.left + gw, toY(0)); ctx.stroke();
  ctx.setLineDash([]);

  const lineColor = acc.daily_profit >= 0 ? '#34d399' : '#f87171';
  const grad = ctx.createLinearGradient(0, pad.top, 0, h - pad.bot);
  grad.addColorStop(0, acc.daily_profit >= 0 ? 'rgba(52,211,153,0.2)' : 'rgba(248,113,113,0.2)');
  grad.addColorStop(1, 'rgba(0,0,0,0)');

  ctx.beginPath();
  ctx.moveTo(toX(0), toY(data[0]));
  data.forEach((v, i) => { if (i > 0) ctx.lineTo(toX(i), toY(v)); });
  ctx.lineTo(toX(data.length - 1), h - pad.bot);
  ctx.lineTo(toX(0), h - pad.bot);
  ctx.closePath();
  ctx.fillStyle = grad; ctx.fill();

  ctx.beginPath();
  ctx.moveTo(toX(0), toY(data[0]));
  data.forEach((v, i) => { if (i > 0) ctx.lineTo(toX(i), toY(v)); });
  ctx.strokeStyle = lineColor; ctx.lineWidth = 2; ctx.stroke();

  ctx.beginPath(); ctx.arc(toX(data.length - 1), toY(data[data.length - 1]), 4, 0, Math.PI * 2);
  ctx.fillStyle = lineColor; ctx.fill();
}

/* ── Console / Toast ── */
function accLog(msg, type = 'info') {
  const el = document.getElementById('acc-console');
  if (!el) return;
  const line = document.createElement('div');
  line.className = `acc-log-line acc-log-${type}`;
  line.textContent = `[${new Date().toLocaleTimeString()}] ${msg}`;
  el.appendChild(line);
  el.scrollTop = el.scrollHeight;
  while (el.children.length > 200) el.removeChild(el.firstChild);
}

function accClearConsole() {
  const c = document.getElementById('acc-console');
  if (c) c.innerHTML = '';
}

function accToast(msg, type = 'info') {
  const el = document.createElement('div');
  el.className  = `acc-toast ${type}`;
  el.textContent = msg;
  document.getElementById('acc-toast-container').appendChild(el);
  setTimeout(() => el.parentNode && el.parentNode.removeChild(el), 4200);
}

/* ── Bot init (called once) ── */
let accBotInit = false;

function initAccumBot() {
  if (accBotInit) return;
  accBotInit = true;
  
  // Set default values for inputs
  setTimeout(() => {
    const tpTrade = document.getElementById('acc-cfg-tp-trade');
    if (tpTrade) tpTrade.value = '10'; // Default 10%
    
    const martMult = document.getElementById('acc-cfg-mult');
    if (martMult) martMult.value = '10'; // Default 10x
    
    // Add auto mode indicator
    const statusChip = document.getElementById('acc-trading-status-chip');
    if (statusChip) {
      statusChip.innerHTML = '<span class="acc-chip acc-chip-blue">WAITING</span>';
    }
  }, 100);
  
  accBuildSymbolCards();
  accDrawChart();
  accUpdateUI();
  setInterval(accUpdateUI, 1500);
  setInterval(accCheckNewDay, 10000);
  window.addEventListener('resize', accDrawChart);
  accLog('✅ MANUAL MODE active — trades only from HL Analysis buttons', 'info');
  accLog('✅ TP per trade: 10% | Martingale: 10x | Auto re-entry ON (300ms delay)', 'info');
}
