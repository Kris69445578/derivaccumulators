# JAHIM TRADER — new Deriv API edition

Tabs: **Menu · Accumulators · Bot · Digits · Rise/Fall**

## Go-live checklist (2 minutes)
1. `config.js` → confirm `APP_ID` equals the App ID of your "jahim" app (use the copy icon on developers.deriv.com/dashboard).
2. On that app press the pencil (edit) → **Redirect URLs** → add the exact URL this site is served from,
   e.g. `https://jahim.crabdance.com/` (same scheme, host, path, trailing slash). The Menu tab shows the exact value.
3. Scopes needed on the app: **Trade** and **Account management** (already ticked).
4. Deploy (GitHub Pages as before) and press **Log in**.

## Flow
Log in (OAuth2 + PKCE) -> `GET /trading/v1/options/accounts` -> `POST .../accounts/{id}/otp` -> WebSocket.
"API Token" button = Personal Access Token (sent with `Deriv-App-ID` header).

## Debugging
`LOCK_DEVTOOLS` in `config.js` blocks F12 / right-click (kept from the old app). Set it to `false` to debug.
