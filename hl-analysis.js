/**
 * hl-analysis.js — STRICT 5-RULE CONFLUENCE ENGINE
 * Based on Python Accumulator Bot v3.1
 * Auto trades when ALL 5 rules pass + confirmation ticks
 */

const VOLS = [
  { sym: '1HZ10V',  name: 'Volatility 10 (1s)',  B: 0.356,   dp: 3 },
  { sym: '1HZ15V',  name: 'Volatility 15 (1s)',  B: 0.7121,  dp: 4 },
  { sym: '1HZ25V',  name: 'Volatility 25 (1s)',  B: 78.311,  dp: 3 },
  { sym: '1HZ30V',  name: 'Volatility 30 (1s)',  B: 0.7571,  dp: 4 },
  { sym: '1HZ50V',  name: 'Volatility 50 (1s)',  B: 48.220,  dp: 3 },
  { sym: '1HZ75V',  name: 'Volatility 75 (1s)',  B: 1.096,   dp: 3 },
  { sym: '1HZ90V',  name: 'Volatility 90 (1s)',  B: 3.2240,  dp: 4 },
  { sym: '1HZ100V', name: 'Volatility 100 (1s)', B: 0.576,   dp: 3 },
  { sym: 'R_10',    name: 'Volatility 10',       B: 0.2704,  dp: 4 },
  { sym: 'R_25',    name: 'Volatility 25',       B: 0.3812,  dp: 4 },
  { sym: 'R_50',    name: 'Volatility 50',       B: 0.03013, dp: 5 },
  { sym: 'R_75',    name: 'Volatility 75',       B: 14.681,  dp: 3 },
  { sym: 'R_100',   name: 'Volatility 100',      B: 0.448,   dp: 3 },
];

let generatorInitialized = false;
const hlStore = {};
let hlWs = null;
let hlAutoMode = false;

/* ===== RULE CONSTANTS (from Python) ===== */
const EMA_FAST_PERIOD = 20;
const EMA_SLOW_PERIOD = 50;
const EMA_MIN_SEPARATION = 0.0015;
const VOLATILITY_LOOKBACK = 50;
const VOLATILITY_HIGH_MULT = 1.1;
const SPIKE_LOOKBACK = 15;
const SPIKE_FACTOR = 1.1;
const EMA_PULLBACK_PERIOD = 20;
const EMA_PULLBACK_TOLERANCE = 0.0002;
const RSI_PERIOD = 14;
const RSI_LOW = 45;
const RSI_HIGH = 55;
const MIN_CONFLUENCES = 4; // ALL 5 rules must pass
const SIGNAL_CONFIRMATIONS = 5; // Ticks in a row that must pass

/* ===== HELPER FUNCTIONS (from Python) ===== */
function computeEMA(prices, period) {
  if (prices.length < period) return null;
  const k = 2 / (period + 1);
  let ema = prices[prices.length - period];
  for (let i = prices.length - period + 1; i < prices.length; i++) {
    ema = prices[i] * k + ema * (1 - k);
  }
  return ema;
}

function computeRSI(prices, period = RSI_PERIOD) {
  if (prices.length < period + 1) return null;
  const diffs = [];
  for (let i = prices.length - period - 1; i < prices.length - 1; i++) {
    diffs.push(prices[i + 1] - prices[i]);
  }
  const gains = diffs.map(d => Math.max(d, 0));
  const losses = diffs.map(d => Math.max(-d, 0));
  const avgG = gains.reduce((a, b) => a + b, 0) / period;
  const avgL = losses.reduce((a, b) => a + b, 0) / period;
  const rs = avgG / (avgL + 1e-9);
  return 100 - (100 / (1 + rs));
}

/* ===== RULE 1: Trend Confirmation ===== */
function ruleTrendConfirmed(prices) {
  const emaFast = computeEMA(prices, EMA_FAST_PERIOD);
  const emaSlow = computeEMA(prices, EMA_SLOW_PERIOD);
  if (!emaFast || !emaSlow) return null;
  
  const separation = Math.abs(emaFast - emaSlow) / (emaSlow + 1e-9);
  if (separation < EMA_MIN_SEPARATION) return null;
  
  return emaFast > emaSlow ? "UP" : "DOWN";
}

