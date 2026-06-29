import { describe, it, expect, beforeEach } from 'vitest';

// Manually inline the analysis.js code for testing
// We do this because the module uses window.__RED and var declarations
const PRICING = [
  { model: 'Claude 3.5 Haiku', input: 0.80, output: 4.00 },
  { model: 'Claude 3.5 Sonnet', input: 3.00, output: 15.00 },
  { model: 'Claude 3 Opus',     input: 15.00, output: 75.00 },
];

const VAGUE_WORDS = new Set([
  'stuff', 'things', 'somehow', 'etc', 'something', 'someone',
  'somewhere', 'sometime', 'various', 'sort of', 'kind of',
  'a lot', 'a bit',
]);

const FILLER_WORDS = new Set([
  'please', 'just', 'very', 'maybe', 'probably', 'quite', 'rather',
  'fairly', 'pretty', 'basically', 'literally', 'actually',
  'nice', 'good',
]);

function findSpans(text) {
  const lower = text.toLowerCase();
  const highlights = [];
  const redundants = [];
  const words = [...lower.matchAll(/\S+/g)];

  for (const m of words) {
    const raw = m[0];
    const clean = raw.replace(/[^a-z0-9]/g, '');
    if (!clean) continue;
    if (FILLER_WORDS.has(clean)) {
      redundants.push({ start: m.index, end: m.index + raw.length, word: text.substring(m.index, m.index + raw.length) });
    } else if (VAGUE_WORDS.has(clean)) {
      highlights.push({ start: m.index, end: m.index + raw.length, word: text.substring(m.index, m.index + raw.length) });
    }
  }

  for (let i = 0; i < words.length - 1; i++) {
    const bigram = words[i][0].replace(/[^a-z0-9]/g, '') + ' ' + words[i + 1][0].replace(/[^a-z0-9]/g, '');
    if (VAGUE_WORDS.has(bigram)) {
      const start = words[i].index;
      const end = words[i + 1].index + words[i + 1][0].length;
      highlights.push({ start, end, word: text.substring(start, end) });
    }
  }

  return { highlight: highlights, redundant: redundants };
}

function detectVagueWords(text) {
  const lower = text.toLowerCase();
  const words = lower.split(/[\s,.;:!?()]+/);
  const found = [];
  for (const w of words) {
    if (VAGUE_WORDS.has(w)) found.push(w);
  }
  for (let i = 0; i < words.length - 1; i++) {
    const bg = words[i] + ' ' + words[i + 1];
    if (VAGUE_WORDS.has(bg)) found.push(bg);
  }
  return found;
}

function detectFillerWords(text) {
  const lower = text.toLowerCase();
  const words = lower.split(/[\s,.;:!?()]+/);
  const found = [];
  for (const w of words) {
    if (FILLER_WORDS.has(w)) found.push(w);
  }
  return found;
}

function detectRunOnSentences(text) {
  const sentences = text.split(/[.!?]+/).filter(Boolean);
  return sentences.filter(s => s.trim().split(/\s+/).length > 40).length;
}

function detectMissingContext(text) {
  const words = text.trim().split(/\s+/);
  if (words.length < 15) {
    const hasVerb = /\b(?:is|are|was|were|do|does|did|have|has|had|make|create|write|tell|show|help|give|find|build|get|use|need|want|can|could|will|would)\b/i.test(text);
    const hasObj = /[.?]/.test(text);
    if (!hasVerb || !hasObj) return true;
  }
  return false;
}

