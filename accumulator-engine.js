/**
 * accumulator-engine.js
 * Pure mathematical core for the Accumulator Survival Engine v5.
 *
 * ══════════════════════════════════════════════════════════════
 * Deriv Accumulator: KNOCKOUT if |price - entry| >= B on any tick.
 * We answer: "What is P(survive all 6 ticks from NOW)?"
 *
 * We model tick increments as weakly dependent with:
 *   mu    = mean signed delta/tick    (drift, last 30)
 *   sigma = std-dev of |delta|/tick   (vol,   last 30)
 *
 * 5 SURVIVAL METRICS (each 0–100%):
 *
 * M1  σ-Headroom  (w=0.28)
 *     score = clamp((B - sigma) / B, 0, 1)
 *
 * M2  Spike Guard  (w=0.22)
 *     worstSpike = max |delta| in last 40 ticks
 *     score = clamp((B - worstSpike*1.5) / B, 0, 1)
 *
 * M3  Acceleration Calm  (w=0.18)
 *     sigma_10 = vol last 10 ticks; sigma_old = vol ticks 20-40
 *     score = clamp(1 - (sigma_10 - sigma_old)/sigma_old, 0, 1)
 *
 * M4  Drift Neutral  (w=0.18)
 *     score = clamp(1 - |mu|/(B*0.15), 0, 1)
 *
 * M5  Quiet Streak  (w=0.14)
 *     streak = consecutive ticks where |delta| < B*0.12
 *     score = clamp(streak/12, 0, 1)
 *
 * COMPOSITE S = sum(w_i * score_i) * 100
 *
 * 6-TICK PROBABILITY:
 *   P(survive t ticks) ≈ Phi((B - |mu|*t)/(sigma*sqrt(t)))
 *                       - Phi((-B - |mu|*t)/(sigma*sqrt(t)))
 *
 * VERDICT:
 *   S >= 78 AND P(T+6) >= 60%  →  ENTER NOW
 *   S >= 62 OR  P(T+6) >= 40%  →  CAUTION / WAIT
 *   else                        →  AVOID
 * ══════════════════════════════════════════════════════════════
 */