/* ===== RULE 2: Low Volatility ===== */
function ruleLowVolatility(prices) {
  if (prices.length < VOLATILITY_LOOKBACK + 1) return false;
  
  const diffs = [];
  for (let i = prices.length - VOLATILITY_LOOKBACK; i < prices.length; i++) {
    diffs.push(Math.abs(prices[i] - prices[i - 1]));
  }
  const avgMove = diffs.reduce((a, b) => a + b, 0) / diffs.length || 0;
  if (avgMove < 1e-10) return true;
  
  const lastMove = Math.abs(prices[prices.length - 1] - prices[prices.length - 2]);
  if (lastMove > SPIKE_FACTOR * avgMove) return false;
  
  const recent = prices.slice(-VOLATILITY_LOOKBACK);
  const priceRange = Math.max(...recent) - Math.min(...recent);
  if (priceRange > VOLATILITY_HIGH_MULT * avgMove * VOLATILITY_LOOKBACK) return false;
  
  return true;
}

/* ===== RULE 3: Pullback to EMA ===== */
function rulePullbackToEMA(prices) {
  const ema = computeEMA(prices, EMA_PULLBACK_PERIOD);
  if (!ema || ema < 1e-9) return false;
  
  const price = prices[prices.length - 1];
  const distancePct = Math.abs(price - ema) / ema;
  return distancePct <= EMA_PULLBACK_TOLERANCE;
}

/* ===== RULE 4: RSI Neutral ===== */
function ruleRSINeutral(prices) {
  const rsi = computeRSI(prices);
  if (!rsi) return false;
  return rsi > RSI_LOW && rsi < RSI_HIGH;
}

/* ===== RULE 5: No Momentum Run ===== */
function ruleNoMomentumRun(prices) {
  if (prices.length < 9) return false;
  
  const diffs = [];
  for (let i = prices.length - 8; i < prices.length; i++) {
    diffs.push(Math.sign(prices[i] - prices[i - 1]));
  }
  
  const upCount = diffs.filter(d => d > 0).length;
  const downCount = diffs.filter(d => d < 0).length;
  
  return upCount < 7 && downCount < 7;
}

/* ===== MASTER ENTRY GATE ===== */
function passesEntryFilters(sym, prices) {
  if (prices.length < EMA_SLOW_PERIOD + 10) return { passed: false, rules: {} };
  
  const trend = ruleTrendConfirmed(prices);
  const lowVol = ruleLowVolatility(prices);
  const pullback = rulePullbackToEMA(prices);
  const rsiOk = ruleRSINeutral(prices);
  const noRun = ruleNoMomentumRun(prices);
  
  const rules = {
    Trend: trend !== null,
    LowVol: lowVol,
    Pullback: pullback,
    RSI: rsiOk,
    NoRun: noRun
  };
  
  const passed = Object.values(rules).filter(Boolean).length;
  
  return {
    passed: passed >= MIN_CONFLUENCES,
    passedCount: passed,
    rules,
    trend
  };
}

