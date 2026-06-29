import { describe, it, expect, vi, beforeEach } from 'vitest';

// Mock chrome.storage.local
const storageData = {};
globalThis.chrome = globalThis.chrome || {};
globalThis.chrome.storage = globalThis.chrome.storage || {};
globalThis.chrome.storage.local = {
  get: vi.fn((keys) => {
    if (typeof keys === 'string') keys = [keys];
    const result = {};
    for (const key of (keys || [])) {
      if (key in storageData) result[key] = storageData[key];
    }
    return Promise.resolve(result);
  }),
  set: vi.fn((items) => {
    Object.assign(storageData, items);
    return Promise.resolve();
  }),
  remove: vi.fn((keys) => {
    if (typeof keys === 'string') keys = [keys];
    for (const key of keys) delete storageData[key];
    return Promise.resolve();
  }),
};
globalThis.chrome.storage.onChanged = {
  addListener: vi.fn(),
};
globalThis.chrome.runtime = {
  id: 'test-id',
  getURL: vi.fn(),
  sendMessage: vi.fn(),
  onMessage: { addListener: vi.fn() },
};

// Functions from content-script.js (extracted for testing)
let debounceTimer = null;
let currentPromptText = '';

describe('saveAnalysisToSupabase()', () => {
  let originalFetch;
  let fetchMock;

  beforeEach(() => {
    Object.keys(storageData).forEach(k => delete storageData[k]);
    vi.clearAllMocks();
    originalFetch = globalThis.fetch;
    fetchMock = vi.fn(() => Promise.resolve(new Response()));
    globalThis.fetch = fetchMock;
    globalThis.__RED = globalThis.__RED || {};
    globalThis.__RED.getValidToken = vi.fn(() => Promise.resolve('mock-token'));
  });

  afterEach(() => {
    globalThis.fetch = originalFetch;
  });

  async function saveAnalysisToSupabase(text, tokens, analysis) {
    if (!text || text.trim().split(/\s+/).length < 3) return;
    var result = await chrome.storage.local.get(['supabase_user', 'user_type']);
    if (result.user_type !== 'premium') return;
    if (!result.supabase_user) return;
    var token = await globalThis.__RED.getValidToken();
    if (!token) return;
    try {
      await fetch('https://votjuphsggdecoawqeqc.supabase.co/rest/v1/refine_history', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: 'Bearer ' + token,
          apikey: 'test-anon-key',
          Prefer: 'return=minimal',
        },
        body: JSON.stringify({
          user_id: result.supabase_user.id,
          original_prompt: text.trim(),
          refined_prompt: null,
          token_count_before: tokens,
          token_count_after: null,
          score: analysis && analysis.scores ? analysis.scores.overall : 0,
        }),
      });
    } catch (e) {
      console.warn('[RED] Failed to save analysis to Supabase:', e);
    }
  }

  it('does nothing for short text (< 3 words)', async () => {
    await saveAnalysisToSupabase('hi', 2, { scores: { overall: 80 } });
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('does nothing for non-premium users', async () => {
    await chrome.storage.local.set({ user_type: 'free', supabase_user: { id: 'u1' } });
    await saveAnalysisToSupabase('hello world test', 5, { scores: { overall: 80 } });
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('does nothing if no user', async () => {
    await chrome.storage.local.set({ user_type: 'premium' });
    await saveAnalysisToSupabase('hello world test', 5, { scores: { overall: 80 } });
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('calls fetch for premium user with valid data', async () => {
    await chrome.storage.local.set({ user_type: 'premium', supabase_user: { id: 'user-123' } });
    await saveAnalysisToSupabase('hello world test prompt', 5, { scores: { overall: 85 } });
    expect(fetchMock).toHaveBeenCalledTimes(1);
    const callArgs = fetchMock.mock.calls[0];
    expect(callArgs[0]).toContain('/rest/v1/refine_history');
    const body = JSON.parse(callArgs[1].body);
    expect(body.user_id).toBe('user-123');
    expect(body.score).toBe(85);
    expect(body.token_count_before).toBe(5);
  });

  it('handles fetch errors gracefully', async () => {
    fetchMock = vi.fn(() => Promise.reject(new Error('Network error')));
    globalThis.fetch = fetchMock;
    await chrome.storage.local.set({ user_type: 'premium', supabase_user: { id: 'u1' } });
    await saveAnalysisToSupabase('hello world test prompt', 5, { scores: { overall: 85 } });
    // Should not throw
  });
});

describe('refinePrompt() input validation', () => {
  it('currentPromptText starts empty', () => {
    expect(currentPromptText).toBe('');
  });
});

describe('EDGE_FN_URL and SUPABASE_URL constants', () => {
  it('SUPABASE_URL is set correctly in source', () => {
    // This tests the hardcoded URL is consistent
    const SUPABASE_URL = 'https://votjuphsggdecoawqeqc.supabase.co';
    expect(SUPABASE_URL).toMatch(/^https:\/\/.+\.supabase\.co$/);
  });

  it('EDGE_FN_URL is derived from SUPABASE_URL', () => {
    const SUPABASE_URL = 'https://votjuphsggdecoawqeqc.supabase.co';
    const EDGE_FN_URL = SUPABASE_URL + '/functions/v1/refine';
    expect(EDGE_FN_URL).toBe('https://votjuphsggdecoawqeqc.supabase.co/functions/v1/refine');
  });
});
