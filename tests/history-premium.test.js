import { describe, it, expect, vi, beforeEach } from 'vitest';

// Functions from history-premium.js

function getScoreTierP(score) {
  if (score >= 80) return 'high';
  if (score >= 50) return 'medium';
  return 'low';
}

function tierColorsP(tier) {
  if (tier === 'high') return { bg: '#E1F5EE', text: '#085041' };
  if (tier === 'medium') return { bg: '#FAEEDA', text: '#633806' };
  return { bg: '#FCEBEB', text: '#791F1F' };
}

function filterDateRange(filter) {
  var now = new Date();
  switch (filter) {
    case '1d':
      return new Date(now.getTime() - 24 * 60 * 60 * 1000);
    case '7d':
      return new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
    case '30d':
      return new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
    default:
      return null;
  }
}

function computeMetrics(data) {
  var totalPrompts = data.length;
  var refinements = 0;
  var totalTokens = 0;
  var totalScore = 0;

  for (var i = 0; i < data.length; i++) {
    var d = data[i];
    if (d.refined) refinements++;
    if (d.tokens > 0) totalTokens += d.tokens;
    totalScore += d.score || 0;
  }

  return {
    avgScore: totalPrompts > 0 ? Math.round(totalScore / totalPrompts) : '—',
    avgScoreDelta: '',
    totalPrompts: totalPrompts,
    tokensSaved: totalTokens,
    refinements: refinements,
  };
}

function formatRelTimeP(isoStr) {
  var d = new Date(isoStr);
  var now = new Date();
  var diff = now.getTime() - d.getTime();
  if (diff < 60000) return 'Just now';
  if (diff < 3600000) return Math.floor(diff / 60000) + ' min ago';
  if (diff < 86400000) return Math.floor(diff / 3600000) + 'h ago';
  if (diff < 172800000) return 'Yesterday';
  return d.toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
}

function exportCsvData(data) {
  if (!data || data.length === 0) return '';

  var header = 'Date,Prompt,Score,Tokens,Refined\n';
  var rows = '';
  for (var i = 0; i < data.length; i++) {
    var d = data[i];
    var date = d.createdAt ? d.createdAt.slice(0, 10) : '';
    var prompt = (d.prompt || '').replace(/"/g, '""');
    rows +=
      '"' +
      date +
      '","' +
      prompt.slice(0, 100) +
      '",' +
      (d.score || 0) +
      ',' +
      (d.tokens || 0) +
      ',' +
      (d.refined ? 'Yes' : 'No') +
      '\n';
  }
  return header + rows;
}

describe('getScoreTierP()', () => {
  it('returns high for score >= 80', () => {
    expect(getScoreTierP(80)).toBe('high');
    expect(getScoreTierP(100)).toBe('high');
  });

  it('returns medium for score 50-79', () => {
    expect(getScoreTierP(50)).toBe('medium');
    expect(getScoreTierP(79)).toBe('medium');
  });

  it('returns low for score < 50', () => {
    expect(getScoreTierP(0)).toBe('low');
    expect(getScoreTierP(49)).toBe('low');
  });
});

describe('tierColorsP()', () => {
  it('returns correct colors', () => {
    expect(tierColorsP('high').bg).toBe('#E1F5EE');
    expect(tierColorsP('medium').bg).toBe('#FAEEDA');
    expect(tierColorsP('low').bg).toBe('#FCEBEB');
  });
});

describe('filterDateRange()', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2024-06-15T12:00:00Z'));
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('returns date 24h ago for 1d filter', () => {
    const result = filterDateRange('1d');
    expect(result.getTime()).toBe(new Date('2024-06-14T12:00:00Z').getTime());
  });

  it('returns date 7d ago for 7d filter', () => {
    const result = filterDateRange('7d');
    expect(result.getTime()).toBe(new Date('2024-06-08T12:00:00Z').getTime());
  });

  it('returns date 30d ago for 30d filter', () => {
    const result = filterDateRange('30d');
    expect(result.getTime()).toBe(new Date('2024-05-16T12:00:00Z').getTime());
  });

  it('returns null for "all" filter', () => {
    expect(filterDateRange('all')).toBeNull();
  });

  it('returns null for unknown filter', () => {
    expect(filterDateRange('unknown')).toBeNull();
  });
});

