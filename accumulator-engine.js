/**
 * accumulator-engine.js — REPLACED WITH accumulators.py 5-RULE CONFLUENCE LOGIC
 * Strict entry only when ALL 5 rules pass + 3 consecutive ticks confirmation.
 */

const AccumEngine = (() => {
  /* ── Math helpers (kept for 6-tick survival grid) ── */
  function erf(x) {
    const t = 1 / (1 + 0.3275911 * Math.abs(x));
    const p = t * (0.254829592 + t * (-0.284496736 + t * (1.421413741 + t * (-1.453152027 + t * 1.061405429))));
    const v = 1 - p * Math.exp(-x * x);
    return x < 0 ? -v : v;
  }
  function Phi(z) { return 0.5 * (1 + erf(z / Math.SQRT2)); }

  /* ── Python-ported 5 strict rules ── */
  function computeEMA(prices, period) {
    if (prices.length < period) return null;
    let ema = prices[prices.length - period];
    const k = 2 / (period + 1);
    for (let i = prices.length - period + 1; i < prices.length; i++) {
      ema = prices[i] * k + ema * (1 - k);
    }
    return ema;
  }

  function computeRSI(prices, period = 14) {
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

  function ruleTrend(prices) {
    const ema20 = computeEMA(prices, 20);
    const ema50 = computeEMA(prices, 50);
    if (!ema20 || !ema50) return null;
    const sep = Math.abs(ema20 - ema50) / ema50;
    if (sep < 0.0003) return null;
    return ema20 > ema50 ? "UP" : "DOWN";
  }

  function ruleLowVol(prices) {
    if (prices.length < 31) return false;
    const diffs = [];
    for (let i = prices.length - 30; i < prices.length; i++) diffs.push(Math.abs(prices[i] - prices[i - 1]));
    const avgMove = diffs.reduce((a, b) => a + b, 0) / diffs.length || 0;
    const lastMove = Math.abs(prices[prices.length - 1] - prices[prices.length - 2]);
    if (lastMove > 1.5 * avgMove) return false;
    const recent = prices.slice(-30);
    const range = Math.max(...recent) - Math.min(...recent);
    if (range > 1.8 * avgMove * 30) return false;
    return true;
  }

  function rulePullback(prices) {
    const ema = computeEMA(prices, 20);
    if (!ema || ema < 1e-9) return false;
    const price = prices[prices.length - 1];
    return Math.abs(price - ema) / ema <= 0.0008;
  }

  function ruleRSI(prices) {
    const rsi = computeRSI(prices);
    if (!rsi) return false;
    return 45 < rsi && rsi < 55;
  }

  function ruleNoRun(prices) {
    if (prices.length < 9) return false;
    const diffs = [];
    for (let i = prices.length - 9; i < prices.length; i++) diffs.push(prices[i] - prices[i - 1]);
    const signs = diffs.map(d => Math.sign(d));
    const up = signs.filter(s => s > 0).length;
    const down = signs.filter(s => s < 0).length;
    return up < 7 && down < 7;
  }

  const MIN_TICKS = 80;

  function calc(sym, prices, barrier) {
    if (!prices || prices.length < MIN_TICKS) return null;

    const passedRules = [
      ruleTrend(prices) !== null,
      ruleLowVol(prices),
      rulePullback(prices),
      ruleRSI(prices),
      ruleNoRun(prices)
    ].filter(Boolean).length;

    const survScore = Math.round(passedRules * 20); // 100 = all 5 rules

    /* Keep 6-tick survival grid + stats for UI */
    const n = prices.length;
    const all_d = [];
    for (let i = 1; i < n; i++) all_d.push(prices[i] - prices[i - 1]);
    const d30 = all_d.slice(-30);
    const abs30 = d30.map(Math.abs);
    const mean30 = abs30.reduce((a, b) => a + b, 0) / abs30.length;
    const sigma = Math.sqrt(abs30.reduce((a, b) => a + (b - mean30) ** 2, 0) / abs30.length) || 1e-9;
    const mu = d30.reduce((a, b) => a + b, 0) / d30.length;
    const absMu = Math.abs(mu);
    const worstSpike = Math.max(...all_d.slice(-40).map(Math.abs));

    let streak = 0;
    for (let i = all_d.length - 1; i >= 0 && streak < 20; i--) {
      if (Math.abs(all_d[i]) < barrier * 0.12) streak++; else break;
    }

    const ticks = [];
    let cumP = 1;
    for (let t = 1; t <= 6; t++) {
      const sqt = sigma * Math.sqrt(t);
      const p = Math.max(0, Math.min(1, Phi((barrier - absMu * t) / sqt) - Phi((-barrier - absMu * t) / sqt)));
      cumP *= p;
      const pct = Math.round(cumP * 100);
      ticks.push({ t, pct, tier: pct >= 70 ? "safe" : pct >= 45 ? "risky" : "danger" });
    }

    const rsi = computeRSI(prices);

    let verdict, vClass, regime;
    if (passedRules === 5) {
      verdict = "⚡ ENTER NOW — ALL 5 RULES MET";
      vClass = "signal-very-strong";
      regime = "🟢 QUIET — IDEAL ENTRY";
    } else if (passedRules >= 4) {
      verdict = "⏳ CAUTION — WAIT FOR CALM";
      vClass = "signal-building";
      regime = "🟡 RANGING — MONITOR";
    } else {
      verdict = "🚫 AVOID — HIGH KNOCKOUT RISK";
      vClass = "signal-lower";
      regime = "🔴 CHOPPY — AVOID";
    }

    return {
      survScore,
      verdict,
      vClass,
      regime,
      rsi: rsi ? Math.round(rsi) : null,
      sigma,
      worstSpike,
      absMu,
      streak,
      B: barrier,
      ticks,
      spark: prices.slice(-40),
      passedRules   // ← used for confirmation streak
    };
  }

  return { calc, MIN_TICKS, Phi, erf };
})();
