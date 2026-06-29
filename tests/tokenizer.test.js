import { describe, it, expect, beforeAll } from 'vitest';
import fs from 'fs';
import path from 'path';

describe('countTokens()', () => {
  let countTokens;

  beforeAll(async () => {
    // Load the vendored gpt-tokenizer
    const code = fs.readFileSync(path.resolve('lib/vendor/gpt-tokenizer.js'), 'utf-8');
    // The tokenizer sets globalThis.GPTTokenizer_cl100k_base
    const fn = new Function(code);
    fn();

    // Define the countTokens function as in tokenizer.js
    countTokens = function countTokens(text) {
      if (!text) return 0;
      try {
        const api = globalThis.GPTTokenizer_cl100k_base;
        if (api && typeof api.countTokens === 'function') {
          return api.countTokens(text);
        }
      } catch (e) {
        // fallback
      }
      return Math.ceil(text.length / 4);
    };
  });

  it('returns 0 for null/undefined/empty', () => {
    expect(countTokens(null)).toBe(0);
    expect(countTokens(undefined)).toBe(0);
    expect(countTokens('')).toBe(0);
  });

  it('returns positive count for text', () => {
    const count = countTokens('Hello world');
    expect(count).toBeGreaterThan(0);
  });

  it('counts English text reasonably', () => {
    const text = 'Write a Python function to sort an array of integers using quicksort';
    const count = countTokens(text);
    expect(count).toBeGreaterThan(5);
    expect(count).toBeLessThan(text.length);
  });

  it('counts long text', () => {
    const text = Array(100).fill('token').join(' ');
    const count = countTokens(text);
    expect(count).toBeGreaterThan(50);
  });

  it('API is loaded and functional', () => {
    expect(globalThis.GPTTokenizer_cl100k_base).toBeTruthy();
    expect(typeof globalThis.GPTTokenizer_cl100k_base.countTokens).toBe('function');
  });

  it('different texts produce different counts', () => {
    const short = countTokens('Hello');
    const long = countTokens('Hello world this is a longer text');
    expect(long).toBeGreaterThan(short);
  });
});

describe('fallback countTokens (if GPTTokenizer not available)', () => {
  let originalApi;

  beforeAll(() => {
    originalApi = globalThis.GPTTokenizer_cl100k_base;
  });

  afterAll(() => {
    globalThis.GPTTokenizer_cl100k_base = originalApi;
  });

  function fallbackCountTokens(text) {
    if (!text) return 0;
    try {
      const api = globalThis.GPTTokenizer_cl100k_base;
      if (api && typeof api.countTokens === 'function') {
        return api.countTokens(text);
      }
    } catch (e) { }
    return Math.ceil(text.length / 4);
  }

  it('falls back to length/4 approximation', () => {
    delete globalThis.GPTTokenizer_cl100k_base;
    const count = fallbackCountTokens('Hello world');
    expect(count).toBe(Math.ceil('Hello world'.length / 4));
  });

  it('fallback returns 0 for empty', () => {
    delete globalThis.GPTTokenizer_cl100k_base;
    expect(fallbackCountTokens('')).toBe(0);
  });
});
