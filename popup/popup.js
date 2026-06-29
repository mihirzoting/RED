const SUPABASE_URL = 'https://votjuphsggdecoawqeqc.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InZvdGp1cGhzZ2dkZWNvYXdxZXFjIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODE4NTE3OTQsImV4cCI6MjA5NzQyNzc5NH0.fZW6kk62ka7glAPbJiNrqrh2UU84v3RNuR_e5w04mKE';

const EDGE_FN_ORIGIN = 'https://votjuphsggdecoawqeqc.supabase.co/functions/v1';
const QUOTA_FREE = 10;
const QUOTA_PREMIUM = 300;
const TOKEN_EXPIRY_KEY = 'supabase_token_expiry';
const REFRESH_BUFFER_MS = 5 * 60 * 1000;
const RAZORPAY_CREATE_FN = EDGE_FN_ORIGIN + '/create-payment-link';
const POLL_INTERVAL_MS = 5000;
const POLL_TIMEOUT_MS = 60000;

let currentView = 'login';

function setBtnLoading(btn, loading, originalText) {
  if (!btn) return;
  if (loading) {
    btn.disabled = true;
    btn.dataset.originalText = btn.textContent;
    btn.innerHTML = '<span style="display:inline-block;width:12px;height:12px;border:2px solid rgba(255,255,255,0.3);border-top-color:#FFF;border-radius:50%;animation:popupSpin 0.6s linear infinite;vertical-align:middle;margin-right:6px;"></span>' + (originalText || 'Loading...');
  } else {
    btn.disabled = false;
    btn.textContent = btn.dataset.originalText || originalText || btn.textContent;
  }
}

function addPopupSpinnerKeyframe() {
  if (document.getElementById('red-popup-spinner-style')) return;
  var s = document.createElement('style');
  s.id = 'red-popup-spinner-style';
  s.textContent = '@keyframes popupSpin{to{transform:rotate(360deg)}}';
  document.head.appendChild(s);
}
addPopupSpinnerKeyframe();

