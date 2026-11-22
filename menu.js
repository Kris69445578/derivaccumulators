/**
 * menu.js — the Menu (home) tab.
 * The four template tabs build their own markup (tab-*.js); app.js injects everything.
 */

function buildMenuTab() {
  const C = window.JAHIM_CONFIG;
  return `
<div id="menu-tab" class="tab-content active">
  <div class="menu-tab-wrapper">

    <!-- Theme toggle -->
    <div style="display:flex;justify-content:flex-end;margin-bottom:1.2rem;">
      <div onclick="toggleTheme()" id="menu-theme-track" data-dark="0"
        style="display:flex;align-items:center;gap:10px;padding:8px 16px;
        background:var(--bg-card);border:1px solid var(--border);border-radius:30px;
        cursor:pointer;transition:all 0.2s;user-select:none;">
        <span style="font-size:1rem;">🌙</span>
        <div style="position:relative;width:40px;height:22px;background:var(--bg-input);border:1px solid var(--border);border-radius:22px;transition:background 0.3s;flex-shrink:0;" id="menu-theme-pill">
          <div id="menu-theme-thumb" style="position:absolute;top:3px;left:3px;width:14px;height:14px;background:var(--text-muted);border-radius:50%;transition:transform 0.25s ease,background 0.3s;"></div>
        </div>
        <span id="menu-theme-label" style="font-family:var(--font-mono);font-size:0.72rem;font-weight:600;color:var(--text-secondary);letter-spacing:0.5px;text-transform:uppercase;min-width:60px;">Light Mode</span>
        <span style="font-size:1rem;">☀️</span>
      </div>
    </div>

    <div class="menu-hero">
      <div class="menu-hero-badge">🚀 JAHIM TRADER · New Deriv API</div>
      <h1>Welcome to Your<br>D-Traders Suite</h1>
      <p>Four ready-to-trade templates on the new Deriv API — Accumulators, Bot, Digits and Rise/Fall. Log in once and trade from any tab.</p>
    </div>

    <div class="menu-actions-grid">

      <a class="menu-action-card card-blue" href="${C.SIGNUP_URL}" target="_blank" rel="noopener">
        <div class="menu-card-icon">🆓</div>
        <span class="menu-card-label label-blue">New Trader</span>
        <div class="menu-card-title">Don't have a Deriv account?</div>
        <div class="menu-card-desc">Create your free Deriv account in minutes and start trading volatility indices with a demo balance instantly.</div>
        <div class="menu-card-arrow arr-blue">Open Deriv Registration →</div>
      </a>

      <a class="menu-action-card card-green" href="${C.DASHBOARD_URL}" target="_blank" rel="noopener">
        <div class="menu-card-icon">🔑</div>
        <span class="menu-card-label label-green">Developers</span>
        <div class="menu-card-title">Manage your app &amp; tokens</div>
        <div class="menu-card-desc">Open the Deriv API dashboard to edit your app's redirect URLs, or create a Personal Access Token for the "API Token" button.</div>
        <div class="menu-card-arrow arr-green">Open API Dashboard →</div>
      </a>

      <a class="menu-action-card card-orange" href="${C.DERIV_APP_URL}" target="_blank" rel="noopener">
        <div class="menu-card-icon">💳</div>
        <span class="menu-card-label label-orange">Fund Account</span>
        <div class="menu-card-title">Deposit to start trading</div>
        <div class="menu-card-desc">Fund your Deriv wallet easily via M-Pesa, bank transfer, crypto and many more payment methods — fast &amp; secure.</div>
        <div class="menu-card-arrow arr-orange">Open Deriv →</div>
      </a>

      <a class="menu-action-card card-purple" href="https://chat.whatsapp.com/IofZic4i8Uo2Rk4uawPG05" target="_blank" rel="noopener">
        <div class="menu-card-icon">💬</div>
        <span class="menu-card-label label-purple">Community</span>
        <div class="menu-card-title">Join other traders</div>
        <div class="menu-card-desc">Connect with fellow Deriv traders on WhatsApp — share signals, strategies, and daily market insights with the group.</div>
        <div class="menu-card-arrow arr-purple">Join WhatsApp Group →</div>
      </a>

    </div>

    <div class="menu-info-grid menu-templates">
      <div class="menu-info-card clickable" onclick="showTab('tab-accumulators')"><div class="menu-info-icon">🔄</div><div class="menu-info-title">Accumulators</div><div class="menu-info-text">Your stake grows by a chosen growth rate for every tick that stays within the barrier range.</div></div>
      <div class="menu-info-card clickable" onclick="showTab('tab-bot')"><div class="menu-info-icon">🤖</div><div class="menu-info-title">Bot</div><div class="menu-info-text">Build a strategy from blocks — entry conditions, martingale, take profit and stop loss — and run it automatically.</div></div>
      <div class="menu-info-card clickable" onclick="showTab('tab-digits')"><div class="menu-info-icon">🔢</div><div class="menu-info-title">Digits</div><div class="menu-info-text">Matches/Differs, Even/Odd and Over/Under with a live last-digit frequency chart.</div></div>
      <div class="menu-info-card clickable" onclick="showTab('tab-risefall')"><div class="menu-info-icon">📈</div><div class="menu-info-title">Rise / Fall</div><div class="menu-info-text">Predict whether the market ends higher or lower. Ticks to days, stake or payout, optional "allow equals".</div></div>
      <div class="menu-info-card"><div class="menu-info-icon">🔐</div><div class="menu-info-title">Secure login</div><div class="menu-info-text">OAuth 2.0 with PKCE — your Deriv password never touches this site. Or use a Personal Access Token.</div></div>
      <div class="menu-info-card"><div class="menu-info-icon">🌙</div><div class="menu-info-title">Dark &amp; Light Mode</div><div class="menu-info-text">Seamless theme switching — trade comfortably in any lighting condition, any time of day.</div></div>
    </div>

    <div class="menu-tips-section">
      <div class="menu-tips-title">⚡ Quick Trading Tips</div>
      <div class="tips-grid">
        <div class="tip-item"><span class="tip-icon">💡</span><div class="tip-text"><strong>Start with a demo account</strong>Open the account menu (top right) and switch to Demo. Test every strategy there before using real money.</div></div>
        <div class="tip-item"><span class="tip-icon">🛡️</span><div class="tip-text"><strong>Be careful with martingale</strong>Multiplying your stake after losses grows risk fast. Keep the max steps low and always set a stop loss in the Bot tab.</div></div>
        <div class="tip-item"><span class="tip-icon">🎯</span><div class="tip-text"><strong>Set a session take profit</strong>The Bot stops itself once your profit target is reached — protect your gains.</div></div>
        <div class="tip-item"><span class="tip-icon">🔄</span><div class="tip-text"><strong>Accumulators knock out</strong>One tick outside the barrier range ends the contract and loses the stake. Close early to bank profit.</div></div>
        <div class="tip-item"><span class="tip-icon">🔢</span><div class="tip-text"><strong>Digit stats aren't a promise</strong>Each tick is independent. Frequencies show what happened, not what will happen next.</div></div>
        <div class="tip-item"><span class="tip-icon">🕐</span><div class="tip-text"><strong>Use a cooldown</strong>A short pause between bot trades avoids over-trading and gives you time to react.</div></div>
      </div>
    </div>

    <div class="menu-setup">
      <div class="menu-tips-title">🔧 Connection setup</div>
      <p class="menu-setup-p">For <b>Log in</b> to work, the redirect URL below must be added (exactly, including the trailing slash) to your app's <b>Redirect URLs</b> on the
        <a href="${C.DASHBOARD_URL}" target="_blank" rel="noopener">Deriv API dashboard</a>.</p>
      <div class="menu-setup-row"><span>App ID</span><code id="setup-appid">—</code><button type="button" onclick="copyText('setup-appid')">Copy</button></div>
      <div class="menu-setup-row"><span>Redirect URL</span><code id="setup-redirect">—</code><button type="button" onclick="copyText('setup-redirect')">Copy</button></div>
    </div>

    <div class="menu-footer-note">
      💵 JAHIM TRADER · Built for Deriv Volatility Index Traders · Trade responsibly — never risk more than you can afford to lose
    </div>

  </div>
</div>`;
}