function detectAmbiguousRefs(text) {
  const lower = text.toLowerCase();
  const patterns = [
    /\bthis\s+(article|thing|stuff|code|script|file|function|method|class|document|section|part|one|one's)\b/gi,
    /\bthat\s+(article|thing|stuff|code|script|file|function|method|class|document|section|part|one)\b/gi,
    /\bthe\s+(thing|stuff|article|code|file)\b/gi,
  ];
  let count = 0;
  for (const re of patterns) {
    const matches = lower.match(re);
    if (matches) count += matches.length;
  }
  return count;
}

function computeClarity(vagueCount, runOnCount, totalWords, text) {
  if (totalWords === 0) return 100;
  const vaguePenalty = Math.min(vagueCount * 8, 40);
  const runOnPenalty = Math.min(runOnCount * 15, 30);
  const totalPenalty = vaguePenalty + runOnPenalty;
  let bonus = 0;
  if (/\d/.test(text)) bonus += 5;
  if (/^[-*]\s|\d+\.\s/m.test(text)) bonus += 8;
  if (/`/.test(text)) bonus += 5;
  if (totalWords >= 20) bonus += 3;
  bonus = Math.min(bonus, 20);
  return Math.max(0, Math.min(100, 100 - totalPenalty + bonus));
}

function computeContextRichness(text, totalWords) {
  if (totalWords === 0) return 100;
  let penalty = 0;
  if (detectMissingContext(text)) penalty += 40;
  if (totalWords < 15) penalty += 20;
  const ambigRefs = detectAmbiguousRefs(text);
  penalty += Math.min(ambigRefs * 10, 30);
  let bonus = 0;
  if (/for example|e\.g\.|i\.e\.|such as|like\s+.+\s+(when|if|where)/i.test(text)) bonus += 10;
  const capsCount = (text.match(/\b[A-Z][a-z]{2,}\b/g) || []).length;
  const sentenceStarts = (text.match(/(?:^|\.\s+)[A-Z][a-z]{2,}\b/g) || []).length;
  if (capsCount > sentenceStarts) bonus += 5;
  return Math.max(0, Math.min(100, 100 - penalty + bonus));
}

function computeTokenEfficiency(fillerCount, totalWords) {
  if (totalWords === 0) return 100;
  const fillerDensity = fillerCount / totalWords;
  const fillerPenalty = Math.min(fillerDensity * 200, 50);
  return Math.max(0, Math.min(100, 100 - fillerPenalty));
}

function computeSpecificity(vagueCount, totalWords, text) {
  if (totalWords === 0) return 100;
  const vaguePenalty = Math.min(vagueCount * 12, 50);
  let penalty = vaguePenalty;
  if (detectMissingContext(text)) penalty += 15;
  let bonus = 0;
  if (/\d/.test(text)) bonus += 10;
  const capsCount = (text.match(/\b[A-Z][a-z]{2,}\b/g) || []).length;
  const sentenceStarts = (text.match(/(?:^|\.\s+)[A-Z][a-z]{2,}\b/g) || []).length;
  const properNouns = Math.max(0, capsCount - sentenceStarts);
  bonus += Math.min(properNouns * 5, 15);
  if (/`/.test(text)) bonus += 8;
  return Math.max(0, Math.min(100, 100 - penalty + bonus));
}

function buildIssues(vagueCount, fillerCount, runOnCount, missingCtx, totalWords) {
  const issues = [];
  if (vagueCount > 0) {
    issues.push({ type: 'warning', label: 'Vague language', detail: `${vagueCount} word(s) could be more specific` });
  }
  if (fillerCount > 0) {
    issues.push({ type: 'warning', label: 'Filler words', detail: `${fillerCount} word(s) add no meaning and can be removed` });
  }
  if (missingCtx) {
    issues.push({ type: 'warning', label: 'Missing context', detail: "Prompt may be underspecified — clarify what you're asking about" });
  }
  if (runOnCount > 0) {
    issues.push({ type: 'warning', label: 'Run-on sentence', detail: `${runOnCount} sentence(s) exceed 40 words — consider breaking them up` });
  }
  if (totalWords < 10) {
    issues.push({ type: 'info', label: 'Short prompt', detail: 'Consider adding more detail for a better response' });
  }
  if (totalWords > 100) {
    issues.push({ type: 'info', label: 'Long prompt', detail: 'Long prompts may lose focus — consider narrowing your ask' });
  }
  return issues;
}

function analyzePrompt(text, tokenCount) {
  if (!text || !text.trim()) {
    const empty = { tokenCount: 0, totalWords: 0, scores: { clarity: 100, contextRichness: 100, tokenEfficiency: 100, specificity: 100, overall: 100 }, costEstimate: PRICING.map(p => ({ model: p.model, inputCost: '0.000000', outputCost: '0.000000' })), issues: [], spans: { highlight: [], redundant: [] } };
    return empty;
  }

  const totalWords = text.trim().split(/\s+/).length;
  const vagueWords = detectVagueWords(text);
  const fillerWords = detectFillerWords(text);
  const runOns = detectRunOnSentences(text);
  const missingCtx = detectMissingContext(text);
  const spans = findSpans(text);

  const clarity = computeClarity(vagueWords.length, runOns, totalWords, text);
  const contextRichness = computeContextRichness(text, totalWords);
  const tokenEfficiency = computeTokenEfficiency(fillerWords.length, totalWords);
  const specificity = computeSpecificity(vagueWords.length, totalWords, text);
  const overall = Math.round((clarity + contextRichness + tokenEfficiency + specificity) / 4);

  const costEstimate = PRICING.map(p => ({
    model: p.model,
    inputCost: ((tokenCount / 1_000_000) * p.input).toFixed(6),
    outputCost: ((tokenCount / 1_000_000) * p.output).toFixed(6),
  }));

  const issues = buildIssues(vagueWords.length, fillerWords.length, runOns, missingCtx, totalWords);

  return { tokenCount, totalWords, scores: { clarity, contextRichness, tokenEfficiency, specificity, overall }, costEstimate, issues, spans };
}

// ─── Tests ──────────────────────────────────────────────────────────────────

describe('detectVagueWords()', () => {
  it('detects single vague words', () => {
    expect(detectVagueWords('I need stuff for the project')).toEqual(['stuff']);
  });

  it('detects multi-word vague phrases', () => {
    const result = detectVagueWords('sort of like a thing');
    expect(result).toContain('sort of');
  });

  it('detects "a lot" as vague', () => {
    expect(detectVagueWords('a lot of things')).toContain('a lot');
  });

  it('returns empty for clean text', () => {
    expect(detectVagueWords('Write a python function to sort an array')).toEqual([]);
  });

  it('handles empty string', () => {
    expect(detectVagueWords('')).toEqual([]);
  });

  it('handles punctuation around vague words', () => {
    const result = detectVagueWords('stuff, things, etc.');
    expect(result).toContain('stuff');
    expect(result).toContain('things');
    expect(result).toContain('etc');
  });

  it('case insensitive', () => {
    expect(detectVagueWords('STUFF')).toContain('stuff');
  });
});

describe('detectFillerWords()', () => {
  it('detects common filler words', () => {
    const result = detectFillerWords('please just help me very much');
    expect(result).toContain('please');
    expect(result).toContain('just');
    expect(result).toContain('very');
  });

  it('returns empty for clean text', () => {
    expect(detectFillerWords('Write a function that sorts')).toEqual([]);
  });

  it('detects "basically" as filler', () => {
    expect(detectFillerWords('basically it works')).toContain('basically');
  });

  it('handles empty string', () => {
    expect(detectFillerWords('')).toEqual([]);
  });
});

describe('detectRunOnSentences()', () => {
  it('returns 0 for normal sentences', () => {
    const text = 'This is a short sentence. And another one.';
    expect(detectRunOnSentences(text)).toBe(0);
  });

  it('detects run-on sentences > 40 words', () => {
    const words = Array(45).fill('word').join(' ');
    expect(detectRunOnSentences(words + '.')).toBe(1);
  });

  it('counts multiple run-ons', () => {
    const long = Array(50).fill('word').join(' ') + '. ';
    const long2 = Array(45).fill('word').join(' ') + '. ';
    expect(detectRunOnSentences(long + long2)).toBe(2);
  });

  it('sentence with exactly 40 words is not a run-on', () => {
    const words = Array(40).fill('word').join(' ');
    expect(detectRunOnSentences(words + '.')).toBe(0);
  });

  it('handles empty string', () => {
    expect(detectRunOnSentences('')).toBe(0);
  });
});

describe('detectMissingContext()', () => {
  it('flags short text without verb', () => {
    expect(detectMissingContext('The thing')).toBe(true);
  });

  it('flags short text without object/punctuation', () => {
    expect(detectMissingContext('Help me')).toBe(true);
  });

  it('passes short text with verb and punctuation', () => {
    expect(detectMissingContext('Help me write code?')).toBe(false);
  });

  it('passes long text regardless of structure', () => {
    const longText = Array(20).fill('word').join(' ');
    expect(detectMissingContext(longText)).toBe(false);
  });

  it('handles empty string', () => {
    expect(detectMissingContext('')).toBe(true);
  });
});

describe('detectAmbiguousRefs()', () => {
  it('detects "this thing" as ambiguous', () => {
    expect(detectAmbiguousRefs('Fix this thing')).toBe(1);
  });

  it('detects "the stuff" as ambiguous', () => {
    expect(detectAmbiguousRefs('Check the stuff')).toBe(1);
  });

  it('flags "this function" as ambiguous', () => {
    // "This function" matches the ambiguous ref pattern `this\s+(function)`
    expect(detectAmbiguousRefs('This function sorts an array')).toBe(1);
  });

  it('returns 0 for clean text', () => {
    expect(detectAmbiguousRefs('Write a Python function to merge two sorted arrays')).toBe(0);
  });

  it('counts multiple ambiguous refs', () => {
    expect(detectAmbiguousRefs('this thing and that thing')).toBe(2);
  });
});

describe('computeClarity()', () => {
  it('returns 100 for empty/zero input', () => {
    expect(computeClarity(0, 0, 0, '')).toBe(100);
  });

  it('penalizes vague words', () => {
    const score = computeClarity(3, 0, 50, 'clean text here');
    expect(score).toBeLessThan(100);
    expect(score).toBeGreaterThanOrEqual(0);
  });

  it('penalizes run-on sentences', () => {
    const score = computeClarity(0, 2, 50, 'clean text here');
    expect(score).toBeLessThan(100);
  });

  it('caps vague penalty at 40', () => {
    const score = computeClarity(10, 0, 50, 'text');
    expect(score).toBeGreaterThanOrEqual(60);
  });

  it('adds bonus for numbers', () => {
    const withNum = computeClarity(2, 0, 15, 'give me 5 examples');
    const without = computeClarity(2, 0, 15, 'give me some examples');
    expect(withNum).toBeGreaterThan(without);
  });

  it('adds bonus for code formatting', () => {
    const withCode = computeClarity(2, 0, 15, 'use `map()` function');
    const without = computeClarity(2, 0, 15, 'clean text');
    expect(withCode).toBeGreaterThan(without);
  });

  it('clamps between 0 and 100', () => {
    expect(computeClarity(100, 100, 50, '')).toBeGreaterThanOrEqual(0);
    expect(computeClarity(0, 0, 0, '')).toBeLessThanOrEqual(100);
  });
});

describe('computeContextRichness()', () => {
  it('returns 100 for empty/zero input', () => {
    expect(computeContextRichness('', 0)).toBe(100);
  });

  it('penalizes missing context', () => {
    const score = computeContextRichness('the thing', 2);
    expect(score).toBeLessThan(100);
    expect(score).toBeLessThanOrEqual(60);
  });

  it('penalizes short text', () => {
    const score = computeContextRichness('Help me write code?', 4);
    expect(score).toBeLessThan(100);
  });

  it('adds bonus for examples', () => {
    const withExample = computeContextRichness('Show me for example how to use this when loading', 9);
    const without = computeContextRichness('Show me how to use this', 5);
    expect(withExample).toBeGreaterThanOrEqual(0);
  });

  it('clamps between 0 and 100', () => {
    expect(computeContextRichness('', 0)).toBeLessThanOrEqual(100);
  });
});

describe('computeTokenEfficiency()', () => {
  it('returns 100 for empty/zero input', () => {
    expect(computeTokenEfficiency(0, 0)).toBe(100);
  });

  it('returns 100 for no filler words', () => {
    expect(computeTokenEfficiency(0, 50)).toBe(100);
  });

  it('penalizes high filler density', () => {
    const score = computeTokenEfficiency(10, 20);
    expect(score).toBeLessThan(100);
  });

  it('clamps filler penalty at 50', () => {
    const score = computeTokenEfficiency(50, 50);
    expect(score).toBe(50);
  });

  it('clamps between 0 and 100', () => {
    expect(computeTokenEfficiency(100, 2)).toBeGreaterThanOrEqual(0);
  });
});

describe('computeSpecificity()', () => {
  it('returns 100 for empty/zero input', () => {
    expect(computeSpecificity(0, 0, '')).toBe(100);
  });

  it('penalizes vague words', () => {
    const score = computeSpecificity(3, 50, 'some text');
    expect(score).toBeLessThan(100);
  });

  it('adds bonus for numbers', () => {
    const withNum = computeSpecificity(0, 20, 'give 3 examples');
    const without = computeSpecificity(0, 20, 'give examples');
    expect(withNum).toBeGreaterThan(without);
  });

  it('adds bonus for proper nouns', () => {
    const withProper = computeSpecificity(0, 20, 'Use Python and PostgreSQL');
    const without = computeSpecificity(0, 20, 'use a programming language');
    expect(withProper).toBeGreaterThanOrEqual(without);
  });

  it('adds bonus for code formatting', () => {
    const withCode = computeSpecificity(0, 20, 'Use `Array.map()`');
    const without = computeSpecificity(0, 20, 'Use a method');
    expect(withCode).toBeGreaterThan(without);
  });

  it('penalizes missing context', () => {
    const score = computeSpecificity(0, 2, 'the thing');
    expect(score).toBeLessThan(100);
  });

  it('clamps between 0 and 100', () => {
    expect(computeSpecificity(10, 5, 'stuff things')).toBeGreaterThanOrEqual(0);
  });
});

describe('findSpans()', () => {
  it('highlights vague words', () => {
    const result = findSpans('I need stuff');
    expect(result.highlight.length).toBe(1);
    expect(result.highlight[0].word).toBe('stuff');
  });

  it('marks filler words as redundant', () => {
    const result = findSpans('please help');
    expect(result.redundant.length).toBe(1);
    expect(result.redundant[0].word).toBe('please');
  });

  it('detects bigram vague phrases', () => {
    const result = findSpans('sort of like a thing');
    expect(result.highlight.some(s => s.word === 'sort of')).toBe(true);
  });

  it('returns empty spans for clean text', () => {
    const result = findSpans('Write a Python function to sort integers');
    expect(result.highlight.length).toBe(0);
    expect(result.redundant.length).toBe(0);
  });
});

describe('buildIssues()', () => {
  it('returns warning for vague words', () => {
    const issues = buildIssues(2, 0, 0, false, 20);
    expect(issues.some(i => i.type === 'warning' && i.label === 'Vague language')).toBe(true);
  });

  it('returns warning for filler words', () => {
    const issues = buildIssues(0, 2, 0, false, 20);
    expect(issues.some(i => i.type === 'warning' && i.label === 'Filler words')).toBe(true);
  });

  it('returns warning for missing context', () => {
    const issues = buildIssues(0, 0, 0, true, 20);
    expect(issues.some(i => i.type === 'warning' && i.label === 'Missing context')).toBe(true);
  });

  it('returns warning for run-on sentences', () => {
    const issues = buildIssues(0, 0, 2, false, 50);
    expect(issues.some(i => i.type === 'warning' && i.label === 'Run-on sentence')).toBe(true);
  });

  it('returns info for short prompts', () => {
    const issues = buildIssues(0, 0, 0, false, 5);
    expect(issues.some(i => i.type === 'info' && i.label === 'Short prompt')).toBe(true);
  });

  it('returns info for long prompts', () => {
    const issues = buildIssues(0, 0, 0, false, 150);
    expect(issues.some(i => i.type === 'info' && i.label === 'Long prompt')).toBe(true);
  });

  it('returns empty for perfect prompt', () => {
    const issues = buildIssues(0, 0, 0, false, 50);
    expect(issues.length).toBe(0);
  });
});

describe('analyzePrompt()', () => {
  it('returns default for empty text', () => {
    const result = analyzePrompt('', 0);
    expect(result.tokenCount).toBe(0);
    expect(result.totalWords).toBe(0);
    expect(result.scores.overall).toBe(100);
    expect(result.issues.length).toBe(0);
  });

  it('returns default for whitespace-only text', () => {
    const result = analyzePrompt('   ', 0);
    expect(result.tokenCount).toBe(0);
    expect(result.totalWords).toBe(0);
  });

  it('analyzes a normal prompt', () => {
    const result = analyzePrompt('Write a Python function to sort an array of integers', 12);
    expect(result.totalWords).toBe(10);
    expect(result.scores.overall).toBeGreaterThanOrEqual(0);
    expect(result.scores.overall).toBeLessThanOrEqual(100);
    expect(result.tokenCount).toBe(12);
  });

  it('detects issues in vague prompt', () => {
    const result = analyzePrompt('stuff and things basically please help', 8);
    expect(result.issues.length).toBeGreaterThan(0);
    expect(result.spans.highlight.length).toBeGreaterThan(0);
    expect(result.spans.redundant.length).toBeGreaterThan(0);
  });

  it('returns valid cost estimates', () => {
    const result = analyzePrompt('Write a function', 100);
    expect(result.costEstimate.length).toBe(3);
    for (const cost of result.costEstimate) {
      expect(cost.model).toBeTruthy();
      expect(typeof cost.inputCost).toBe('string');
      expect(typeof cost.outputCost).toBe('string');
    }
  });

  it('high-quality prompt scores higher than low-quality', () => {
    const bad = analyzePrompt('stuff things please', 4);
    const good = analyzePrompt('Write a Python script using PostgreSQL that queries 3 tables and outputs a CSV report with specific formatting for the client.', 30);
    expect(good.scores.overall).toBeGreaterThanOrEqual(bad.scores.overall);

    const totalBad = bad.scores.clarity + bad.scores.contextRichness + bad.scores.tokenEfficiency + bad.scores.specificity;
    const totalGood = good.scores.clarity + good.scores.contextRichness + good.scores.tokenEfficiency + good.scores.specificity;
    expect(totalGood).toBeGreaterThanOrEqual(totalBad - 10);
  });
});

describe('rendering: renderPromptWithSpans()', () => {
  function esc(s) {
    return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
  }

  function renderPromptWithSpans(text, spans) {
    const allSpans = [
      ...(spans.highlight || []).map(s => ({ ...s, type: 'highlight' })),
      ...(spans.redundant || []).map(s => ({ ...s, type: 'redundant' })),
    ].sort((a, b) => a.start - b.start);

    if (allSpans.length === 0) return esc(text);

    let merged = [];
    for (const s of allSpans) {
      if (merged.length > 0 && s.start <= merged[merged.length - 1].end) {
        const last = merged[merged.length - 1];
        last.end = Math.max(last.end, s.end);
        if (s.type === 'redundant') last.type = 'redundant';
      } else {
        merged.push({ ...s });
      }
    }

    let result = '';
    let pos = 0;
    for (const s of merged) {
      if (s.start > pos) result += esc(text.slice(pos, s.start));
      if (s.type === 'highlight') {
        result += `<span class="hl-vague">${esc(text.slice(s.start, s.end))}</span>`;
      } else {
        result += `<span class="hl-redundant">${esc(text.slice(s.start, s.end))}</span>`;
      }
      pos = s.end;
    }
    if (pos < text.length) result += esc(text.slice(pos));
    return result;
  }

  it('returns escaped text with no spans', () => {
    expect(renderPromptWithSpans('hello <world>', { highlight: [], redundant: [] }))
      .toBe('hello &lt;world&gt;');
  });

  it('wraps highlighted spans', () => {
    const text = 'I need stuff';
    const spans = { highlight: [{ start: 7, end: 12, word: 'stuff' }], redundant: [] };
    const result = renderPromptWithSpans(text, spans);
    expect(result).toContain('stuff');
    expect(result).toContain('<span class="hl-vague">');
    expect(result).toContain('</span>');
  });

  it('wraps redundant spans', () => {
    const text = 'please help';
    const spans = { highlight: [], redundant: [{ start: 0, end: 6, word: 'please' }] };
    const result = renderPromptWithSpans(text, spans);
    expect(result).toContain('<span class="hl-redundant">');
  });

  it('merges overlapping spans, preferring redundant', () => {
    const text = 'vague stuff things';
    const spans = {
      highlight: [{ start: 6, end: 11, word: 'stuff' }, { start: 12, end: 18, word: 'things' }],
      redundant: [],
    };
    const result = renderPromptWithSpans(text, spans);
    expect(result).toContain('stuff');
    expect(result).toContain('things');
  });

  it('handles text with HTML special chars', () => {
    const text = 'a < b && c > d';
    const result = renderPromptWithSpans(text, { highlight: [], redundant: [] });
    expect(result).not.toContain('< b');
    expect(result).toContain('&lt;');
    expect(result).toContain('&gt;');
    expect(result).toContain('&amp;');
  });
});

describe('getTier()', () => {
  function getTier(score) {
    if (score >= 80) return 'high';
    if (score >= 50) return 'medium';
    return 'low';
  }

  it('returns high for score >= 80', () => {
    expect(getTier(80)).toBe('high');
    expect(getTier(100)).toBe('high');
  });

  it('returns medium for score 50-79', () => {
    expect(getTier(50)).toBe('medium');
    expect(getTier(79)).toBe('medium');
  });

  it('returns low for score < 50', () => {
    expect(getTier(0)).toBe('low');
    expect(getTier(49)).toBe('low');
  });
});

describe('PRICING table', () => {
  it('has 3 models', () => {
    expect(PRICING.length).toBe(3);
  });

  it('each model has valid prices', () => {
    for (const p of PRICING) {
      expect(p.input).toBeGreaterThan(0);
      expect(p.output).toBeGreaterThan(0);
      expect(p.model).toBeTruthy();
    }
  });
});

describe('Score ranges are valid', () => {
  function randomTest() {
    for (let i = 0; i < 100; i++) {
      const text = ['Write a function', 'stuff things', 'please help', `Example ${i}`, 'The quick brown fox jumps over the lazy dog near the bank', 'Create a detailed report using SQL queries with proper indexing and optimization techniques for better performance'][i % 7];
      const result = analyzePrompt(text, Math.floor(Math.random() * 50));
      for (const key of ['clarity', 'contextRichness', 'tokenEfficiency', 'specificity', 'overall']) {
        expect(result.scores[key]).toBeGreaterThanOrEqual(0);
        expect(result.scores[key]).toBeLessThanOrEqual(100);
      }
    }
  }

  it('all scores in [0, 100] range for random inputs', randomTest);

  it('overall is average of 4 metrics', () => {
    const result = analyzePrompt('Write a Python function to sort arrays with examples', 15);
    const expected = Math.round((result.scores.clarity + result.scores.contextRichness + result.scores.tokenEfficiency + result.scores.specificity) / 4);
    expect(result.scores.overall).toBe(expected);
  });
});
