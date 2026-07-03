importScripts('lib/config.js');
console.log('[RED] Background worker loaded');

var BG_AUTH_URL = window.__RED_CONFIG.SUPABASE_URL;
var BG_AUTH_KEY = window.__RED_CONFIG.SUPABASE_ANON_KEY;
var BG_EXPIRY_KEY = 'supabase_token_expiry';
var BG_BUFFER_MS = 5 * 60 * 1000;

async function bgRefreshToken() {
  var result = await chrome.storage.local.get('supabase_refresh_token');
  var refreshToken = result.supabase_refresh_token;
  if (!refreshToken) return false;

  try {
    var res = await fetch(BG_AUTH_URL + '/auth/v1/token?grant_type=refresh_token', {
      method: 'POST',
      headers: { 'apikey': BG_AUTH_KEY, 'Content-Type': 'application/json' },
      body: JSON.stringify({ refresh_token: refreshToken }),
    });
    var data = await res.json();
    if (!res.ok) {
      console.warn('[RED] BG proactive refresh failed:', res.status);
      return false;
    }
    var expiry = Date.now() + (data.expires_in * 1000);
    await chrome.storage.local.set({
      supabase_token: data.access_token,
      supabase_refresh_token: data.refresh_token,
      supabase_token_expiry: expiry,
    });
    console.log('[RED] BG proactive token refresh successful');
    return true;
  } catch (e) {
    console.warn('[RED] BG proactive refresh error:', e);
    return false;
  }
}

chrome.storage.local.get(['supabase_token', BG_EXPIRY_KEY], function (result) {
  if (!result.supabase_token) return;
  var expiry = result[BG_EXPIRY_KEY];
  if (!expiry || Date.now() >= expiry - BG_BUFFER_MS) {
    console.log('[RED] BG proactive token refresh on startup');
    bgRefreshToken();
  }
});

chrome.runtime.onMessage.addListener(function (message, sender, sendResponse) {
  if (message.action === 'openPopup') {
    chrome.action.openPopup();
  }
});