async function supabaseAuth(path, body) {
  const res = await fetch(`${SUPABASE_URL}/auth/v1/${path}`, {
    method: 'POST',
    headers: { 'apikey': SUPABASE_ANON_KEY, 'Content-Type': 'application/json' },
    body: body ? JSON.stringify(body) : undefined,
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data.error_description || data.msg || data.error || 'Auth request failed');
  return data;
}

async function supabaseRestGet(path, accessToken) {
  const res = await fetch(`${SUPABASE_URL}/rest/v1/${path}`, {
    headers: { 'apikey': SUPABASE_ANON_KEY, 'Authorization': `Bearer ${accessToken}` },
  });
  if (!res.ok) throw new Error('Failed to fetch data');
  return res.json();
}

async function refreshAccessTokenPopup() {
  const { supabase_refresh_token } = await chrome.storage.local.get('supabase_refresh_token');
  if (!supabase_refresh_token) {
    await clearSession();
    return null;
  }
  try {
    const res = await fetch(`${SUPABASE_URL}/auth/v1/token?grant_type=refresh_token`, {
      method: 'POST',
      headers: { 'apikey': SUPABASE_ANON_KEY, 'Content-Type': 'application/json' },
      body: JSON.stringify({ refresh_token: supabase_refresh_token }),
    });
    const data = await res.json();
    if (!res.ok) {
      console.warn('[RED] Popup token refresh failed:', res.status);
      await clearSession();
      return null;
    }
    await storeSession(data.access_token, data.refresh_token, data.user, data.expires_in);
    console.log('[RED] Popup token refreshed successfully');
    return data.access_token;
  } catch (e) {
    console.warn('[RED] Popup token refresh error:', e);
    return null;
  }
}

async function getValidToken() {
  const { supabase_token, supabase_token_expiry } = await chrome.storage.local.get(['supabase_token', TOKEN_EXPIRY_KEY]);
  if (!supabase_token) return null;
  if (supabase_token_expiry && Date.now() < supabase_token_expiry - REFRESH_BUFFER_MS) {
    return supabase_token;
  }
  return await refreshAccessTokenPopup();
}

function generateCodeVerifier() {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789-._~';
  const array = new Uint8Array(64);
  crypto.getRandomValues(array);
  return Array.from(array, b => chars[b % chars.length]).join('');
}

async function sha256Base64URL(str) {
  const encoder = new TextEncoder();
  const digest = await crypto.subtle.digest('SHA-256', encoder.encode(str));
  return btoa(String.fromCharCode(...new Uint8Array(digest)))
    .replace(/=+$/, '').replace(/\+/g, '-').replace(/\//g, '_');
}

function showView(name) {
  document.getElementById('view-login').style.display = name === 'login' ? 'block' : 'none';
  document.getElementById('view-account').style.display = name === 'account' ? 'block' : 'none';
  document.getElementById('view-signup').style.display = name === 'signup' ? 'block' : 'none';
  currentView = name;
}

function showError(id, msg) {
  const el = document.getElementById(id);
  el.textContent = msg;
  el.classList.add('form-error--visible');
}

function hideError(id) {
  const el = document.getElementById(id);
  el.textContent = '';
  el.classList.remove('form-error--visible');
}

function storeSession(accessToken, refreshToken, user, expiresIn) {
  const expiry = expiresIn ? Date.now() + (expiresIn * 1000) : null;
  return new Promise(resolve => {
    const data = {
      supabase_token: accessToken,
      supabase_refresh_token: refreshToken,
      supabase_user: { id: user.id, email: user.email },
    };
    if (expiry) data[TOKEN_EXPIRY_KEY] = expiry;
    chrome.storage.local.set(data, resolve);
  });
}

function clearSession() {
  return new Promise(resolve => {
    chrome.storage.local.remove(['supabase_token', 'supabase_refresh_token', 'supabase_user', 'user_type', TOKEN_EXPIRY_KEY], resolve);
  });
}

async function loadAccountView() {
  const { supabase_token, supabase_user } = await chrome.storage.local.get(['supabase_token', 'supabase_user']);
  if (!supabase_token || !supabase_user) {
    showView('login');
    return;
  }

  showView('account');
  var refreshBtn = document.getElementById('btn-refresh');
  setBtnLoading(refreshBtn, true, 'Loading...');
  document.getElementById('plan-badge').textContent = 'Loading...';
  document.getElementById('quota-display').textContent = 'Loading...';

  const loaded = await fetchAndRenderAccount(supabase_user);
  if (!loaded) {
    const newToken = await refreshAccessTokenPopup();
    if (newToken) {
      const { supabase_user: freshUser } = await chrome.storage.local.get('supabase_user');
      const loaded2 = await fetchAndRenderAccount(freshUser, newToken);
      if (loaded2) {
        setBtnLoading(refreshBtn, false, 'Refresh');
        return;
      }
    }
    document.getElementById('quota-display').textContent = 'Error loading data';
  }
  setBtnLoading(refreshBtn, false, 'Refresh');
}

async function fetchAndRenderAccount(supabase_user, tokenOverride) {
  try {
    const token = tokenOverride || await getValidToken();
    if (!token) return false;

    const today = new Date().toISOString().split('T')[0];
    const [users, usageLog] = await Promise.all([
      supabaseRestGet(`users?id=eq.${supabase_user.id}&select=user_type`, token),
      supabaseRestGet(`usage_log?user_id=eq.${supabase_user.id}&date=eq.${today}&select=quota_consumed`, token),
    ]);

    const userType = (users && users[0]?.user_type) || 'free';
    const quotaUsed = usageLog ? usageLog.reduce((sum, r) => sum + (r.quota_consumed || 0), 0) : 0;
    const quotaMax = userType === 'premium' ? QUOTA_PREMIUM : QUOTA_FREE;

    const badge = document.getElementById('plan-badge');
    if (userType === 'premium') {
      badge.textContent = 'Premium';
      badge.className = 'plan-badge plan-badge--premium';
    } else {
      badge.textContent = 'Free';
      badge.className = 'plan-badge plan-badge--free';
    }

    document.getElementById('quota-display').textContent = `${quotaUsed} / ${quotaMax}`;
    document.getElementById('upgrade-row').style.display = userType === 'free' ? 'flex' : 'none';
    var upgradeMsg = document.getElementById('upgrade-msg');
    if (upgradeMsg) upgradeMsg.style.display = 'none';
    chrome.storage.local.set({ user_type: userType });
    return true;
  } catch (e) {
    console.error('[RED] Failed to load account data:', e);
    return false;
  }
}

async function signInWithEmail(email, password) {
  hideError('login-error');
  var btn = document.getElementById('btn-signin');
  setBtnLoading(btn, true, 'Signing in...');
  try {
    const data = await supabaseAuth('token?grant_type=password', { email, password });
    await storeSession(data.access_token, data.refresh_token, data.user, data.expires_in);
    await loadAccountView();
  } catch (e) {
    showError('login-error', e.message || 'Sign in failed');
  } finally {
    setBtnLoading(btn, false, 'Sign In');
  }
}

async function signUp(email, password) {
  if (password.length < 6) {
    showError('signup-error', 'Password must be at least 6 characters');
    return;
  }
  hideError('signup-error');
  var btn = document.getElementById('btn-signup');
  setBtnLoading(btn, true, 'Creating...');
  try {
    await supabaseAuth('signup', { email, password });
    showError('signup-error', 'Account created! Check your email to confirm.');
  } catch (e) {
    showError('signup-error', e.message || 'Sign up failed');
  } finally {
    setBtnLoading(btn, false, 'Create Account');
  }
}

async function signInWithGoogle() {
  hideError('login-error');
  var btn = document.getElementById('btn-google');
  setBtnLoading(btn, true, 'Connecting...');
  try {
    const verifier = generateCodeVerifier();
    const challenge = await sha256Base64URL(verifier);
    const redirectTo = `https://${chrome.runtime.id}.chromiumapp.org/`;

    const authUrl = `${SUPABASE_URL}/auth/v1/authorize?` +
      `provider=google&redirect_to=${encodeURIComponent(redirectTo)}` +
      `&code_challenge=${challenge}&code_challenge_method=s256`;

    const redirectUrl = await new Promise((resolve, reject) => {
      chrome.identity.launchWebAuthFlow({ url: authUrl, interactive: true }, (result) => {
        if (chrome.runtime.lastError) {
          reject(new Error(chrome.runtime.lastError.message));
        } else if (!result) {
          reject(new Error('OAuth returned no URL'));
        } else {
          resolve(result);
        }
      });
    });

    const parsed = new URL(redirectUrl);
    const code = parsed.searchParams.get('code');
    if (!code) throw new Error('No authorization code returned');

    const session = await supabaseAuth('token?grant_type=authorization_code', {
      code,
      code_verifier: verifier,
      redirect_to: redirectTo,
    });

    await storeSession(session.access_token, session.refresh_token, session.user, session.expires_in);
    await loadAccountView();
  } catch (e) {
    if (e.message && (e.message.includes('policy') || e.message.includes('redirect_uri') || e.message.includes('OAuth2'))) {
      showError('login-error', 'Google sign-in needs setup. Sign in with email/password instead.');
    } else {
      showError('login-error', e.message || 'Google sign-in failed');
    }
  } finally {
    setBtnLoading(btn, false, 'Sign in with Google');
  }
}

async function signOut() {
  var btn = document.getElementById('btn-signout');
  if (btn) { btn.textContent = 'Signing out...'; btn.style.pointerEvents = 'none'; }
  const { supabase_token } = await chrome.storage.local.get('supabase_token');
  if (supabase_token) {
    try {
      await supabaseAuth('logout', null);
    } catch (e) { /* ignore logout errors */ }
  }
  await clearSession();
  showView('login');
}

async function init() {
  try {
    const { supabase_token } = await chrome.storage.local.get('supabase_token');
    if (supabase_token) {
      await getValidToken();
      await loadAccountView();
    } else {
      showView('login');
    }

    document.getElementById('btn-signin').addEventListener('click', (e) => {
      e.preventDefault();
      const email = document.getElementById('email').value.trim();
      const password = document.getElementById('password').value;
      if (!email || !password) {
        showError('login-error', 'Please enter email and password');
        return;
      }
      signInWithEmail(email, password);
    });

    document.getElementById('btn-google').addEventListener('click', (e) => {
      e.preventDefault();
      signInWithGoogle();
    });

    document.getElementById('btn-signup').addEventListener('click', (e) => {
      e.preventDefault();
      const email = document.getElementById('signup-email').value.trim();
      const password = document.getElementById('signup-password').value;
      if (!email || !password) {
        showError('signup-error', 'Please enter email and password');
        return;
      }
      signUp(email, password);
    });

    document.getElementById('btn-signout').addEventListener('click', (e) => {
      e.preventDefault();
      signOut();
    });

    document.getElementById('btn-refresh').addEventListener('click', (e) => {
      e.preventDefault();
      loadAccountView();
    });

    document.getElementById('toggle-signup').addEventListener('click', () => showView('signup'));
    document.getElementById('toggle-login').addEventListener('click', () => showView('login'));

    document.getElementById('btn-upgrade').addEventListener('click', async (e) => {
      e.preventDefault();
      const upgradeRow = document.getElementById('upgrade-row');
      const upgradeMsg = document.getElementById('upgrade-msg');
      const upgradeBtn = document.getElementById('btn-upgrade');
      const token = await getValidToken();
      if (!token) {
        upgradeRow.style.display = 'none';
        upgradeMsg.style.display = 'block';
        upgradeMsg.textContent = 'Please sign in to upgrade.';
        return;
      }

      setBtnLoading(upgradeBtn, true, 'Creating link...');

      const { supabase_user } = await chrome.storage.local.get('supabase_user');
      if (!supabase_user) {
        upgradeRow.style.display = 'none';
        upgradeMsg.style.display = 'block';
        upgradeMsg.textContent = 'Please sign in first.';
        setBtnLoading(upgradeBtn, false, 'Upgrade to Premium →');
        return;
      }

      let paymentUrl;
      try {
        const res = await fetch(RAZORPAY_CREATE_FN, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: 'Bearer ' + token,
          },
          body: JSON.stringify({ user_id: supabase_user.id, email: supabase_user.email }),
        });
        const data = await res.json();
        if (!res.ok) throw new Error(data.error || 'Failed to create payment link');
        paymentUrl = data.url;
      } catch (e) {
        setBtnLoading(upgradeBtn, false, 'Upgrade to Premium →');
        upgradeMsg.style.display = 'block';
        upgradeMsg.textContent = 'Could not create payment link. Please try again.';
        console.error('[RED] Razorpay create link error:', e);
        return;
      }

      chrome.tabs.create({ url: paymentUrl });

      upgradeRow.style.display = 'none';
      upgradeMsg.style.display = 'block';
      upgradeMsg.textContent = 'Waiting for payment confirmation...';

      const startTime = Date.now();
      const poll = async () => {
        if (Date.now() - startTime >= POLL_TIMEOUT_MS) {
          upgradeMsg.textContent = 'Payment not detected yet. Click Refresh after completing purchase.';
          setBtnLoading(upgradeBtn, false, 'Upgrade to Premium →');
          return;
        }
        try {
          const freshToken = await getValidToken();
          if (!freshToken) {
            upgradeMsg.textContent = 'Session expired. Please sign in again.';
            setBtnLoading(upgradeBtn, false, 'Upgrade to Premium →');
            return;
          }
          const [users] = await Promise.all([
            supabaseRestGet(`users?id=eq.${supabase_user.id}&select=user_type`, freshToken),
          ]);
          const userType = (users && users[0]?.user_type) || 'free';
          if (userType === 'premium') {
            upgradeMsg.textContent = '';
            upgradeMsg.style.display = 'none';
            setBtnLoading(upgradeBtn, false, 'Upgrade to Premium →');
            await loadAccountView();
            return;
          }
        } catch (err) {
          console.error('[RED] Poll error:', err);
        }
        setTimeout(poll, POLL_INTERVAL_MS);
      };
      setTimeout(poll, POLL_INTERVAL_MS);
    });

    document.getElementById('email').addEventListener('keydown', (e) => {
      if (e.key === 'Enter') {
        e.preventDefault();
        document.getElementById('btn-signin').click();
      }
    });
    document.getElementById('password').addEventListener('keydown', (e) => {
      if (e.key === 'Enter') {
        e.preventDefault();
        document.getElementById('btn-signin').click();
      }
    });
    document.getElementById('signup-email').addEventListener('keydown', (e) => {
      if (e.key === 'Enter') {
        e.preventDefault();
        document.getElementById('btn-signup').click();
      }
    });
    document.getElementById('signup-password').addEventListener('keydown', (e) => {
      if (e.key === 'Enter') {
        e.preventDefault();
        document.getElementById('btn-signup').click();
      }
    });
  } catch (e) {
    console.error('[RED] init error:', e);
  }
}

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', init);
} else {
  init();
}