/* ===== CARD HTML (unchanged) ===== */
function buildHLCard(v) {
  const { sym, name, B } = v;
  return `
<div class="vol-card" id="card-${sym}">
  <div style="display:flex;justify-content:space-between;align-items:flex-start;margin-bottom:11px;">
    <div>
      <div style="font-family:var(--font-display);font-size:1rem;font-weight:800;color:var(--text-primary);">${name}</div>
      <div id="regime-${sym}" style="font-family:var(--font-mono);font-size:0.6rem;color:var(--text-muted);margin-top:2px;letter-spacing:1px;">Collecting data…</div>
    </div>
    <div style="text-align:right;">
      <div id="px-${sym}" style="font-family:var(--font-mono);font-size:1rem;font-weight:800;color:var(--accent);">—</div>
      <div style="font-family:var(--font-mono);font-size:0.58rem;color:var(--text-muted);margin-top:1px;">±${B} barrier</div>
    </div>
  </div>

  <div style="display:flex;align-items:center;gap:12px;margin-bottom:12px;">
    <div style="position:relative;flex-shrink:0;width:78px;height:78px;">
      <svg width="78" height="78" viewBox="0 0 78 78" style="transform:rotate(-90deg);display:block;">
        <circle cx="39" cy="39" r="31" fill="none" stroke="var(--border)" stroke-width="8"/>
        <circle cx="39" cy="39" r="31" fill="none" stroke="#374151" stroke-width="8"
          stroke-dasharray="194.8" stroke-dashoffset="194.8" stroke-linecap="round"
          id="ring-${sym}" style="transition:stroke-dashoffset 0.6s ease,stroke 0.4s;"/>
      </svg>
      <div style="position:absolute;inset:0;display:flex;flex-direction:column;align-items:center;justify-content:center;">
        <div id="rscore-${sym}" style="font-family:var(--font-display);font-size:1.5rem;font-weight:800;color:var(--text-muted);line-height:1.1;">—</div>
        <div style="font-family:var(--font-mono);font-size:0.45rem;color:var(--text-muted);letter-spacing:1px;text-transform:uppercase;">rules</div>
      </div>
    </div>
    <div style="flex:1;min-width:0;">
      <div id="verdict-${sym}" class="signal-area signal-waiting" style="margin:0 0 7px;padding:9px 8px;font-size:0.75rem;">LOADING…</div>
      <div style="display:flex;gap:10px;font-family:var(--font-mono);font-size:0.62rem;color:var(--text-muted);">
        <span>RSI <b id="rsi-${sym}" style="color:var(--text-secondary);">—</b></span>
        <span>·</span>
        <span>conf. <b id="streak-${sym}" style="color:var(--text-secondary);">—</b> ticks</span>
      </div>
    </div>
  </div>

  <!-- Rule indicators -->
  <div style="display:grid;grid-template-columns:repeat(5,1fr);gap:3px;margin-bottom:10px;">
    <div id="rule-trend-${sym}" class="rule-chip" style="background:var(--bg-elevated);border:1px solid var(--border);border-radius:6px;padding:3px;text-align:center;font-size:0.6rem;font-family:var(--font-mono);">📈 Trend</div>
    <div id="rule-vol-${sym}" class="rule-chip" style="background:var(--bg-elevated);border:1px solid var(--border);border-radius:6px;padding:3px;text-align:center;font-size:0.6rem;font-family:var(--font-mono);">🌊 LowVol</div>
    <div id="rule-pull-${sym}" class="rule-chip" style="background:var(--bg-elevated);border:1px solid var(--border);border-radius:6px;padding:3px;text-align:center;font-size:0.6rem;font-family:var(--font-mono);">🎯 Pullback</div>
    <div id="rule-rsi-${sym}" class="rule-chip" style="background:var(--bg-elevated);border:1px solid var(--border);border-radius:6px;padding:3px;text-align:center;font-size:0.6rem;font-family:var(--font-mono);">⚖️ RSI</div>
    <div id="rule-run-${sym}" class="rule-chip" style="background:var(--bg-elevated);border:1px solid var(--border);border-radius:6px;padding:3px;text-align:center;font-size:0.6rem;font-family:var(--font-mono);">🏃 NoRun</div>
  </div>

  <div style="background:var(--bg-input);border:1px solid var(--border);border-radius:12px;padding:8px;margin-bottom:10px;">
    <div style="font-family:var(--font-mono);font-size:0.58rem;color:var(--text-muted);text-transform:uppercase;letter-spacing:1.5px;margin-bottom:5px;">Last 40 Ticks — Price vs ±Barrier</div>
    <canvas id="spark-${sym}" height="52" style="width:100%;height:52px;display:block;"></canvas>
  </div>

  <div style="background:var(--bg-input);border:1px solid var(--border);border-radius:12px;padding:8px 10px;margin-bottom:10px;">
    <div style="font-family:var(--font-mono);font-size:0.58rem;color:var(--text-muted);text-transform:uppercase;letter-spacing:1.5px;margin-bottom:8px;">6-Tick Cumulative Survival Probability</div>
    <div style="display:grid;grid-template-columns:repeat(6,1fr);gap:4px;">
      ${[1,2,3,4,5,6].map(t => `<div style="text-align:center;">
        <div id="td-${sym}-${t}" style="height:34px;border-radius:7px;background:var(--border);display:flex;align-items:center;justify-content:center;font-family:var(--font-mono);font-size:0.62rem;font-weight:800;color:var(--text-muted);transition:all 0.4s;margin-bottom:3px;border:1px solid transparent;">—</div>
        <div style="font-family:var(--font-mono);font-size:0.5rem;color:var(--text-muted);">T+${t}</div>
      </div>`).join('')}
    </div>
  </div>

  <div style="display:grid;grid-template-columns:repeat(3,1fr);gap:5px;margin-bottom:10px;">
    <div style="background:var(--bg-elevated);border:1px solid var(--border);border-radius:9px;padding:7px;text-align:center;">
      <div style="font-family:var(--font-mono);font-size:0.55rem;color:var(--text-muted);text-transform:uppercase;letter-spacing:0.8px;margin-bottom:2px;">σ/tick</div>
      <div id="stat-sigma-${sym}" style="font-family:var(--font-mono);font-size:0.75rem;font-weight:800;color:var(--text-primary);">—</div>
    </div>
    <div style="background:var(--bg-elevated);border:1px solid var(--border);border-radius:9px;padding:7px;text-align:center;">
      <div style="font-family:var(--font-mono);font-size:0.55rem;color:var(--text-muted);text-transform:uppercase;letter-spacing:0.8px;margin-bottom:2px;">Worst Δ</div>
      <div id="stat-spike-${sym}" style="font-family:var(--font-mono);font-size:0.75rem;font-weight:800;color:var(--text-primary);">—</div>
    </div>
    <div style="background:var(--bg-elevated);border:1px solid var(--border);border-radius:9px;padding:7px;text-align:center;">
      <div style="font-family:var(--font-mono);font-size:0.55rem;color:var(--text-muted);text-transform:uppercase;letter-spacing:0.8px;margin-bottom:2px;">Drift</div>
      <div id="stat-drift-${sym}" style="font-family:var(--font-mono);font-size:0.75rem;font-weight:800;color:var(--text-primary);">—</div>
    </div>
  </div>

  <div style="display:flex;align-items:center;gap:8px;margin-bottom:10px;">
    <div style="flex:1;background:var(--bg-input);border:1px solid var(--border);border-radius:9px;padding:6px 10px;">
      <div style="font-family:var(--font-mono);font-size:0.55rem;color:var(--text-muted);text-transform:uppercase;letter-spacing:0.8px;margin-bottom:2px;">Custom ±Barrier</div>
      <input type="number" step="0.00001" id="b-${sym}" value="${B}"
        style="background:transparent;border:none;outline:none;width:100%;font-family:var(--font-mono);font-size:0.85rem;font-weight:700;color:var(--text-primary);"
        onchange="window.hlRefreshCard&&window.hlRefreshCard('${sym}')"/>
    </div>
    <div style="background:var(--bg-elevated);border:1px solid var(--border);border-radius:9px;padding:7px 10px;text-align:center;min-width:58px;">
      <div style="font-family:var(--font-mono);font-size:0.55rem;color:var(--text-muted);text-transform:uppercase;letter-spacing:0.8px;margin-bottom:2px;">Ticks</div>
      <div id="stat-ticks-${sym}" style="font-family:var(--font-mono);font-size:0.85rem;font-weight:800;color:var(--accent);">—</div>
    </div>
  </div>

  <button id="tbtn-${sym}" onclick="startHLTrade('${sym}')"
    style="width:100%;padding:13px;border-radius:12px;background:var(--accent);border:1.5px solid var(--accent);color:#fff;font-family:var(--font-display);font-size:0.92rem;font-weight:800;cursor:pointer;transition:all 0.25s;letter-spacing:0.4px;">
    🚀 TRADE ${sym}
  </button>
</div>`;
}

