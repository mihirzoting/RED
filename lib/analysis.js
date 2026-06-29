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
  if (/for example|e\.g\.|i\.e\.|such as|like\s+.*?\s+(when|if|where)/i.test(text)) bonus += 10;
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
    issues.push({ type: 'warning', label: 'Missing context', detail: 'Prompt may be underspecified — clarify what you\'re asking about' });
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

window.__RED = window.__RED || {};
window.__RED.analyzePrompt = analyzePrompt;
window.__RED.PRICING = PRICING;