describe('computeMetrics()', () => {
  it('returns "—" for avgScore with empty data', () => {
    const result = computeMetrics([]);
    expect(result.avgScore).toBe('—');
    expect(result.totalPrompts).toBe(0);
    expect(result.refinements).toBe(0);
  });

  it('computes average score correctly', () => {
    const data = [
      { score: 80, tokens: 10, refined: true },
      { score: 60, tokens: 20, refined: false },
      { score: 100, tokens: 15, refined: true },
    ];
    const result = computeMetrics(data);
    expect(result.avgScore).toBe(Math.round((80 + 60 + 100) / 3));
    expect(result.totalPrompts).toBe(3);
    expect(result.refinements).toBe(2);
    expect(result.tokensSaved).toBe(45);
  });

  it('handles zero scores', () => {
    const data = [
      { score: 0, tokens: 0, refined: false },
      { score: 0, tokens: 0, refined: false },
    ];
    const result = computeMetrics(data);
    expect(result.avgScore).toBe(0);
    expect(result.tokensSaved).toBe(0);
  });

  it('handles missing fields', () => {
    const data = [{ }, { }];
    const result = computeMetrics(data);
    expect(result.avgScore).toBe(0);
    expect(result.totalPrompts).toBe(2);
    expect(result.refinements).toBe(0);
  });
});

describe('formatRelTimeP()', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2024-06-15T12:00:00Z'));
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('returns "Just now"', () => {
    expect(formatRelTimeP(new Date().toISOString())).toBe('Just now');
  });

  it('returns minutes ago', () => {
    const d = new Date(Date.now() - 5 * 60000);
    expect(formatRelTimeP(d.toISOString())).toBe('5 min ago');
  });

  it('returns hours ago', () => {
    const d = new Date(Date.now() - 3 * 3600000);
    expect(formatRelTimeP(d.toISOString())).toBe('3h ago');
  });

  it('returns Yesterday', () => {
    const d = new Date(Date.now() - 25 * 3600000);
    expect(formatRelTimeP(d.toISOString())).toBe('Yesterday');
  });
});

describe('exportCsvData()', () => {
  it('returns empty string for empty data', () => {
    expect(exportCsvData([])).toBe('');
  });

  it('returns header-only for null/undefined', () => {
    expect(exportCsvData(null)).toBe('');
    expect(exportCsvData(undefined)).toBe('');
  });

  it('generates CSV with correct format', () => {
    const data = [
      { createdAt: '2024-06-15T10:00:00Z', prompt: 'test prompt', score: 85, tokens: 10, refined: true },
    ];
    const csv = exportCsvData(data);
    expect(csv).toContain('Date,Prompt,Score,Tokens,Refined');
    expect(csv).toContain('2024-06-15');
    expect(csv).toContain('test prompt');
    expect(csv).toContain('85');
    expect(csv).toContain('10');
    expect(csv).toContain('Yes');
  });

  it('escapes double quotes in prompt', () => {
    const data = [
      { createdAt: '2024-01-01', prompt: 'hello "world" test', score: 70, tokens: 5, refined: false },
    ];
    const csv = exportCsvData(data);
    expect(csv).toContain('""'); // escaped quote
  });

  it('truncates prompts to 100 chars in CSV', () => {
    const longPrompt = 'x'.repeat(200);
    const data = [
      { createdAt: '2024-01-01', prompt: longPrompt, score: 50, tokens: 10, refined: false },
    ];
    const csv = exportCsvData(data);
    expect(csv).not.toContain('x'.repeat(101));
  });
});

describe('insightsAction()', () => {
  function insightsAction() {
    var text = 'What patterns do you see in my prompt writing based on my history?';
    return text;
  }

  it('returns the insights prompt text', () => {
    expect(insightsAction()).toBe('What patterns do you see in my prompt writing based on my history?');
  });
});
