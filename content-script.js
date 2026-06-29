console.log('[RED] content script loaded');

let debounceTimer = null;
const EDGE_FN_URL = 'https://votjuphsggdecoawqeqc.supabase.co/functions/v1/refine';
const SUPABASE_URL = 'https://votjuphsggdecoawqeqc.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InZvdGp1cGhzZ2dkZWNvYXdxZXFjIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODE4NTE3OTQsImV4cCI6MjA5NzQyNzc5NH0.fZW6kk62ka7glAPbJiNrqrh2UU84v3RNuR_e5w04mKE';

let currentPromptText = '';

async function saveAnalysisToSupabase(text, tokens, analysis) {
  if (!text || text.trim().split(/\s+/).length < 3) return;
  var result = await chrome.storage.local.get(['supabase_user', 'user_type']);
  if (result.user_type !== 'premium') return;
  if (!result.supabase_user) return;
  var token = await window.__RED.getValidToken();
  if (!token) return;
  try {
    await fetch(SUPABASE_URL + '/rest/v1/refine_history', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: 'Bearer ' + token,
        apikey: SUPABASE_ANON_KEY,
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

chrome.storage.local.get('supabase_token', ({ supabase_token }) => {
  if (supabase_token) {
    console.log('[RED] Session token found on startup');
    window.__RED.proactiveRefresh().then(async () => {
      var r = await chrome.storage.local.get(['supabase_user', 'supabase_token']);
      if (r.supabase_user && r.supabase_token) {
        try {
          var res = await fetch(SUPABASE_URL + '/rest/v1/users?id=eq.' + r.supabase_user.id + '&select=user_type', {
            headers: { apikey: SUPABASE_ANON_KEY, Authorization: 'Bearer ' + r.supabase_token },
          });
          if (res.ok) {
            var rows = await res.json();
            var userType = rows && rows[0] ? rows[0].user_type : 'free';
            chrome.storage.local.set({ user_type: userType });
          }
        } catch (e) { /* ignore */ }
      }
    });
  }
});

chrome.storage.onChanged.addListener((changes) => {
  if (changes.supabase_token) {
    var isLoggedIn = !!changes.supabase_token.newValue;
    if (window.__RED.setAuthState) window.__RED.setAuthState(isLoggedIn);
  }
});

window.__RED.watchInput(
  function onInput(e) {
    const text = e.target.textContent || '';
    currentPromptText = text;
    if (window.__RED.updatePromptPreview) window.__RED.updatePromptPreview(text);
    clearTimeout(debounceTimer);
    debounceTimer = setTimeout(() => {
      const tokens = window.__RED.countTokens(text);
      const analysis = window.__RED.analyzePrompt(text, tokens);
      analysis._rawText = text;
      window.__RED._lastAnalysis = analysis;
      window.__RED.updateAnalysis(analysis);
      const wordCount = text.trim().split(/\s+/).length;
      if (wordCount >= 3 && tokens > 0 && window.__RED.saveToFreeHistory) {
        const issues = (analysis.issues || []).map(i => i.label);
        window.__RED.saveToFreeHistory({
          prompt: text,
          score: analysis.scores ? analysis.scores.overall : 0,
          tokens: tokens,
          refined: false,
          issues: issues,
        });
      }
      saveAnalysisToSupabase(text, tokens, analysis);
    }, 500);
  },
  function onConnect(el) {
    console.log('[RED] input box connected:', el);
    if (!document.getElementById('red-host')) {
      window.__RED.injectPanel();
      setTimeout(() => {
        if (window.__RED.initViewNav) window.__RED.initViewNav();
        chrome.storage.local.get(['supabase_token'], ({ supabase_token }) => {
          if (window.__RED.setAuthState) window.__RED.setAuthState(!!supabase_token);
        });
      }, 50);
    }

    const text = el.textContent || '';
    currentPromptText = text;

    if (window.__RED.updatePromptPreview) window.__RED.updatePromptPreview(text);

    window.__RED.showRefineResult('', '', false);

    clearTimeout(debounceTimer);
    if (text) {
      debounceTimer = setTimeout(() => {
        const tokens = window.__RED.countTokens(text);
        const analysis = window.__RED.analyzePrompt(text, tokens);
        analysis._rawText = text;
        window.__RED._lastAnalysis = analysis;
        window.__RED.updateAnalysis(analysis);
        const wordCount = text.trim().split(/\s+/).length;
        if (wordCount >= 3 && tokens > 0 && window.__RED.saveToFreeHistory) {
          const issues = (analysis.issues || []).map(i => i.label);
          window.__RED.saveToFreeHistory({
            prompt: text,
            score: analysis.scores ? analysis.scores.overall : 0,
            tokens: tokens,
            refined: false,
            issues: issues,
          });
        }
        saveAnalysisToSupabase(text, tokens, analysis);
      }, 500);
    } else {
      const empty = { tokenCount: 0, totalWords: 0, scores: { clarity: 100, contextRichness: 100, tokenEfficiency: 100, specificity: 100, overall: 100 }, costEstimate: [], issues: [], spans: { highlight: [], redundant: [] } };
      window.__RED._lastAnalysis = empty;
      window.__RED.updateAnalysis(empty);
    }
  },
  function onInputTimeout() {
    console.warn('[RED] Input not found after 10s');
    var err = document.createElement('div');
    err.id = 'red-timeout-error';
    err.style.cssText = 'position:fixed;top:12px;right:12px;z-index:999999;background:#E24B4A;color:#FFF;padding:10px 16px;border-radius:8px;font-size:12px;font-family:system-ui,sans-serif;box-shadow:0 4px 12px rgba(0,0,0,0.15);max-width:300px;line-height:1.4;pointer-events:none;';
    err.textContent = 'RED: Claude input box not detected. Try refreshing the page.';
    document.body.appendChild(err);
    setTimeout(function () {
      var e = document.getElementById('red-timeout-error');
      if (e) e.remove();
    }, 15000);
  }
);

async function streamRefineResponse(response, prompt) {
  window.__RED.showRefineResult(prompt, '', true);
  const reader = response.body.getReader();
  const decoder = new TextDecoder();
  let refined = '';
  let streamError = false;
  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      const chunk = decoder.decode(value, { stream: true });
      refined += chunk;
      window.__RED.appendRefineChunk(chunk);
    }
  } catch (e) {
    console.error('[RED] Stream read error:', e);
    streamError = true;
  }
  if (streamError && !refined) {
    window.__RED.showRefineError('Connection lost during refinement. Please try again.', false);
    return null;
  }
  window.__RED.showRefineResult(prompt, refined, false);
  return refined;
}

function saveRefineToHistory(refined) {
  if (!window.__RED.saveToFreeHistory || !currentPromptText.trim()) return;
  var last = window.__RED._lastAnalysis;
  var score = last && last.scores ? last.scores.overall || 0 : 0;
  var tokens = window.__RED.countTokens(currentPromptText);
  var newScore = Math.min(score + 15, 100);
  if (currentPromptText.trim().split(/\s+/).length >= 3 && tokens > 0) {
    window.__RED.saveToFreeHistory({
      prompt: currentPromptText,
      score: score,
      tokens: tokens,
      refined: true,
      refinedScore: newScore - score,
      issues: last && last.issues ? last.issues.map(function (i) { return i.label; }) : [],
    });
  }
}

function buildRefineBody(prompt) {
  var lastAnalysis = window.__RED._lastAnalysis || {};
  var options = window.__RED.getRefineOptions ? window.__RED.getRefineOptions() : { mode: 'normal', style: 'default' };
  return {
    prompt: prompt,
    original_prompt: prompt,
    token_count: lastAnalysis.tokenCount || 0,
    mode: options.mode,
    style: options.style,
    score: (lastAnalysis.scores && lastAnalysis.scores.overall) || 0,
  };
}

async function refinePrompt() {
  const prompt = currentPromptText;
  if (!prompt || !prompt.trim()) return;

  window.__RED.setRefineLoading(true);
  window.__RED.showRefineError('', false);

  try {
    var supabase_token = await window.__RED.getValidToken();
    const body = buildRefineBody(prompt);

    const res = await fetch(EDGE_FN_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${supabase_token}`,
      },
      body: JSON.stringify(body),
    });

    if (!res.ok) {
      const err = await res.json().catch(() => ({}));

      if (res.status === 401) {
        const newToken = await window.__RED.refreshAccessToken();
        if (newToken) {
          const retryRes = await fetch(EDGE_FN_URL, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              'Authorization': `Bearer ${newToken}`,
            },
            body: JSON.stringify(body),
          });
          if (retryRes.ok) {
            var refined = await streamRefineResponse(retryRes, prompt);
            if (refined !== null) saveRefineToHistory(refined);
            return;
          }
        }
        window.__RED.showRefineError('Session expired. Please log in again.', false);
        return;
      }

      if (res.status === 429) {
        window.__RED.showRefineError(err.message || 'Quota exceeded.', true);
      } else {
        window.__RED.showRefineError(err.error || 'Refine failed. Please try again.', false);
      }
      return;
    }

    var refined = await streamRefineResponse(res, prompt);
    if (refined !== null) saveRefineToHistory(refined);
  } catch (e) {
    console.error('[RED] Refine error:', e);
    window.__RED.showRefineError('Network error. Check your connection and try again.', false);
  } finally {
    window.__RED.setRefineLoading(false);
  }
}

window.__RED.refinePrompt = refinePrompt;
