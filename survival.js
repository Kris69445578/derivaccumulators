/**
 * survival.js
 * Survival bar computation engine (6σ barrier model)
 * Used by both the HL Analysis tab and the Accumulator Bot.
 */

const SurvivalEngine = (() => {
  const store = {};

  function init(symbol) {
    store[symbol] = { prices: [] };
  }

  function update(symbol, price) {
    if (!store[symbol]) init(symbol);
    const s = store[symbol];
    s.prices.push(price);
    if (s.prices.length > 200) s.prices.shift();
  }

  function score(symbol, barrierHigher, barrierLower) {
    const s = store[symbol];
    if (!s || s.prices.length < 8) return null;

    const prices = s.prices;
    const window = prices.slice(-31);
    const diffs  = [];

    for (let i = 1; i < window.length; i++)
      diffs.push(Math.abs(window[i] - window[i - 1]));

    const mean   = diffs.reduce((a, b) => a + b, 0) / diffs.length;
    const sigma  = Math.sqrt(diffs.reduce((a, b) => a + (b - mean) ** 2, 0) / diffs.length);
    const maxMove = Math.max(...diffs);

    const absUp   = Math.abs(barrierHigher);
    const absDown = Math.abs(barrierLower);
    const B       = Math.min(absUp, absDown);
    const envelope6 = Math.sqrt(6) * sigma;
    const ratio     = B > 0 ? envelope6 / B : 99;
    const fill      = Math.max(0, Math.min(100, Math.round((1 - Math.min(ratio, 2) / 2) * 100)));

    let tier;
    if      (ratio <= 0.5) tier = 'safe';
    else if (ratio <= 1.0) tier = 'risky';
    else                   tier = 'danger';

    const filledTicks = Math.min(6, Math.floor(B / (sigma || Infinity)));
    const verb = `σ/tick ${mean.toFixed(5)}  ·  6σ envelope ${envelope6.toFixed(5)}  ·  barrier ${B.toFixed(5)}  ·  ratio ${ratio.toFixed(2)}×`;

    return { fill, tier, verb, filledTicks, sigma: mean, envelope6, B, ratio, maxMove };
  }

  function updateBar(symbol, barrierHigher, barrierLower) {
    const result  = score(symbol, barrierHigher, barrierLower);
    const wrapper = document.getElementById(`surv-wrap-${symbol}`);
    const fillEl  = document.getElementById(`surv-fill-${symbol}`);
    const pctEl   = document.getElementById(`surv-pct-${symbol}`);
    const verdict = document.getElementById(`surv-verdict-${symbol}`);
    const ticksRow= document.getElementById(`surv-ticks-${symbol}`);

    if (!wrapper || !fillEl || !pctEl || !verdict || !ticksRow) return;

    if (!result) {
      pctEl.textContent   = '—';
      verdict.textContent = 'Collecting tick data…';
      return;
    }

    const { fill, tier, verb, filledTicks, ratio } = result;

    wrapper.className          = `survival-wrapper ${tier}`;
    fillEl.style.width         = fill + '%';
    fillEl.className           = `survival-fill ${tier}`;
    pctEl.textContent          = ratio.toFixed(2) + '×';
    pctEl.className            = `survival-pct ${tier}`;
    verdict.textContent        = verb;

    const dots = ticksRow.querySelectorAll('.survival-tick-dot');
    dots.forEach((dot, i) => {
      dot.className = 'survival-tick-dot' + (i < filledTicks ? ` filled-${tier}` : '');
    });
  }

  return { init, update, score, updateBar };
})();