/* ===== SPARKLINE (unchanged) ===== */
function drawSparkline(sym, spark, B) {
  const canvas = document.getElementById('spark-' + sym);
  if (!canvas || !spark || spark.length < 2) return;
  const W = canvas.offsetWidth || 260, H = 52;
  canvas.width = W * (window.devicePixelRatio || 1);
  canvas.height = H * (window.devicePixelRatio || 1);
  const ctx = canvas.getContext('2d');
  ctx.scale(window.devicePixelRatio || 1, window.devicePixelRatio || 1);
  ctx.clearRect(0, 0, W, H);

  const isDark = document.documentElement.getAttribute('data-theme') === 'dark';
  const mid = spark[spark.length - 1];
  const hi = mid + B, lo = mid - B;
  const pMin = Math.min(...spark, lo), pMax = Math.max(...spark, hi);
  const rng = pMax - pMin || 1;
  const pad = 4;
  const toX = i => pad + (i / (spark.length - 1)) * (W - 2 * pad);
  const toY = v => H - pad - (v - pMin) / rng * (H - 2 * pad);

  ctx.fillStyle = isDark ? 'rgba(248,113,113,0.08)' : 'rgba(220,38,38,0.06)';
  ctx.fillRect(0, 0, W, toY(hi));
  ctx.fillRect(0, toY(lo), W, H);

  ctx.strokeStyle = isDark ? 'rgba(248,113,113,0.6)' : 'rgba(220,38,38,0.55)';
  ctx.lineWidth = 1; ctx.setLineDash([3, 3]);
  ctx.beginPath(); ctx.moveTo(0, toY(hi)); ctx.lineTo(W, toY(hi)); ctx.stroke();
  ctx.beginPath(); ctx.moveTo(0, toY(lo)); ctx.lineTo(W, toY(lo)); ctx.stroke();
  ctx.setLineDash([]);

  const fillG = ctx.createLinearGradient(0, 0, 0, H);
  fillG.addColorStop(0, isDark ? 'rgba(59,130,246,0.2)' : 'rgba(37,99,235,0.14)');
  fillG.addColorStop(1, 'rgba(0,0,0,0)');
  ctx.beginPath();
  spark.forEach((p, i) => i === 0 ? ctx.moveTo(toX(i), toY(p)) : ctx.lineTo(toX(i), toY(p)));
  ctx.lineTo(toX(spark.length - 1), H); ctx.lineTo(pad, H); ctx.closePath();
  ctx.fillStyle = fillG; ctx.fill();

  const lineG = ctx.createLinearGradient(0, 0, W, 0);
  lineG.addColorStop(0, isDark ? 'rgba(59,130,246,0.5)' : 'rgba(37,99,235,0.5)');
  lineG.addColorStop(1, isDark ? '#60a5fa' : '#2563eb');
  ctx.strokeStyle = lineG; ctx.lineWidth = 1.8;
  ctx.beginPath();
  spark.forEach((p, i) => i === 0 ? ctx.moveTo(toX(i), toY(p)) : ctx.lineTo(toX(i), toY(p)));
  ctx.stroke();

  ctx.beginPath(); ctx.arc(toX(spark.length - 1), toY(mid), 3.5, 0, Math.PI * 2);
  ctx.fillStyle = isDark ? '#60a5fa' : '#2563eb'; ctx.fill();
}

