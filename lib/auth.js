// Shared token refresh utility for RED extension.
// Provides getValidToken() which checks expiry and refreshes before any Supabase call.
// Used by content-script.js, inject-panel.js, and history-premium.js.

(function () {
  var AUTH_URL = window.__RED_CONFIG.SUPABASE_URL;
  var AUTH_KEY = window.__RED_CONFIG.SUPABASE_ANON_KEY;
  var TOKEN_EXPIRY_KEY = 'supabase_token_expiry';
  var BUFFER_MS = 5 * 60 * 1000;

  var _refreshPromise = null;

  async function refreshAccessToken() {
    var result = await chrome.storage.local.get('supabase_refresh_token');
    var refreshToken = result.supabase_refresh_token;
    if (!refreshToken) {
      await clearAuthSession();
      return null;
    }

    try {
      var res = await fetch(AUTH_URL + '/auth/v1/token?grant_type=refresh_token', {
        method: 'POST',
        headers: { 'apikey': AUTH_KEY, 'Content-Type': 'application/json' },
        body: JSON.stringify({ refresh_token: refreshToken }),
      });
      var data = await res.json();
      if (!res.ok) {
        console.warn('[RED] Token refresh failed:', res.status);
        await clearAuthSession();
        return null;
      }
      await storeAuthSession(data.access_token, data.refresh_token, data.expires_in);
      console.log('[RED] Token refreshed successfully');
      return data.access_token;
    } catch (e) {
      console.warn('[RED] Token refresh network error:', e);
      return null;
    }
  }

  async function getValidToken() {
    if (_refreshPromise) {
      await _refreshPromise;
      var afterRefresh = await chrome.storage.local.get(['supabase_token', TOKEN_EXPIRY_KEY]);
      if (afterRefresh.supabase_token && afterRefresh[TOKEN_EXPIRY_KEY] && Date.now() < afterRefresh[TOKEN_EXPIRY_KEY] - BUFFER_MS) {
        return afterRefresh.supabase_token;
      }
      return afterRefresh.supabase_token || null;
    }

    var result = await chrome.storage.local.get(['supabase_token', TOKEN_EXPIRY_KEY]);
    var token = result.supabase_token;
    var expiry = result[TOKEN_EXPIRY_KEY];

    if (!token) return null;

    if (expiry && Date.now() < expiry - BUFFER_MS) {
      return token;
    }

    _refreshPromise = refreshAccessToken();
    try {
      return await _refreshPromise;
    } finally {
      _refreshPromise = null;
    }
  }

  async function storeAuthSession(accessToken, refreshToken, expiresIn) {
    var expiry = Date.now() + (expiresIn * 1000);
    return new Promise(function (resolve) {
      chrome.storage.local.set({
        supabase_token: accessToken,
        supabase_refresh_token: refreshToken,
        supabase_token_expiry: expiry,
      }, resolve);
    });
  }

  async function clearAuthSession() {
    return new Promise(function (resolve) {
      chrome.storage.local.remove([
        'supabase_token', 'supabase_refresh_token',
        'supabase_user', 'user_type', TOKEN_EXPIRY_KEY
      ], resolve);
    });
  }

  async function proactiveRefresh() {
    var result = await chrome.storage.local.get(['supabase_token', TOKEN_EXPIRY_KEY]);
    if (!result.supabase_token) return;
    var expiry = result[TOKEN_EXPIRY_KEY];
    if (!expiry || Date.now() >= expiry - BUFFER_MS) {
      console.log('[RED] Proactive token refresh triggered');
      await refreshAccessToken();
    }
  }

  window.__RED = window.__RED || {};
  window.__RED.getValidToken = getValidToken;
  window.__RED.storeAuthSession = storeAuthSession;
  window.__RED.clearAuthSession = clearAuthSession;
  window.__RED.refreshAccessToken = refreshAccessToken;
  window.__RED.proactiveRefresh = proactiveRefresh;
})();