const AccumEngine = (() => {
  /* ── Math helpers ── */
  function erf(x) {
    const t = 1 / (1 + 0.3275911 * Math.abs(x));
    const p = t * (0.254829592 + t * (-0.284496736 + t * (1.421413741 + t * (-1.453152027 + t * 1.061405429))));
    const v = 1 - p * Math.exp(-x * x);
    return x < 0 ? -v : v;
  }

  function Phi(z) { return 0.5 * (1 + erf(z / Math.SQRT2)); }

  /* ── Public constants ── */
  const META_KEYS   = ['sigmaHeadroom', 'spikeGuard', 'accelCalm', 'driftNeutral', 'quietStreak'];
  const META_LABELS = ['σ-Headroom', 'Spike Guard', 'Accel Calm', 'Drift Neutral', 'Quiet Streak'];
  const META_COLORS = ['#3b82f6', '#8b5cf6', '#06b6d4', '#f97316', '#34d399'];
  const META_TIPS   = [
    'Barrier headroom vs tick σ — higher = more space before knockout',
    'Worst recent spike (×1.5 safety margin) vs barrier',
    'Is volatility accelerating? High = regime change risk',
    'Directional bias — ranging market is ideal for accumulators',
    'Consecutive calm ticks immediately before entry',
  ];
  const MIN_TICKS = 80;

  /* ── Core calculation ── */
  function calc(sym, prices, barrier) {
    const B = barrier;
    if (!prices || prices.length < MIN_TICKS) return null;

    const n      = prices.length;
    const all_d  = [];
    for (let i = 1; i < n; i++) all_d.push(prices[i] - prices[i - 1]);

    const d30    = all_d.slice(-30);
    const abs30  = d30.map(Math.abs);
    const abs10  = all_d.slice(-10).map(Math.abs);
    const abs_old= all_d.slice(-40, -20).map(Math.abs);
    const abs40  = all_d.slice(-40).map(Math.abs);

    const mean30 = abs30.reduce((a, b) => a + b, 0) / abs30.length;
    const sigma  = Math.sqrt(abs30.reduce((a, b) => a + (b - mean30) ** 2, 0) / abs30.length) || 1e-9;

    const mean10   = abs10.reduce((a, b) => a + b, 0) / abs10.length;
    const sigma10  = Math.sqrt(abs10.reduce((a, b) => a + (b - mean10) ** 2, 0) / abs10.length) || 1e-9;
    const meanOld  = abs_old.length ? abs_old.reduce((a, b) => a + b, 0) / abs_old.length : mean30;
    const sigmaOld = abs_old.length
      ? Math.sqrt(abs_old.reduce((a, b) => a + (b - meanOld) ** 2, 0) / abs_old.length) || 1e-9
      : sigma;

    const mu        = d30.reduce((a, b) => a + b, 0) / d30.length;
    const absMu     = Math.abs(mu);
    const worstSpike= Math.max(...abs40);

    let streak = 0;
    for (let i = all_d.length - 1; i >= 0 && streak < 20; i--) {
      if (Math.abs(all_d[i]) < B * 0.12) streak++; else break;
    }

    const s1 = Math.max(0, Math.min(1, (B - sigma) / B));
    const s2 = Math.max(0, Math.min(1, (B - worstSpike * 1.5) / B));
    const s3 = Math.max(0, Math.min(1, 1 - (sigma10 - sigmaOld) / Math.max(sigmaOld, 1e-12)));
    const s4 = Math.max(0, Math.min(1, 1 - absMu / (B * 0.15)));
    const s5 = Math.min(1, streak / 12);

    const survScore = Math.round((s1 * 0.28 + s2 * 0.22 + s3 * 0.18 + s4 * 0.18 + s5 * 0.14) * 100);

    /* 6-tick survival probability */
    const ticks = [];
    let cumP = 1;
    for (let t = 1; t <= 6; t++) {
      const sqt = sigma * Math.sqrt(t);
      const p   = Math.max(0, Math.min(1, Phi((B - absMu * t) / sqt) - Phi((-B - absMu * t) / sqt)));
      cumP *= p;
      const pct = Math.round(cumP * 100);
      ticks.push({ t, pct, tier: pct >= 70 ? 'safe' : pct >= 45 ? 'risky' : 'danger' });
    }

    const t6 = ticks[5].pct;
    let verdict, vClass;
    if      (survScore >= 78 && t6 >= 60) { verdict = '⚡ ENTER NOW — CONDITIONS MET'; vClass = 'signal-very-strong'; }
    else if (survScore >= 62 || t6 >= 40) { verdict = '⏳ CAUTION — WAIT FOR CALM';    vClass = 'signal-building'; }
    else                                  { verdict = '🚫 AVOID — HIGH KNOCKOUT RISK'; vClass = 'signal-lower'; }

    const cv = sigma / mean30;
    let regime;
    if      (streak >= 8 && sigma < B * 0.12)          regime = '🟢 QUIET — IDEAL ENTRY';
    else if (sigma < B * 0.18 && absMu < B * 0.06)     regime = '🟡 RANGING — MONITOR';
    else if (cv > 0.9)                                   regime = '🔴 CHOPPY — AVOID';
    else if (absMu > B * 0.10)                          regime = '🔴 TRENDING — AVOID';
    else                                                 regime = '🟡 MIXED — WAIT';

    /* RSI (last 10 bars) */
    let rsi = null;
    const g = [], l2 = [];
    for (let i = Math.max(1, n - 10); i < n; i++) {
      const dd = prices[i] - prices[i - 1];
      g.push(dd > 0 ? dd : 0);
      l2.push(dd < 0 ? -dd : 0);
    }
    const ag = g.reduce((a, b) => a + b, 0) / g.length;
    const al = l2.reduce((a, b) => a + b, 0) / l2.length;
    rsi = al === 0 ? 100 : 100 - (100 / (1 + ag / al));

    return {
      survScore, verdict, vClass, regime, rsi,
      sigma, worstSpike, absMu, streak, B, ticks,
      metrics: {
        sigmaHeadroom: Math.round(s1 * 100),
        spikeGuard:    Math.round(s2 * 100),
        accelCalm:     Math.round(s3 * 100),
        driftNeutral:  Math.round(s4 * 100),
        quietStreak:   Math.round(s5 * 100),
      },
      spark: prices.slice(-40),
    };
  }

  return { calc, MIN_TICKS, META_KEYS, META_LABELS, META_COLORS, META_TIPS, Phi, erf };
})();