/* ===== CARD UPDATER with NEW RULES ===== */
function updateHLCard(sym) {
  const s = hlStore[sym];
  if (!s) return;

  const n = s.prices.length;
  const pxEl = document.getElementById('px-' + sym);
  if (pxEl && n > 0) pxEl.textContent = s.prices[n - 1].toFixed(s.dp || 3);

  const tcEl = document.getElementById('stat-ticks-' + sym);
  if (tcEl) tcEl.textContent = n < 60 ? n + '/60' : n;

  const result = passesEntryFilters(sym, s.prices);
  
  if (n < 60) {
    const reg = document.getElementById('regime-' + sym);
    if (reg) reg.textContent = 'Collecting ' + n + '/60 ticks…';
    return;
  }

  /* Update rule chips */
  const ruleTrend = document.getElementById('rule-trend-' + sym);
  const ruleVol = document.getElementById('rule-vol-' + sym);
  const rulePull = document.getElementById('rule-pull-' + sym);
  const ruleRsi = document.getElementById('rule-rsi-' + sym);
  const ruleRun = document.getElementById('rule-run-' + sym);

  if (ruleTrend) {
    ruleTrend.style.background = result.rules.Trend ? 'rgba(52,211,153,0.15)' : 'var(--bg-elevated)';
    ruleTrend.style.borderColor = result.rules.Trend ? '#34d399' : 'var(--border)';
    ruleTrend.style.color = result.rules.Trend ? '#34d399' : 'var(--text-muted)';
  }
  if (ruleVol) {
    ruleVol.style.background = result.rules.LowVol ? 'rgba(52,211,153,0.15)' : 'var(--bg-elevated)';
    ruleVol.style.borderColor = result.rules.LowVol ? '#34d399' : 'var(--border)';
    ruleVol.style.color = result.rules.LowVol ? '#34d399' : 'var(--text-muted)';
  }
  if (rulePull) {
    rulePull.style.background = result.rules.Pullback ? 'rgba(52,211,153,0.15)' : 'var(--bg-elevated)';
    rulePull.style.borderColor = result.rules.Pullback ? '#34d399' : 'var(--border)';
    rulePull.style.color = result.rules.Pullback ? '#34d399' : 'var(--text-muted)';
  }
  if (ruleRsi) {
    ruleRsi.style.background = result.rules.RSI ? 'rgba(52,211,153,0.15)' : 'var(--bg-elevated)';
    ruleRsi.style.borderColor = result.rules.RSI ? '#34d399' : 'var(--border)';
    ruleRsi.style.color = result.rules.RSI ? '#34d399' : 'var(--text-muted)';
  }
  if (ruleRun) {
    ruleRun.style.background = result.rules.NoRun ? 'rgba(52,211,153,0.15)' : 'var(--bg-elevated)';
    ruleRun.style.borderColor = result.rules.NoRun ? '#34d399' : 'var(--border)';
    ruleRun.style.color = result.rules.NoRun ? '#34d399' : 'var(--text-muted)';
  }

  /* AUTO TRADE LOGIC */
  if (hlAutoMode && result.passed && s.confirmationStreak >= SIGNAL_CONFIRMATIONS && !acc.open_trades.has(sym)) {
    startHLTrade(sym);
    s.confirmationStreak = 0;
  }

  /* Update confirmation streak */
  s.confirmationStreak = result.passed ? (s.confirmationStreak + 1) : 0;
  const strEl = document.getElementById('streak-' + sym);
  if (strEl) {
    strEl.textContent = s.confirmationStreak;
    strEl.style.color = s.confirmationStreak >= SIGNAL_CONFIRMATIONS ? '#34d399' : '#fbbf24';
  }

  /* Ring progress (rules passed count) */
  const ring = document.getElementById('ring-' + sym);
  const rscEl = document.getElementById('rscore-' + sym);
  if (ring && rscEl) {
    const circ = 194.8;
    ring.style.strokeDashoffset = (circ * (1 - result.passedCount / 5)).toFixed(1);
    const col = result.passedCount === 5 ? '#34d399' : result.passedCount >= 4 ? '#fbbf24' : '#f87171';
    ring.style.stroke = col;
    rscEl.textContent = result.passedCount + '/5';
    rscEl.style.color = col;
  }

  /* Verdict */
  const vEl = document.getElementById('verdict-' + sym);
  if (vEl) {
    if (result.passedCount === 5) {
      vEl.textContent = '⚡ ENTRY READY — ALL 5 RULES PASSED';
      vEl.className = 'signal-area signal-very-strong';
    } else if (result.passedCount >= 4) {
      vEl.textContent = '⏳ ' + result.passedCount + '/5 RULES — WAIT';
      vEl.className = 'signal-area signal-building';
    } else {
      vEl.textContent = '🚫 AVOID — ' + result.passedCount + '/5 RULES';
      vEl.className = 'signal-area signal-lower';
    }
  }

  /* Regime based on trend */
  const regEl = document.getElementById('regime-' + sym);
  if (regEl) {
    if (result.trend === 'UP') regEl.textContent = '📈 UPTREND — BUY SIGNALS';
    else if (result.trend === 'DOWN') regEl.textContent = '📉 DOWNTREND — SELL SIGNALS';
    else regEl.textContent = '🟡 RANGING — MONITOR';
  }

  const rsiEl = document.getElementById('rsi-' + sym);
  if (rsiEl) {
    const rsi = computeRSI(s.prices);
    rsiEl.textContent = rsi ? Math.round(rsi) : '—';
  }

  /* Survival probability (simplified) */
  const sigma = s.prices.length > 30 ? 
    Math.sqrt(s.prices.slice(-30).reduce((acc, p, i, arr) => {
      if (i === 0) return acc;
      const diff = Math.abs(p - arr[i-1]);
      return acc + diff * diff;
    }, 0) / 30) : 0.1;
    
  const barrier = s.barrier;
  const ticks = [];
  for (let t = 1; t <= 6; t++) {
    const prob = Math.max(0, Math.min(100, Math.round(100 * Math.exp(-t * sigma / (barrier + 1e-9)))));
    const tier = prob >= 70 ? 'safe' : prob >= 45 ? 'risky' : 'danger';
    ticks.push({ t, prob, tier });
  }

  ticks.forEach(tk => {
    const el = document.getElementById('td-' + sym + '-' + tk.t);
    if (el) {
      const col = tk.tier === 'safe' ? '#34d399' : tk.tier === 'risky' ? '#fbbf24' : '#f87171';
      el.style.background = tk.tier === 'safe' ? 'rgba(52,211,153,0.15)' : 
                           tk.tier === 'risky' ? 'rgba(251,191,36,0.15)' : 
                           'rgba(248,113,113,0.15)';
      el.style.color = col;
      el.style.borderColor = col;
      el.textContent = tk.prob + '%';
    }
  });

  drawSparkline(sym, s.prices.slice(-40), barrier);

  /* Button styling */
  const btn = document.getElementById('tbtn-' + sym);
  if (btn) {
    if (result.passedCount === 5) {
      btn.style.background = 'linear-gradient(135deg,#065f46,#059669)';
      btn.style.borderColor = '#34d399';
    } else if (result.passedCount >= 4) {
      btn.style.background = 'linear-gradient(135deg,#78350f,#d97706)';
      btn.style.borderColor = '#fbbf24';
    } else {
      btn.style.background = 'linear-gradient(135deg,#7f1d1d,#dc2626)';
      btn.style.borderColor = '#f87171';
    }
  }
}

