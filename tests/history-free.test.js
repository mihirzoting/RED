import { describe, it, expect, vi, beforeEach } from 'vitest';

// Mock chrome.storage.local
const storageData = {};
const mockChromeStorage = {
  _data: storageData,
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

globalThis.chrome = globalThis.chrome || {};
globalThis.chrome.storage = globalThis.chrome.storage || {};
globalThis.chrome.storage.local = mockChromeStorage;

// Functions from history-free.js
function getScoreTier(score) {
  if (score >= 80) return 'high';
  if (score >= 50) return 'medium';
  return 'low';
}

function tierColors(tier) {
  if (tier === 'high') return { bg: '#E1F5EE', text: '#085041' };
  if (tier === 'medium') return { bg: '#FAEEDA', text: '#633806' };
  return { bg: '#FCEBEB', text: '#791F1F' };
}

async function saveToFreeHistory(entry) {
  var promptTrunc = entry.prompt || '';
  if (promptTrunc.length > 200) promptTrunc = promptTrunc.slice(0, 200);

  var item = {
    id: Date.now(),
    prompt: promptTrunc,
    score: entry.score || 0,
    tokens: entry.tokens || 0,
    refined: !!entry.refined,
    refinedScore: entry.refinedScore || null,
    issues: Array.isArray(entry.issues) ? entry.issues.slice(0, 3) : [],
    createdAt: new Date().toISOString(),
  };

  try {
    var result = await mockChromeStorage.get('red_history');
    var list = result.red_history || [];
    list.unshift(item);
    if (list.length > 20) list.length = 20;
    await mockChromeStorage.set({ red_history: list });
  } catch (e) {
    console.warn('[RED] Failed to save free history:', e);
  }
}

async function loadFreeHistory() {
  try {
    var result = await mockChromeStorage.get('red_history');
    return result.red_history || [];
  } catch (e) {
    return [];
  }
}

describe('getScoreTier()', () => {
  it('returns high for score >= 80', () => {
    expect(getScoreTier(80)).toBe('high');
    expect(getScoreTier(100)).toBe('high');
  });

  it('returns medium for score 50-79', () => {
    expect(getScoreTier(50)).toBe('medium');
    expect(getScoreTier(79)).toBe('medium');
  });

  it('returns low for score < 50', () => {
    expect(getScoreTier(0)).toBe('low');
    expect(getScoreTier(49)).toBe('low');
  });
});

describe('tierColors()', () => {
  it('returns correct colors for high', () => {
    const c = tierColors('high');
    expect(c.bg).toBe('#E1F5EE');
    expect(c.text).toBe('#085041');
  });

  it('returns correct colors for medium', () => {
    const c = tierColors('medium');
    expect(c.bg).toBe('#FAEEDA');
    expect(c.text).toBe('#633806');
  });

  it('returns correct colors for low', () => {
    const c = tierColors('low');
    expect(c.bg).toBe('#FCEBEB');
    expect(c.text).toBe('#791F1F');
  });
});

describe('saveToFreeHistory()', () => {
  beforeEach(() => {
    Object.keys(storageData).forEach(k => delete storageData[k]);
    vi.clearAllMocks();
  });

  it('saves an entry', async () => {
    await saveToFreeHistory({ prompt: 'test prompt', score: 85, tokens: 10 });
    const hist = await loadFreeHistory();
    expect(hist.length).toBe(1);
    expect(hist[0].prompt).toBe('test prompt');
    expect(hist[0].score).toBe(85);
    expect(hist[0].tokens).toBe(10);
  });

  it('truncates prompt to 200 chars', async () => {
    const longPrompt = 'x'.repeat(300);
    await saveToFreeHistory({ prompt: longPrompt });
    const hist = await loadFreeHistory();
    expect(hist[0].prompt.length).toBe(200);
  });

  it('limits history to 20 entries', async () => {
    for (let i = 0; i < 25; i++) {
      await saveToFreeHistory({ prompt: `prompt ${i}`, score: i });
    }
    const hist = await loadFreeHistory();
    expect(hist.length).toBe(20);
  });

  it('orders newest first', async () => {
    await saveToFreeHistory({ prompt: 'first', score: 50 });
    await saveToFreeHistory({ prompt: 'second', score: 60 });
    const hist = await loadFreeHistory();
    expect(hist[0].prompt).toBe('second');
    expect(hist[1].prompt).toBe('first');
  });

  it('stores refined:true correctly', async () => {
    await saveToFreeHistory({ prompt: 'test', refined: true, refinedScore: 15 });
    const hist = await loadFreeHistory();
    expect(hist[0].refined).toBe(true);
    expect(hist[0].refinedScore).toBe(15);
  });

  it('stores refined:false correctly', async () => {
    await saveToFreeHistory({ prompt: 'test', refined: false });
    const hist = await loadFreeHistory();
    expect(hist[0].refined).toBe(false);
    expect(hist[0].refinedScore).toBe(null);
  });

  it('truncates issues to 3', async () => {
    const manyIssues = ['a', 'b', 'c', 'd', 'e'];
    await saveToFreeHistory({ prompt: 'test', issues: manyIssues });
    const hist = await loadFreeHistory();
    expect(hist[0].issues.length).toBe(3);
  });

  it('handles missing optional fields', async () => {
    await saveToFreeHistory({ prompt: 'test' });
    const hist = await loadFreeHistory();
    expect(hist[0].score).toBe(0);
    expect(hist[0].tokens).toBe(0);
    expect(hist[0].refined).toBe(false);
  });
});

describe('loadFreeHistory()', () => {
  beforeEach(() => {
    Object.keys(storageData).forEach(k => delete storageData[k]);
  });

  it('returns empty array when no history', async () => {
    const hist = await loadFreeHistory();
    expect(hist).toEqual([]);
  });

  it('returns saved entries', async () => {
    await saveToFreeHistory({ prompt: 'test', score: 90 });
    await saveToFreeHistory({ prompt: 'test2', score: 80 });
    const hist = await loadFreeHistory();
    expect(hist.length).toBe(2);
  });

  it('each entry has the correct shape', async () => {
    await saveToFreeHistory({ prompt: 'hello', score: 75, tokens: 5, refined: true, refinedScore: 15, issues: ['vague'] });
    const hist = await loadFreeHistory();
    const entry = hist[0];
    expect(entry).toHaveProperty('id');
    expect(entry).toHaveProperty('prompt');
    expect(entry).toHaveProperty('score');
    expect(entry).toHaveProperty('tokens');
    expect(entry).toHaveProperty('refined');
    expect(entry).toHaveProperty('createdAt');
    expect(typeof entry.id).toBe('number');
    expect(typeof entry.createdAt).toBe('string');
  });
});

describe('formatRelTime()', () => {
  function formatRelTime(isoStr) {
    var d = new Date(isoStr);
    var now = new Date();
    var diff = now.getTime() - d.getTime();
    if (diff < 60000) return 'Just now';
    if (diff < 3600000) return Math.floor(diff / 60000) + ' min ago';
    if (diff < 86400000) return Math.floor(diff / 3600000) + 'h ago';
    if (diff < 172800000) return 'Yesterday';
    return d.toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
  }

  it('returns "Just now" for recent times', () => {
    expect(formatRelTime(new Date().toISOString())).toBe('Just now');
  });

  it('returns "X min ago" for recent minutes', () => {
    const d = new Date(Date.now() - 5 * 60 * 1000);
    expect(formatRelTime(d.toISOString())).toBe('5 min ago');
  });

  it('returns "Xh ago" for hours', () => {
    const d = new Date(Date.now() - 3 * 3600 * 1000);
    expect(formatRelTime(d.toISOString())).toBe('3h ago');
  });

  it('returns "Yesterday" for yesterday', () => {
    const d = new Date(Date.now() - 25 * 3600 * 1000);
    expect(formatRelTime(d.toISOString())).toBe('Yesterday');
  });

  it('returns date for older', () => {
    const d = new Date('2024-01-15');
    const result = formatRelTime(d.toISOString());
    expect(result).toContain('Jan');
    expect(result).toContain('15');
  });
});
