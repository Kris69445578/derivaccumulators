/**
 * menu.js
 * Injects the Menu tab HTML into the page and registers it.
 * This keeps the main index.html lean — each tab owns its own markup.
 */

function buildMenuTab() {
  return `
<div id="menu-tab" class="tab-content active">
  <div class="menu-tab-wrapper">

    <!-- Theme toggle (moved from navbar) -->
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
      <div class="menu-hero-badge">🚀 JAHIM TRADER · HL Suite v3.0</div>
      <h1>Welcome to Your<br>D-Traders Suite</h1>
      <p>Your complete toolkit for Deriv volatility trading — signals, accumulator bot, and digit analysis all in one place.</p>
    </div>

    <div class="menu-actions-grid">

      <a class="menu-action-card card-blue" href="https://track.deriv.com/_j_K_n50wBctMjdsyM5hasGNd7ZgqdRLk/1/" target="_blank" rel="noopener">
        <div class="menu-card-icon">🆓</div>
        <span class="menu-card-label label-blue">New Trader</span>
        <div class="menu-card-title">Don't have a Deriv account?</div>
        <div class="menu-card-desc">Create your free Deriv account in minutes and start trading volatility indices with a demo balance instantly.</div>
        <div class="menu-card-arrow arr-blue">Open Deriv Registration →</div>
      </a>

      <a class="menu-action-card card-green" href="https://legacy-api.deriv.com/dashboard/" target="_blank" rel="noopener">
        <div class="menu-card-icon">🔑</div>
        <span class="menu-card-label label-green">API Access</span>
        <div class="menu-card-title">Get your API Token</div>
        <div class="menu-card-desc">Generate your Deriv API token to connect this suite's Accumulator Bot and Balance Checker to your account.</div>
        <div class="menu-card-arrow arr-green">Open API Dashboard →</div>
      </a>

      <a class="menu-action-card card-orange" href="https://app.deriv.com/?account=USD" target="_blank" rel="noopener">
        <div class="menu-card-icon">💳</div>
        <span class="menu-card-label label-orange">Fund Account</span>
        <div class="menu-card-title">Deposit to start trading</div>
        <div class="menu-card-desc">Fund your Deriv wallet easily via M-Pesa, bank transfer, crypto and many more payment methods — fast &amp; secure.</div>
        <div class="menu-card-arrow arr-orange">Open Deposit Page →</div>
      </a>

      <a class="menu-action-card card-purple" href="https://chat.whatsapp.com/IofZic4i8Uo2Rk4uawPG05" target="_blank" rel="noopener">
        <div class="menu-card-icon">💬</div>
        <span class="menu-card-label label-purple">Community</span>
        <div class="menu-card-title">Join other traders</div>
        <div class="menu-card-desc">Connect with fellow Deriv traders on WhatsApp — share signals, strategies, and daily market insights with the group.</div>
        <div class="menu-card-arrow arr-purple">Join WhatsApp Group →</div>
      </a>

    </div>

    <div class="menu-info-grid">
      <div class="menu-info-card"><div class="menu-info-icon">📊</div><div class="menu-info-title">HL Analysis</div><div class="menu-info-text">Multi-indicator signal engine with MACD, RSI, ADX, Bollinger Bands and 6σ survival bar.</div></div>
      <div class="menu-info-card"><div class="menu-info-icon">🔄</div><div class="menu-info-title">Accumulator Bot</div><div class="menu-info-text">Manual-trigger accumulator with martingale management, daily TP tracking and trade log.</div></div>
      <div class="menu-info-card"><div class="menu-info-icon">🔢</div><div class="menu-info-title">Digits Analyzer</div><div class="menu-info-text">Live digit frequency tracker across Volatility 10, 25, 50 &amp; 75 — spot over/under patterns.</div></div>
      <div class="menu-info-card"><div class="menu-info-icon">💰</div><div class="menu-info-title">Balance Checker</div><div class="menu-info-text">Instantly check your Deriv account balance via secure WebSocket — token never stored.</div></div>
      <div class="menu-info-card"><div class="menu-info-icon">🤖</div><div class="menu-info-title">Higher/Lower Tool</div><div class="menu-info-text">Full-featured Higher/Lower analysis tool with live Deriv market data and trade execution.</div></div>
      <div class="menu-info-card"><div class="menu-info-icon">🌙</div><div class="menu-info-title">Dark &amp; Light Mode</div><div class="menu-info-text">Seamless theme switching — trade comfortably in any lighting condition, any time of day.</div></div>
    </div>

    <div class="menu-tips-section">
      <div class="menu-tips-title">⚡ Quick Trading Tips</div>
      <div class="tips-grid">
        <div class="tip-item"><span class="tip-icon">📈</span><div class="tip-text"><strong>Wait for signal confirmation</strong>Only trade when the HL Analysis shows a strong signal (≥75% confidence) with at least 7 confirmations.</div></div>
        <div class="tip-item"><span class="tip-icon">🛡️</span><div class="tip-text"><strong>Manage your martingale</strong>Never let martingale exceed 3–4 levels. Use the Emergency Stop if consecutive losses hit 3+.</div></div>
        <div class="tip-item"><span class="tip-icon">🎯</span><div class="tip-text"><strong>Set a daily take profit</strong>Use the Accumulator Bot's daily TP feature. Once hit, stop for the day — protect your gains.</div></div>
        <div class="tip-item"><span class="tip-icon">📉</span><div class="tip-text"><strong>Watch the 6σ survival bar</strong>A ratio below 1.0 means the price envelope is close to the barrier — consider smaller stakes.</div></div>
        <div class="tip-item"><span class="tip-icon">🕐</span><div class="tip-text"><strong>Use the cooldown period</strong>Allow at least 3 seconds between trades on the same symbol to avoid over-trading noise.</div></div>
        <div class="tip-item"><span class="tip-icon">💡</span><div class="tip-text"><strong>Start with a demo account</strong>Test strategies on a Deriv demo before risking real capital — the signals work on both.</div></div>
      </div>
    </div>

    <div class="menu-footer-note">
      💵 JAHIM TRADER · Built for Deriv Volatility Index Traders · Trade responsibly — never risk more than you can afford to lose
    </div>

  </div>
</div>`;
}