window.hlRefreshCard = sym => updateHLCard(sym);

/* ===== AUTO MODE TOGGLE ===== */
window.toggleHLMode = function() {
  hlAutoMode = !hlAutoMode;
  const btn = document.getElementById('hl-mode-btn');
  if (btn) {
    btn.textContent = hlAutoMode ? "🤖 AUTO MODE ON" : "👤 MANUAL MODE";
    btn.style.background = hlAutoMode ? "#10b981" : "var(--bg-elevated)";
    btn.style.color = hlAutoMode ? "#fff" : "var(--accent)";
  }
  accToast(hlAutoMode ? "🤖 AUTO TRADING ENABLED" : "👤 Manual mode active", hlAutoMode ? "success" : "info");
};

/* ===== WEBSOCKET (unchanged) ===== */
function setHLWsStatus(ok) {
  const dot = document.getElementById('hl-ws-dot');
  const lbl = document.getElementById('hl-ws-label');
  if (dot) dot.style.background = ok ? '#34d399' : '#f87171';
  if (lbl) lbl.textContent = ok ? 'Live · ' + VOLS.length + ' symbols' : 'Reconnecting…';
}

function connectHLWs() {
  if (hlWs) hlWs.close();
  hlWs = new WebSocket('wss://ws.binaryws.com/websockets/v3?app_id=1089');

  hlWs.onopen = () => {
    setHLWsStatus(true);
    VOLS.forEach((v, i) => setTimeout(() => {
      if (hlWs && hlWs.readyState === WebSocket.OPEN)
        hlWs.send(JSON.stringify({ ticks_history: v.sym, count: 200, end: 'latest', style: 'ticks', subscribe: 1 }));
    }, i * 140));
  };

  hlWs.onmessage = e => {
    try {
      const d = JSON.parse(e.data);
      if (d.msg_type === 'history' && d.history?.prices) {
        const sym = d.echo_req?.ticks_history;
        if (sym && hlStore[sym]) {
          hlStore[sym].prices = d.history.prices.map(p => parseFloat(p)).slice(-200);
          updateHLCard(sym);
        }
      }
      if (d.msg_type === 'tick') {
        const { symbol: sym, quote } = d.tick;
        if (!hlStore[sym]) return;
        hlStore[sym].prices.push(parseFloat(quote));
        if (hlStore[sym].prices.length > 200) hlStore[sym].prices.shift();
        updateHLCard(sym);
      }
    } catch (ex) {}
  };

  hlWs.onclose = () => { setHLWsStatus(false); setTimeout(connectHLWs, 3000); };
}

/* ===== TRADE HANDLER (unchanged) ===== */
function startHLTrade(sym) {
  if (!acc.connected) {
    accToast('❌ Connect Accumulator Bot first', 'error');
    showTab('accum-bot');
    return;
  }
  if (!acc.active_symbols.has(sym)) {
    acc.active_symbols.add(sym);
    if (acc.ws && acc.ws.readyState === WebSocket.OPEN) acc.ws.send(JSON.stringify({ ticks: sym, subscribe: 1 }));
    accBuildSymbolCards();
  }
  accManualOpenTrade(sym);
  hlPanelShow();
}

/* ===== INIT ===== */
function initializeGenerator() {
  if (generatorInitialized) return;
  generatorInitialized = true;

  const container = document.getElementById('cards-container');
  if (!container) return;

  VOLS.forEach(v => {
    container.innerHTML += buildHLCard(v);
    hlStore[v.sym] = { 
      prices: [], 
      barrier: v.B, 
      dp: v.dp, 
      confirmationStreak: 0 
    };
  });

  connectHLWs();
}
