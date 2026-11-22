/**
 * config.js — JAHIM TRADER · New Deriv API configuration
 *
 * APP_ID is your OAuth2 App ID from https://developers.deriv.com/dashboard/
 * (the "jahim" app). It is used as the OAuth `client_id`.
 *
 * REDIRECT_URI must match EXACTLY one of the Redirect URLs registered on that
 * app (same scheme, host, path and trailing slash). Leave it empty to use the
 * URL this page is served from (origin + path), e.g. https://jahim.crabdance.com/
 */
window.JAHIM_CONFIG = {
  APP_ID: '350K1vjYSPxXbn8jLnfYN',
  REDIRECT_URI: 'https://jahim.dpdns.org/callback',

  /* Must be a subset of the scopes ticked on your app: Trade + Account management */
  SCOPES: 'trade account_manage',

  /* Deriv endpoints (do not change) */
  AUTH_URL:  'https://auth.deriv.com/oauth2/auth',
  TOKEN_URL: 'https://auth.deriv.com/oauth2/token',
  API_BASE:  'https://api.derivws.com',
  WS_PUBLIC: 'wss://api.derivws.com/trading/v1/options/ws/public',

  /* Links */
  SIGNUP_URL:   'https://track.deriv.com/_j_K_n50wBctMjdsyM5hasGNd7ZgqdRLk/1/',
  DASHBOARD_URL:'https://developers.deriv.com/dashboard/',
  DERIV_APP_URL:'https://app.deriv.com/',

  /* Old behaviour kept: blocks right-click / F12 / Ctrl+U. Set false while debugging. */
  LOCK_DEVTOOLS: true,
};