function buildGeneratorTab() {
  return `
<div id="generator" class="tab-content">
  <div id="app-hl">
    <header>
      <span>📈 MLS ANALYSIS</span>
      <span id="hl-status-bar" style="font-family:var(--font-mono);font-size:0.72rem;color:var(--text-muted);display:flex;align-items:center;gap:8px;">
        <span id="hl-ws-dot" style="width:7px;height:7px;border-radius:50%;background:#374151;display:inline-block;"></span>
        <span id="hl-ws-label">Connecting…</span>
      </span>
    </header>
    <div class="main-content-hl" id="cards-container"></div>
  </div>
</div>`;
}

function buildAccumBotTab() {
  return `
<div id="accum-bot" class="tab-content">
  <div id="accum-bot-wrapper">
    <div id="accum-inner">
      <div class="acc-header">
        <div class="acc-logo">
          <div class="acc-logo-icon">⬡</div>
          <div class="acc-logo-text">
            <h2>Deriv Accumulator Bot</h2>
            <p>v3.0 · MANUAL TRIGGER MODE · App ID 129756</p>
          </div>
        </div>
        <div class="acc-header-right">
          <div class="acc-status-badge">
            <div class="acc-status-dot offline" id="acc-status-dot"></div>
            <span id="acc-status-text">OFFLINE</span>
          </div>
          <button class="acc-btn acc-btn-primary" id="acc-btn-connect" onclick="accToggleConnect()">CONNECT</button>
          <button class="acc-btn acc-btn-warning" id="acc-btn-pause" onclick="accTogglePause()" disabled>PAUSE</button>
          <button class="acc-btn acc-btn-danger" id="acc-btn-stop" onclick="accEmergencyStop()" disabled>STOP</button>
        </div>
      </div>

      <div class="acc-stats-grid">
        <div class="acc-stat-card"><div class="acc-stat-label">Balance</div><div class="acc-stat-value" id="acc-stat-balance">$0.00</div><div class="acc-stat-sub" id="acc-stat-currency">USD</div></div>
        <div class="acc-stat-card green"><div class="acc-stat-label">Daily P&amp;L</div><div class="acc-stat-value green" id="acc-stat-pnl">+$0.00</div><div class="acc-stat-sub">TP: $<span id="acc-stat-tp-val">10.00</span></div></div>
        <div class="acc-stat-card"><div class="acc-stat-label">Trades Today</div><div class="acc-stat-value" id="acc-stat-trades">0</div><div class="acc-stat-sub" id="acc-stat-wr">W: 0 &nbsp; L: 0</div></div>
        <div class="acc-stat-card yellow"><div class="acc-stat-label">Next Stake</div><div class="acc-stat-value yellow" id="acc-stat-stake">$1.00</div><div class="acc-stat-sub" id="acc-stat-mult-label">×1.00 martingale</div></div>
      </div>

      <div class="acc-main-grid">
        <!-- LEFT: Config + Symbols -->
        <div style="display:flex;flex-direction:column;gap:10px;">
          <div class="acc-panel">
            <div class="acc-panel-header">
              <span class="acc-panel-title">Configuration</span>
              <button class="acc-btn acc-btn-secondary" style="padding:3px 9px;font-size:10px;" onclick="accSaveConfig()">SAVE</button>
            </div>
            <div class="acc-panel-body">
              <div class="acc-config-section">
                <div class="acc-config-title">Account</div>
                <div class="acc-field"><label>API Token</label><input type="password" id="acc-cfg-token" placeholder="Your Deriv API token"/></div>
                <div class="acc-row">
                  <div class="acc-field"><label>Currency</label><select id="acc-cfg-currency"><option value="USD">USD</option><option value="EUR">EUR</option><option value="GBP">GBP</option></select></div>
                  <div class="acc-field"><label>Cooldown (s)</label><input type="number" id="acc-cfg-cooldown" value="3" step="1" min="0"/></div>
                </div>
              </div>
              <div class="acc-config-section">
                <div class="acc-config-title">Trade Settings</div>
                <div class="acc-row">
                  <div class="acc-field"><label>Base Stake ($)</label><input type="number" id="acc-cfg-stake" value="1.00" step="0.01" min="0.01"/></div>
                  <div class="acc-field"><label>Growth Rate (%)</label><input type="number" id="acc-cfg-growth" value="5" step="1" min="1" max="5"/></div>
                </div>
                <div class="acc-row">
                  <div class="acc-field"><label>TP per Trade (%)</label><input type="number" id="acc-cfg-tp-trade" value="30" step="1"/></div>
                  <div class="acc-field"><label>Daily TP ($)</label><input type="number" id="acc-cfg-daily-tp" value="10" step="1"/></div>
                </div>
              </div>
              <div class="acc-config-section">
                <div class="acc-config-title">Martingale</div>
                <div class="acc-toggle-row"><span class="acc-toggle-label">Enable Martingale</span><label class="acc-toggle"><input type="checkbox" id="acc-cfg-mart-on" checked/><span class="acc-slider"></span></label></div>
                <div class="acc-row" style="margin-top:7px;">
                  <div class="acc-field"><label>Loss Multiplier (×)</label><input type="number" id="acc-cfg-mult" value="3.5" step="0.5" min="1"/></div>
                  <div class="acc-field"><label>Max Multiplier (×)</label><input type="number" id="acc-cfg-maxmult" value="50" step="5"/></div>
                </div>
                <div class="acc-toggle-row"><span class="acc-toggle-label">Reset After Win</span><label class="acc-toggle"><input type="checkbox" id="acc-cfg-reset-win" checked/><span class="acc-slider"></span></label></div>
              </div>
            </div>
          </div>

          <div class="acc-panel">
            <div class="acc-panel-header">
              <span class="acc-panel-title">Active Symbols</span>
              <span style="font-family:var(--font-mono);font-size:9px;color:var(--text-muted);">tap to toggle</span>
            </div>
            <div class="acc-panel-body"><div class="acc-symbols-grid" id="acc-symbols-grid"></div></div>
          </div>

          <div class="acc-panel">
            <div class="acc-panel-header"><span class="acc-panel-title">MANUAL MODE</span></div>
            <div class="acc-panel-body">
              <div style="font-family:var(--font-mono);font-size:9px;color:var(--text-muted);">Trades open ONLY when you click TRADE on HL Analysis tab</div>
            </div>
          </div>
        </div>

        <!-- RIGHT: Stats + Charts + Log -->
        <div class="acc-right-col">
          <div class="acc-panel">
            <div class="acc-panel-header">
              <span class="acc-panel-title">Martingale State</span>
              <button class="acc-btn acc-btn-secondary" style="padding:3px 9px;font-size:10px;" onclick="accManualResetMartingale()">RESET ×1</button>
            </div>
            <div class="acc-panel-body" style="display:grid;grid-template-columns:1fr 1fr;gap:14px;align-items:center;">
              <div>
                <div class="acc-mart-mult" id="acc-mart-mult-display">×1.00</div>
                <div class="acc-mart-stake" id="acc-mart-stake-display">Next stake: $1.00</div>
                <div class="acc-mart-steps" id="acc-mart-steps"></div>
              </div>
              <div>
                <div style="margin-bottom:10px;"><div class="acc-stat-label">Consecutive Losses</div><div style="font-size:26px;font-weight:800;font-family:var(--font-display);color:#f87171;" id="acc-consec-losses">0</div></div>
                <div style="margin-bottom:10px;"><div class="acc-stat-label">Daily Progress</div><div style="font-family:var(--font-mono);font-size:10px;margin-bottom:3px;color:var(--text-secondary);"><span id="acc-daily-pnl-progress">$0.00</span> / $<span id="acc-daily-tp-progress">10.00</span></div><div class="acc-progress-wrap"><div class="acc-progress-fill" id="acc-daily-progress-bar" style="width:0%"></div></div></div>
                <div><div class="acc-stat-label">Status</div><div id="acc-trading-status-chip"><span class="acc-chip acc-chip-blue">WAITING</span></div></div>
              </div>
            </div>
          </div>

          <div class="acc-panel">
            <div class="acc-panel-header"><span class="acc-panel-title">Live Positions</span></div>
            <div class="acc-panel-body">
              <div class="acc-indicators-row" id="acc-indicators-row"></div>
              <div id="acc-active-trades-area"><div class="acc-no-trades">No open positions</div></div>
            </div>
          </div>

          <div class="acc-panel">
            <div class="acc-panel-header"><span class="acc-panel-title">P&amp;L Chart (Today)</span></div>
            <div class="acc-panel-body" style="padding:10px;"><div class="acc-chart-area"><canvas id="acc-pnl-chart"></canvas></div></div>
          </div>

          <div class="acc-panel">
            <div class="acc-panel-header">
              <span class="acc-panel-title">Bot Console</span>
              <button class="acc-btn acc-btn-secondary" style="padding:3px 9px;font-size:10px;" onclick="accClearConsole()">CLEAR</button>
            </div>
            <div class="acc-panel-body" style="padding:8px;"><div class="acc-console" id="acc-console"></div></div>
          </div>

          <div class="acc-panel">
            <div class="acc-panel-header">
              <span class="acc-panel-title">Trade Log</span>
              <span id="acc-log-count" style="font-family:var(--font-mono);font-size:10px;color:var(--text-muted);">0 trades</span>
            </div>
            <div class="acc-panel-body" style="padding:0;">
              <div style="padding:5px 12px;border-bottom:1px solid var(--border);display:grid;grid-template-columns:60px 70px 1fr 70px 55px;gap:4px;font-family:var(--font-mono);font-size:9px;color:var(--text-muted);text-transform:uppercase;letter-spacing:1px;">
                <span>Time</span><span>Symbol</span><span>Result</span><span>P&amp;L</span><span>Mult</span>
              </div>
              <div class="acc-trade-log" id="acc-trade-log"><div class="acc-no-trades">No trades yet</div></div>
            </div>
          </div>
        </div>
      </div>
    </div>
  </div>
</div>`;
}

