// Wraps gpt-tokenizer cl100k_base encoding for Claude model token counting.
// Falls back to approximate counting if the library hasn't loaded.

function countTokens(text) {
  if (!text) return 0;
  try {
    const api = globalThis.GPTTokenizer_cl100k_base;
    if (api && typeof api.countTokens === 'function') {
      return api.countTokens(text);
    }
  } catch (e) {
    console.warn('[RED] tokenizer error, using fallback:', e);
  }
  return Math.ceil(text.length / 4);
}

window.__RED = window.__RED || {};
window.__RED.countTokens = countTokens;
