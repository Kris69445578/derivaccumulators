/**
 * deriv-core.js — v6.0  (New Deriv API)
 *
 *  Auth     : OAuth2 Authorization-Code + PKCE  (auth.deriv.com)  — or a Personal Access Token
 *  REST     : https://api.derivws.com   (accounts, OTP, reset demo balance)
 *  Sockets  : public  -> wss://api.derivws.com/trading/v1/options/ws/public   (no auth)
 *             trade   -> OTP URL from  POST /trading/v1/options/accounts/{id}/otp  (demo | real)
 *
 *  Everything is exposed on window.Deriv.
 */
(function (global) {
  'use strict';

  const C = global.JAHIM_CONFIG;
  const LS_SESSION = 'jahim_v2_session';
  const SS_PKCE    = 'jahim_v2_pkce';

  /* ───────────────────────── tiny event bus ───────────────────────── */
  const listeners = {};
  function on(evt, fn) {
    (listeners[evt] = listeners[evt] || []).push(fn);
    return function () { off(evt, fn); };
  }
  function off(evt, fn) {
    listeners[evt] = (listeners[evt] || []).filter(function (f) { return f !== fn; });
  }
  function emit(evt, data) {
    (listeners[evt] || []).slice().forEach(function (fn) {
      try { fn(data); } catch (e) { console.error('[Deriv] listener error', evt, e); }
    });
  }

  class DerivError extends Error {
    constructor(message, code, raw) {
      super(message || 'Unknown error');
      this.name = 'DerivError';
      this.code = code || '';
      this.raw  = raw || null;
    }
  }

  /* ───────────────────────── state ───────────────────────── */
  const state = {
    token: '',
    tokenType: 'oauth',      // 'oauth' | 'pat'
    expiresAt: 0,            // ms epoch (oauth only)
    accounts: [],            // [{id,balance,currency,type,status,group}]
    activeId: null,
  };

  function isAuthed()  { return !!state.token; }
  function active()    { return state.accounts.find(function (a) { return a.id === state.activeId; }) || null; }
  function currency()  { const a = active(); return a ? a.currency : 'USD'; }
  function isDemo()    { const a = active(); return !!a && a.type === 'demo'; }

  const CRYPTO8 = ['BTC', 'ETH', 'LTC', 'BCH'];
  function fmt(n, cur) {
    if (typeof n !== 'number' || !isFinite(n)) return '—';
    const c = cur || currency();
    return n.toFixed(CRYPTO8.indexOf(c) >= 0 ? 8 : 2);
  }
  function fmtMoney(n, cur) {
    const c = cur || currency();
    return fmt(n, c) + ' ' + c;
  }

  /* ───────────────────────── session persistence ───────────────────────── */
  function saveSession() {
    try {
      localStorage.setItem(LS_SESSION, JSON.stringify({
        token: state.token, type: state.tokenType, expiresAt: state.expiresAt, activeId: state.activeId,
      }));
    } catch (e) {}
  }
  function clearSession() {
    try { localStorage.removeItem(LS_SESSION); } catch (e) {}
  }
  function loadSession() {
    try {
      const raw = localStorage.getItem(LS_SESSION);
      if (!raw) return false;
      const s = JSON.parse(raw);
      if (!s || !s.token) return false;
      if (s.type !== 'pat' && s.expiresAt && Date.now() >= s.expiresAt) { clearSession(); return false; }
      state.token     = s.token;
      state.tokenType = s.type === 'pat' ? 'pat' : 'oauth';
      state.expiresAt = s.expiresAt || 0;
      state.activeId  = s.activeId || null;
      return true;
    } catch (e) { return false; }
  }

  /* ───────────────────────── OAuth2 + PKCE ───────────────────────── */
  function b64url(buf) {
    let s = '';
    const bytes = new Uint8Array(buf);
    for (let i = 0; i < bytes.length; i++) s += String.fromCharCode(bytes[i]);
    return btoa(s).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
  }

  async function createPkce() {
    const verifier  = b64url(crypto.getRandomValues(new Uint8Array(32)));
    const digest    = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(verifier));
    return { verifier: verifier, challenge: b64url(digest) };
  }

  function redirectUri() {
    return C.REDIRECT_URI || (location.origin + location.pathname);
  }

  /** Builds the Deriv authorize URL (and stores the PKCE verifier + state for the callback). */
  async function buildAuthUrl(opts) {
    opts = opts || {};
    if (!global.crypto || !global.crypto.subtle) {
      throw new DerivError('This browser cannot do secure login (WebCrypto needs HTTPS).', 'no_crypto');
    }
    const pkce  = await createPkce();
    const st    = b64url(crypto.getRandomValues(new Uint8Array(16)));
    const redir = redirectUri();
    sessionStorage.setItem(SS_PKCE, JSON.stringify({ v: pkce.verifier, s: st, r: redir }));

    const p = new URLSearchParams({
      response_type: 'code',
      client_id: C.APP_ID,
      redirect_uri: redir,
      scope: C.SCOPES,
      state: st,
      code_challenge: pkce.challenge,
      code_challenge_method: 'S256',
    });
    if (opts.signup) p.set('prompt', 'registration');
    return C.AUTH_URL + '?' + p.toString();
  }

  /** Redirects the browser to Deriv. `signup:true` shows the registration form. */
  async function login(opts) {
    const url = await buildAuthUrl(opts);
    global.location.href = url;
  }

  /** Call once on boot. Returns null (no callback) | {ok:true} | {error:'...'} */
  async function handleCallback() {
    const cur = new URLSearchParams(location.search);          // original params (read before stripping)
    if (!cur.has('code') && !cur.has('error')) return null;

    /* strip OAuth params from the address bar but keep anything else */
    const q = new URLSearchParams(location.search);
    ['code', 'state', 'error', 'error_description', 'iss'].forEach(function (k) { q.delete(k); });
    const rest = q.toString();
    history.replaceState({}, document.title, location.pathname + (rest ? '?' + rest : '') + location.hash);

    if (cur.get('error')) {
      sessionStorage.removeItem(SS_PKCE);
      return { error: cur.get('error_description') || cur.get('error') };
    }

    let saved = null;
    try { saved = JSON.parse(sessionStorage.getItem(SS_PKCE) || 'null'); } catch (e) {}
    sessionStorage.removeItem(SS_PKCE);
    if (!saved || saved.s !== cur.get('state')) {
      return { error: 'Login check failed (state mismatch). Please try logging in again.' };
    }

    let res, j = {};
    try {
      res = await fetch(C.TOKEN_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: new URLSearchParams({
          grant_type: 'authorization_code',
          client_id: C.APP_ID,
          code: cur.get('code'),
          redirect_uri: saved.r,
          code_verifier: saved.v,
        }),
      });
      try { j = await res.json(); } catch (e) {}
    } catch (e) {
      return { error: 'Could not reach Deriv to finish login (network or CORS). ' + (e && e.message ? e.message : '') };
    }
    if (!res.ok || !j.access_token) {
      return { error: j.error_description || j.error || ('Token exchange failed (HTTP ' + res.status + ')') };
    }
    state.token     = j.access_token;
    state.tokenType = 'oauth';
    state.expiresAt = Date.now() + (Number(j.expires_in) || 3600) * 1000;
    state.activeId  = null;
    saveSession();
    return { ok: true };
  }

  /** Personal Access Token login (replaces the legacy "API Token" button). */
  async function loginWithPat(token) {
    token = (token || '').trim();
    if (token.length < 8) throw new DerivError('Please paste a valid token', 'bad_token');
    state.token = token; state.tokenType = 'pat'; state.expiresAt = 0; state.activeId = null;
    try {
      await loadAccounts();
    } catch (e) {
      state.token = ''; state.accounts = [];
      throw e;
    }
    saveSession();
    await afterLogin(true);
  }

  /* ───────────────────────── REST ───────────────────────── */
  function restError(j, status) {
    if (j && Array.isArray(j.errors) && j.errors.length) {
      return { msg: j.errors[0].message || ('HTTP ' + status), code: j.errors[0].code || ('HTTP' + status) };
    }
    if (j && j.error) {
      return { msg: j.error.message || j.error_description || String(j.error), code: j.error.code || ('HTTP' + status) };
    }
    return { msg: 'HTTP ' + status, code: 'HTTP' + status };
  }

  async function rest(method, path, body) {
    const headers = { 'Authorization': 'Bearer ' + state.token };
    if (state.tokenType === 'pat') headers['Deriv-App-ID'] = C.APP_ID;
    if (body) headers['Content-Type'] = 'application/json';
    let res;
    try {
      res = await fetch(C.API_BASE + path, { method: method, headers: headers, body: body ? JSON.stringify(body) : undefined });
    } catch (e) {
      throw new DerivError('Network error talking to Deriv API', 'network');
    }
    let j = null;
    try { j = await res.json(); } catch (e) {}
    if (res.status === 401) {
      const er = restError(j, 401);
      throw new DerivError(er.msg === 'HTTP 401' ? 'Session expired or token invalid' : er.msg, 'unauthorized', j);
    }
    if (!res.ok) {
      const er = restError(j, res.status);
      throw new DerivError(er.msg, er.code, j);
    }
    return j || {};
  }

  async function loadAccounts() {
    const j = await rest('GET', '/trading/v1/options/accounts');
    state.accounts = (j.data || []).map(function (a) {
      return {
        id: a.account_id,
        balance: Number(a.balance),
        currency: a.currency,
        type: a.account_type === 'demo' ? 'demo' : 'real',
        status: a.status,
        group: a.group,
      };
    });
    emit('accounts', state.accounts);
    return state.accounts;
  }

  let _lastAccountsRefresh = 0;
  async function refreshAccounts(force) {
    if (!isAuthed()) return;
    if (!force && Date.now() - _lastAccountsRefresh < 10000) return;
    _lastAccountsRefresh = Date.now();
    try { await loadAccounts(); } catch (e) { if (e.code === 'unauthorized') sessionExpired(); }
  }

  async function getOtpUrl(accountId) {
    const j = await rest('POST', '/trading/v1/options/accounts/' + encodeURIComponent(accountId) + '/otp');
    const url = j && j.data && j.data.url;
    if (!url) throw new DerivError('Deriv did not return a WebSocket URL', 'no_otp', j);
    return url;
  }

  async function resetDemoBalance(accountId) {
    await rest('POST', '/trading/v1/options/accounts/' + encodeURIComponent(accountId) + '/reset-demo-balance', {});
    await loadAccounts();
    const a = active();
    if (a) emit('balance', a);
  }

  /* ───────────────────────── WebSocket wrapper ───────────────────────── */
  class DerivSocket {
    /**
     * @param name       'public' | 'trade'
     * @param urlFn      async () => ws url   (trade: fetches a fresh OTP URL each connect)
     * @param opts       { autoOpen:bool, shouldRetry:()=>bool }
     */
    constructor(name, urlFn, opts) {
      opts = opts || {};
      this.name = name;
      this.urlFn = urlFn;
      this.autoOpen = !!opts.autoOpen;
      this.shouldRetry = opts.shouldRetry || function () { return true; };
      this.ws = null;
      this.status = 'closed';          // closed | connecting | open
      this.reqSeq = 1;
      this.subSeq = 0;
      this.pending = new Map();        // req_id -> {resolve,reject,t}
      this.subs = new Map();           // key -> sub
      this.reqToSub = new Map();       // req_id -> sub
      this.deadReq = new Set();
      this.retry = 0;
      this.userClosed = false;
      this._pingT = null;
      this._retryT = null;
      this._opening = null;
    }

    _setStatus(s) {
      if (this.status === s) return;
      this.status = s;
      emit('socket', { name: this.name, status: s });
    }

    isOpen() { return this.ws && this.ws.readyState === 1; }

    /** Resolves when open; shares an in-flight connect. */
    ensure() {
      if (this.isOpen()) return Promise.resolve();
      if (this._opening) return this._opening;
      return this.open();
    }

    open() {
      this.userClosed = false;
      clearTimeout(this._retryT);
      const self = this;
      this._opening = this._connect().then(
        function () { self._opening = null; },
        function (e) { self._opening = null; throw e; }
      );
      return this._opening;
    }

    async _connect() {
      this._setStatus('connecting');
      let url;
      try { url = await this.urlFn(); }
      catch (e) {
        this._setStatus('closed');
        if (e && e.code === 'unauthorized') { sessionExpired(); throw e; }
        this._scheduleRetry();
        throw e;
      }
      const self = this;
      return new Promise(function (resolve, reject) {
        let ws;
        try { ws = new WebSocket(url); }
        catch (e) { self._setStatus('closed'); self._scheduleRetry(); reject(e); return; }
        self.ws = ws;
        let opened = false;
        ws.onopen = function () {
          opened = true;
          self.retry = 0;
          self._startPing();
          self._resubscribe();      // replay streams BEFORE announcing "open"
          self._setStatus('open');
          resolve();
        };
        ws.onmessage = function (e) { self._onMessage(e); };
        ws.onerror = function () { if (!opened) reject(new DerivError('WebSocket connection failed', 'ws_error')); };
        ws.onclose = function () {
          self._stopPing();
          self._failPending('Connection closed');
          if (self.ws !== ws) return;
          self._setStatus('closed');
          if (!opened) { self._scheduleRetry(); return; }
          if (!self.userClosed) self._scheduleRetry();
        };
      });
    }

    _scheduleRetry() {
      if (this.userClosed || !this.shouldRetry()) return;
      clearTimeout(this._retryT);
      const delay = Math.min(30000, 1000 * Math.pow(2, this.retry++));
      const self = this;
      this._retryT = setTimeout(function () {
        if (self.userClosed || !self.shouldRetry() || self.isOpen() || self._opening) return;
        self.open().catch(function () {});
      }, delay);
    }

    _startPing() {
      this._stopPing();
      const self = this;
      this._pingT = setInterval(function () { self.send({ ping: 1 }, 8000).catch(function () {}); }, 30000);
    }
    _stopPing() { clearInterval(this._pingT); this._pingT = null; }

    _failPending(msg) {
      this.pending.forEach(function (p) { clearTimeout(p.t); p.reject(new DerivError(msg, 'closed')); });
      this.pending.clear();
    }

    /** Close and drop every subscription (use when switching account / logging out). */
    close() {
      this.userClosed = true;
      clearTimeout(this._retryT);
      this._stopPing();
      this.subs.clear(); this.reqToSub.clear(); this.deadReq.clear();
      this._failPending('Connection closed');
      const ws = this.ws;
      this.ws = null;
      if (ws) { try { ws.close(); } catch (e) {} }
      this._setStatus('closed');
    }

    /** Request/response. Resolves with the whole message; rejects with DerivError on {error}. */
    send(payload, timeoutMs) {
      const self = this;
      return new Promise(function (resolve, reject) {
        if (!self.isOpen()) { reject(new DerivError('Not connected', 'not_connected')); return; }
        const id = self.reqSeq++;
        const t = setTimeout(function () {
          self.pending.delete(id);
          reject(new DerivError('Request timed out', 'timeout'));
        }, timeoutMs || 20000);
        self.pending.set(id, { resolve: resolve, reject: reject, t: t });
        try { self.ws.send(JSON.stringify(Object.assign({}, payload, { req_id: id }))); }
        catch (e) { clearTimeout(t); self.pending.delete(id); reject(e); }
      });
    }

    /** Streaming request. Handler gets every message. Auto-replayed after reconnect. */
    subscribe(payload, handler, onError) {
      const sub = {
        key: ++this.subSeq,
        payload: Object.assign({}, payload, { subscribe: 1 }),
        handler: handler, onError: onError,
        reqId: null, subId: null, dead: false,
      };
      this.subs.set(sub.key, sub);
      const self = this;
      if (this.isOpen()) this._startSub(sub);
      else if (this.autoOpen) this.ensure().catch(function () {});
      return {
        forget: function () { self._forgetSub(sub); },
      };
    }

    _startSub(sub) {
      if (sub.dead || !this.isOpen()) return;
      const id = this.reqSeq++;
      sub.reqId = id; sub.subId = null;
      this.reqToSub.set(id, sub);
      try { this.ws.send(JSON.stringify(Object.assign({}, sub.payload, { req_id: id }))); } catch (e) {}
    }

    _resubscribe() {
      this.reqToSub.clear();
      const self = this;
      this.subs.forEach(function (s) { self._startSub(s); });
    }

    _forgetSub(sub) {
      if (sub.dead) return;
      sub.dead = true;
      this.subs.delete(sub.key);
      if (sub.reqId != null) this.reqToSub.delete(sub.reqId);
      if (this.isOpen()) {
        if (sub.subId) { try { this.ws.send(JSON.stringify({ forget: sub.subId })); } catch (e) {} }
        else if (sub.reqId != null) this.deadReq.add(sub.reqId);   // server hasn't told us its id yet
      }
    }

    _onMessage(e) {
      let m;
      try { m = JSON.parse(e.data); } catch (x) { return; }
      const id = m.req_id;

      if (id != null && this.pending.has(id)) {
        const p = this.pending.get(id);
        this.pending.delete(id);
        clearTimeout(p.t);
        if (m.error) p.reject(new DerivError(m.error.message, m.error.code, m)); else p.resolve(m);
        return;
      }
      const sub = id != null ? this.reqToSub.get(id) : null;
      if (sub) {
        if (m.subscription && m.subscription.id) sub.subId = m.subscription.id;
        if (m.error) { if (sub.onError) sub.onError(new DerivError(m.error.message, m.error.code, m)); return; }
        try { sub.handler(m); } catch (ex) { console.error('[Deriv] stream handler error', ex); }
        return;
      }
      if (id != null && this.deadReq.has(id)) {
        if (m.subscription && m.subscription.id) {
          try { this.ws.send(JSON.stringify({ forget: m.subscription.id })); } catch (x) {}
          this.deadReq.delete(id);
        }
      }
    }
  }

  const pub = new DerivSocket('public', function () { return Promise.resolve(C.WS_PUBLIC); }, { autoOpen: true });

  const trade = new DerivSocket('trade', async function () {
    if (!state.activeId) throw new DerivError('No active trading account', 'no_account');
    return getOtpUrl(state.activeId);
  }, { shouldRetry: function () { return isAuthed() && !!state.activeId; } });

  /* ───────────────────────── auth lifecycle ───────────────────────── */
  let _balanceSub = null;

  async function connectTrade() {
    if (_balanceSub) { _balanceSub.forget(); _balanceSub = null; }
    trade.close();
    if (!isAuthed() || !state.activeId) return;
    try {
      await trade.open();
    } catch (e) {
      emit('error', { where: 'trade-connect', error: e });
      return;
    }
    _balanceSub = trade.subscribe({ balance: 1 }, function (m) {
      if (!m.balance) return;
      /* the OTP socket is already scoped to the active account */
      const a = active();
      if (a) {
        a.balance = Number(m.balance.balance);
        if (m.balance.currency) a.currency = m.balance.currency;
        emit('balance', a);
      }
    });
    emit('trade-ready', active());
  }

  function pickDefaultAccount() {
    if (state.activeId && state.accounts.some(function (a) { return a.id === state.activeId; })) return;
    const usable = state.accounts.filter(function (a) { return a.status !== 'inactive'; });
    const pool = usable.length ? usable : state.accounts;
    const real = pool.find(function (a) { return a.type === 'real'; });
    const a = real || pool[0];
    state.activeId = a ? a.id : null;
  }

  async function afterLogin(accountsLoaded) {
    if (!accountsLoaded) {
      try { await loadAccounts(); }
      catch (e) {
        if (e.code === 'unauthorized') { sessionExpired(); return; }
        emit('error', { where: 'accounts', error: e });
        return;
      }
    }
    pickDefaultAccount();
    saveSession();
    emit('auth', { authed: true });
    emit('account', active());
    await connectTrade();
  }

  function sessionExpired() {
    if (!isAuthed()) return;
    logout(true);
    emit('error', { where: 'session', error: new DerivError('Session expired — please log in again', 'unauthorized') });
  }

  function logout() {
    if (_balanceSub) { try { _balanceSub.forget(); } catch (e) {} _balanceSub = null; }
    trade.close();
    state.token = ''; state.accounts = []; state.activeId = null; state.expiresAt = 0;
    clearSession();
    emit('auth', { authed: false });
  }

  async function selectAccount(id) {
    const a = state.accounts.find(function (x) { return x.id === id; });
    if (!a) return;
    state.activeId = id;
    saveSession();
    emit('account', a);
    await connectTrade();
  }

  /** Boot: handles ?code= callback, restores session, connects. */
  async function init() {
    let cb = null;
    try { cb = await handleCallback(); } catch (e) { cb = { error: e.message || String(e) }; }
    if (cb && cb.error) emit('error', { where: 'login', error: new DerivError(cb.error, 'login') });
    if (!state.token) loadSession();
    if (state.token) await afterLogin(false);
    else emit('auth', { authed: false });
  }

  /* ───────────────────────── market-data helpers ───────────────────────── */
  const symbolCache = {};
  async function activeSymbols(contractTypes) {
    const key = (contractTypes || []).join(',');
    if (symbolCache[key]) return symbolCache[key];
    await pub.ensure();
    let m;
    try {
      const req = { active_symbols: 'brief' };
      if (contractTypes && contractTypes.length) req.contract_type = contractTypes;
      m = await pub.send(req);
    } catch (e) {
      if (!contractTypes) throw e;
      m = await pub.send({ active_symbols: 'brief' });        // fall back to unfiltered
    }
    const list = (m.active_symbols || []).filter(function (s) { return !s.is_trading_suspended; });
    symbolCache[key] = list;
    return list;
  }

  /** History + live ticks in one stream. */
  function streamTicks(symbol, count, onHistory, onTick, onError) {
    return pub.subscribe(
      { ticks_history: symbol, style: 'ticks', count: count, end: 'latest', adjust_start_time: 1 },
      function (m) {
        if (m.msg_type === 'history' && m.history) {
          onHistory({ prices: m.history.prices || [], times: m.history.times || [], pip: Number(m.pip_size) || 2 });
        } else if (m.msg_type === 'tick' && m.tick) {
          onTick({ quote: Number(m.tick.quote), epoch: m.tick.epoch, pip: Number(m.tick.pip_size) || 2, symbol: m.tick.symbol });
        }
      },
      onError
    );
  }

  function lastDigit(quote, pip) {
    const s = Number(quote).toFixed(pip);
    return Number(s.charAt(s.length - 1));
  }

  /** The socket to price on: trade socket when logged in & open, otherwise public. */
  function market() {
    return (isAuthed() && trade.isOpen()) ? trade : pub;
  }

  /**
   * Buy via proposal id (documented, de-duplicated flow). Needs the trade socket.
   * Never retried automatically — a timed-out buy may still have executed.
   */
  async function buyContract(params) {
    if (!isAuthed()) throw new DerivError('Log in to trade', 'not_authed');
    if (!trade.isOpen()) throw new DerivError('Trading connection is not ready yet — try again in a moment', 'not_connected');
    const p = await trade.send(Object.assign({ proposal: 1 }, params));
    if (!p.proposal || !p.proposal.id) throw new DerivError('No price returned for this contract', 'no_proposal');
    let b;
    try {
      b = await trade.send({ buy: p.proposal.id, price: p.proposal.ask_price }, 25000);
    } catch (e) {
      if (e.code === 'timeout' || e.code === 'closed') {
        throw new DerivError('The buy request did not get a reply. It may still have gone through — check Open positions before trying again.', 'buy_unknown');
      }
      throw e;
    }
    if (!b.buy) throw new DerivError('Buy failed', 'buy_failed', b);
    return b.buy;
  }

  async function sellContract(contractId) {
    const r = await trade.send({ sell: Number(contractId), price: 0 });
    return r.sell;
  }

  /* ───────────────────────── public API ───────────────────────── */
  global.Deriv = {
    config: C, state: state,
    on: on, off: off, emit: emit,
    DerivError: DerivError,
    isAuthed: isAuthed, active: active, currency: currency, isDemo: isDemo,
    fmt: fmt, fmtMoney: fmtMoney,
    init: init, login: login, buildAuthUrl: buildAuthUrl, loginWithPat: loginWithPat, logout: logout,
    selectAccount: selectAccount, refreshAccounts: refreshAccounts, resetDemoBalance: resetDemoBalance,
    redirectUri: redirectUri,
    pub: pub, trade: trade, market: market,
    activeSymbols: activeSymbols, streamTicks: streamTicks, lastDigit: lastDigit,
    buyContract: buyContract, sellContract: sellContract,
  };
})(window);