function buildDigitsTab() {
  return `
<div id="digits-analyzer" class="tab-content">

  <!-- DIGIT TRADING TOKEN MODAL -->
  <div id="digit-token-overlay" style="display:none;position:fixed;inset:0;background:rgba(0,0,0,0.7);z-index:6000;align-items:center;justify-content:center;backdrop-filter:blur(6px);-webkit-backdrop-filter:blur(6px);">
    <div style="background:var(--bg-card);border:1px solid var(--border);border-radius:24px;padding:2rem 2rem 1.8rem;width:100%;max-width:400px;margin:1rem;box-shadow:0 30px 60px rgba(0,0,0,0.5);animation:modalPop 0.28s cubic-bezier(0.34,1.56,0.64,1);position:relative;">

      <div style="width:52px;height:52px;background:var(--accent);clip-path:polygon(50% 0%,100% 25%,100% 75%,50% 100%,0% 75%,0% 25%);display:flex;align-items:center;justify-content:center;font-size:22px;margin:0 auto 1.2rem;animation:pulse-hex 2s ease-in-out infinite;">🔢</div>

      <div style="font-family:var(--font-display);font-size:1.25rem;font-weight:700;color:var(--text-primary);text-align:center;margin-bottom:0.4rem;">Connect to Trade Digits</div>
      <div style="font-size:0.82rem;color:var(--text-secondary);text-align:center;margin-bottom:1.4rem;line-height:1.5;">Enter your Deriv API token to place real digit trades — Match, Differ, Over, Under, Even &amp; Odd.</div>

      <div style="display:flex;align-items:center;justify-content:center;gap:8px;margin-bottom:1rem;">
        <div id="digit-conn-dot" style="width:8px;height:8px;border-radius:50%;background:#f87171;transition:background 0.3s;flex-shrink:0;"></div>
        <span id="digit-conn-label" style="font-family:var(--font-mono);font-size:0.65rem;font-weight:700;text-transform:uppercase;letter-spacing:1.5px;color:var(--text-muted);">DISCONNECTED</span>
        <span id="digit-balance-display" style="font-family:var(--font-mono);font-size:0.72rem;font-weight:700;color:var(--accent);margin-left:8px;"></span>
      </div>

      <div style="position:relative;margin-bottom:0.8rem;">
        <label style="display:block;font-family:var(--font-mono);font-size:0.65rem;text-transform:uppercase;letter-spacing:1.5px;color:var(--text-muted);margin-bottom:6px;">Deriv API Token</label>
        <input type="password" id="digit-trade-token" placeholder="Paste your API token here…" autocomplete="off"
          onkeydown="if(event.key==='Enter')digitConnectTrading()"
          style="width:100%;background:var(--bg-input);border:1px solid var(--border);border-radius:12px;padding:0.8rem 2.8rem 0.8rem 1rem;color:var(--text-primary);font-family:var(--font-mono);font-size:0.85rem;outline:none;transition:border-color 0.2s,box-shadow 0.2s;box-sizing:border-box;"/>
        <button onclick="var i=document.getElementById('digit-trade-token');i.type=i.type==='password'?'text':'password';" style="position:absolute;right:10px;bottom:10px;background:none;border:none;color:var(--text-muted);cursor:pointer;font-size:1rem;padding:2px 4px;">👁</button>
      </div>

      <div id="digit-modal-error" style="font-size:0.75rem;color:#f87171;font-family:var(--font-mono);text-align:center;margin-bottom:0.5rem;min-height:1rem;"></div>

      <button id="digit-conn-btn" onclick="digitConnectTrading()" style="width:100%;background:var(--accent);border:none;color:#fff;font-family:var(--font-display);font-size:1rem;font-weight:700;padding:0.85rem;border-radius:12px;cursor:pointer;transition:opacity 0.2s,transform 0.15s;letter-spacing:0.5px;margin-top:0.2rem;">
        🔗 Connect &amp; Start Trading
      </button>

      <button onclick="digitCloseModal()" style="width:100%;background:transparent;border:1px solid var(--border);color:var(--text-muted);font-family:var(--font-mono);font-size:0.75rem;font-weight:600;padding:0.6rem;border-radius:10px;cursor:pointer;margin-top:0.55rem;letter-spacing:0.8px;text-transform:uppercase;transition:all 0.2s;">
        Skip — Browse Without Trading
      </button>

      <div style="text-align:center;margin-top:1rem;font-size:0.75rem;color:var(--text-muted);font-family:var(--font-mono);">
        Don't have a token? <a href="https://legacy-api.deriv.com/dashboard/" target="_blank" rel="noopener" style="color:var(--accent-text);text-decoration:none;border-bottom:1px dotted var(--accent-text);">Get your API token →</a>
      </div>
    </div>
  </div>

  <div id="digits-app">
    <header>
      <span>🔢 DIGITS ANALYZER + TRADER</span>
      <div style="display:flex;align-items:center;gap:10px;">
        <div style="display:flex;align-items:center;gap:5px;cursor:pointer;" onclick="digitOpenModal()">
          <div id="digit-conn-dot-header" style="width:7px;height:7px;border-radius:50%;background:#f87171;transition:background 0.3s;"></div>
          <span id="digit-conn-label-header" style="font-family:var(--font-mono);font-size:0.65rem;color:var(--text-muted);">NOT CONNECTED</span>
        </div>
        <button id="digit-header-btn" onclick="digitOpenModal()" style="background:var(--accent);border:none;color:#fff;padding:4px 12px;border-radius:6px;font-family:var(--font-mono);font-size:0.65rem;font-weight:700;cursor:pointer;letter-spacing:0.8px;text-transform:uppercase;">🔗 CONNECT</button>
        <span id="digits-current-time" style="font-family:var(--font-mono);font-size:0.85rem;color:var(--text-muted);">--:--:--</span>
      </div>
    </header>
    <div class="main-content-hl" id="digits-cards-container"></div>
  </div>
</div>`;
}

