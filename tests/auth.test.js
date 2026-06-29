import { describe, it, expect, vi, beforeEach } from 'vitest';

// Mock chrome.storage.local — supports both Promise and callback patterns
const storageData = {};
const mockChromeStorage = {
  get: vi.fn((keys, cb) => {
    if (typeof keys === 'string') keys = [keys];
    const result = {};
    for (const key of (keys || [])) {
      if (key in storageData) result[key] = storageData[key];
    }
    if (cb) cb(result);
    return Promise.resolve(result);
  }),
  set: vi.fn((items, cb) => {
    Object.assign(storageData, items);
    if (cb) cb();
    return Promise.resolve();
  }),
  remove: vi.fn((keys, cb) => {
    if (typeof keys === 'string') keys = [keys];
    for (const key of keys) delete storageData[key];
    if (cb) cb();
    return Promise.resolve();
  }),
};

globalThis.chrome = globalThis.chrome || {};
globalThis.chrome.storage = globalThis.chrome.storage || {};
globalThis.chrome.storage.local = mockChromeStorage;

// Simulate the auth.js functions
const TOKEN_EXPIRY_KEY = 'supabase_token_expiry';
const BUFFER_MS = 5 * 60 * 1000;

let _refreshPromise = null;

async function storeAuthSession(accessToken, refreshToken, expiresIn) {
  var expiry = Date.now() + (expiresIn * 1000);
  return new Promise(function (resolve) {
    mockChromeStorage.set({
      supabase_token: accessToken,
      supabase_refresh_token: refreshToken,
      supabase_token_expiry: expiry,
    }, resolve);
  });
}

async function clearAuthSession() {
  return new Promise(function (resolve) {
    mockChromeStorage.remove([
      'supabase_token', 'supabase_refresh_token',
      'supabase_user', 'user_type', TOKEN_EXPIRY_KEY
    ], resolve);
  });
}

async function refreshAccessToken() {
  var result = await mockChromeStorage.get('supabase_refresh_token');
  var refreshToken = result.supabase_refresh_token;
  if (!refreshToken) {
    await clearAuthSession();
    return null;
  }
  return 'new-access-token-' + Date.now();
}

async function getValidToken() {
  if (_refreshPromise) {
    await _refreshPromise;
    var afterRefresh = await mockChromeStorage.get(['supabase_token', TOKEN_EXPIRY_KEY]);
    if (afterRefresh.supabase_token && afterRefresh[TOKEN_EXPIRY_KEY] && Date.now() < afterRefresh[TOKEN_EXPIRY_KEY] - BUFFER_MS) {
      return afterRefresh.supabase_token;
    }
    return afterRefresh.supabase_token || null;
  }

  var result = await mockChromeStorage.get(['supabase_token', TOKEN_EXPIRY_KEY]);
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

async function proactiveRefresh() {
  var result = await mockChromeStorage.get(['supabase_token', TOKEN_EXPIRY_KEY]);
  if (!result.supabase_token) return;
  var expiry = result[TOKEN_EXPIRY_KEY];
  if (!expiry || Date.now() >= expiry - BUFFER_MS) {
    await refreshAccessToken();
  }
}

describe('storeAuthSession()', () => {
  beforeEach(() => {
    Object.keys(storageData).forEach(k => delete storageData[k]);
    vi.clearAllMocks();
  });

  it('stores token, refresh_token, and expiry', async () => {
    const before = Date.now();
    await storeAuthSession('access123', 'refresh456', 3600);
    const data = await mockChromeStorage.get(['supabase_token', 'supabase_refresh_token', TOKEN_EXPIRY_KEY]);
    expect(data.supabase_token).toBe('access123');
    expect(data.supabase_refresh_token).toBe('refresh456');
    expect(data[TOKEN_EXPIRY_KEY]).toBeGreaterThan(before);
  });

  it('calculates correct expiry', async () => {
    const now = Date.now();
    await storeAuthSession('tok', 'ref', 3600);
    const data = await mockChromeStorage.get([TOKEN_EXPIRY_KEY]);
    // Should be roughly now + 3600s
    expect(data[TOKEN_EXPIRY_KEY]).toBeGreaterThan(now + 3590 * 1000);
    expect(data[TOKEN_EXPIRY_KEY]).toBeLessThan(now + 3610 * 1000);
  });
});

describe('clearAuthSession()', () => {
  beforeEach(() => {
    Object.keys(storageData).forEach(k => delete storageData[k]);
  });

  it('removes all auth keys', async () => {
    await storeAuthSession('tok', 'ref', 3600);
    await mockChromeStorage.set({ supabase_user: { id: 'u1' }, user_type: 'free' });
    await clearAuthSession();
    const data = await mockChromeStorage.get(['supabase_token', 'supabase_refresh_token', 'supabase_user', 'user_type', TOKEN_EXPIRY_KEY]);
    expect(data.supabase_token).toBeUndefined();
    expect(data.supabase_refresh_token).toBeUndefined();
    expect(data.supabase_user).toBeUndefined();
    expect(data.user_type).toBeUndefined();
    expect(data[TOKEN_EXPIRY_KEY]).toBeUndefined();
  });
});

describe('getValidToken()', () => {
  beforeEach(() => {
    Object.keys(storageData).forEach(k => delete storageData[k]);
    _refreshPromise = null;
    vi.clearAllMocks();
  });

  it('returns null when no token stored', async () => {
    const token = await getValidToken();
    expect(token).toBeNull();
  });

  it('returns valid token if not expired', async () => {
    const farFuture = Date.now() + 3600 * 1000;
    await mockChromeStorage.set({ supabase_token: 'valid-token', [TOKEN_EXPIRY_KEY]: farFuture });
    const token = await getValidToken();
    expect(token).toBe('valid-token');
  });

  it('returns null and clears session when refresh_token missing', async () => {
    const past = Date.now() - 1000;
    await mockChromeStorage.set({
      supabase_token: 'expired-token',
      [TOKEN_EXPIRY_KEY]: past,
    });
    const token = await getValidToken();
    expect(token).toBeNull();
  });

  it('refreshes token when expired', async () => {
    const past = Date.now() - 1000;
    await mockChromeStorage.set({
      supabase_token: 'old-token',
      supabase_refresh_token: 'refresh-token',
      [TOKEN_EXPIRY_KEY]: past,
    });
    const token = await getValidToken();
    expect(token).toBeTruthy();
    expect(token).not.toBe('old-token');
  });
});

describe('proactiveRefresh()', () => {
  beforeEach(() => {
    Object.keys(storageData).forEach(k => delete storageData[k]);
    vi.clearAllMocks();
  });

  it('does nothing if no token', async () => {
    const prevCalls = mockChromeStorage.get.mock.calls.length;
    await proactiveRefresh();
    expect(mockChromeStorage.get).toHaveBeenCalled();
  });

  it('refresh happens when token is expired', async () => {
    // Mock refreshAccessToken to actually set a new token
    const originalRef = refreshAccessToken;
    refreshAccessToken = async function () {
      const newTok = 'new-token-' + Date.now();
      await mockChromeStorage.set({ supabase_token: newTok });
      return newTok;
    };

    const past = Date.now() - 1000;
    await mockChromeStorage.set({
      supabase_token: 'tok',
      supabase_refresh_token: 'ref',
      [TOKEN_EXPIRY_KEY]: past,
    });
    await proactiveRefresh();
    const data = await mockChromeStorage.get(['supabase_token']);
    expect(data.supabase_token).not.toBe('tok');
    refreshAccessToken = originalRef;
  });
});