function buildBalanceTab() {
  return `
<div id="balance-checker" class="tab-content">
  <div class="balance-container strategy-card">
    <h1 style="font-size:2rem;margin-bottom:1rem;">Deriv Balance</h1>
    <label for="api-token" style="font-size:0.8rem;font-family:var(--font-mono);text-transform:uppercase;letter-spacing:1px;color:var(--text-muted);">API Token</label>
    <input type="text" id="api-token" placeholder="Your Deriv API token" />
    <button id="check-balance-btn">Check Balance</button>
    <div id="balance-display" style="margin:1rem 0;font-size:1.8rem;font-weight:700;font-family:var(--font-display);color:var(--accent);"></div>
    <button id="copy-balance-btn" style="display:none;background:var(--bg-elevated);color:var(--text-secondary);border:1px solid var(--border);">Copy Balance</button>
    <div id="error-message" style="color:#f87171;font-size:0.85rem;margin-top:0.5rem;"></div>
    <button id="toggle-debug-btn" style="background:var(--bg-elevated);color:var(--text-secondary);border:1px solid var(--border);margin-top:1rem;">Debug Console</button>
    <div id="debug-console" style="display:none;background:var(--bg-input);color:#4ade80;padding:1rem;border-radius:12px;margin-top:1rem;font-size:0.72rem;text-align:left;max-height:180px;overflow-y:auto;font-family:var(--font-mono);border:1px solid var(--border);"></div>
    <footer style="margin-top:2rem;font-size:0.75rem;color:var(--text-muted);">🔐 Token not stored · Secure WebSocket</footer>
  </div>
</div>`;
}

function buildBotTradingTab() {
  return `
<div id="bot-trading" class="tab-content">
  <section id="bot-section">
    <button id="start-trading-btn" style="font-size:1.2rem;">🚀 HIGHER/LOWER TOOL</button>
    <div id="status-msg" style="margin-top:1.5rem;color:var(--text-secondary);font-family:var(--font-mono);font-size:0.85rem;"></div>
  </section>
  <div id="trading-view" style="display:none;">
    <iframe id="bot-iframe" title="Bot" sandbox="allow-scripts allow-same-origin allow-forms"></iframe>
  </div>
</div>`;
}
