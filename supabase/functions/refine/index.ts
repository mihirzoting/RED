import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

// ─── Environment ───────────────────────────────────────────────────────────
const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!;
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
const GROQ_API_KEY = Deno.env.get('GROQ_API_KEY')!;
const GEMINI_API_KEY = Deno.env.get('GEMINI_API_KEY')!;
const OPENROUTER_API_KEY = Deno.env.get('OPENROUTER_API_KEY')!;

// ─── Constants ─────────────────────────────────────────────────────────────
const QUOTA_LIMITS = { free: 10, premium: 300 };
const PROVIDER_TIMEOUT_MS = 4000;
const RE_REFINE_LIMIT_FREE = 2;
const GROQ_MODEL = 'llama-3.3-70b-versatile';
const GEMINI_MODEL = 'gemini-2.0-flash';
const OPENROUTER_MODEL = 'openai/gpt-4o-mini';
const DEEP_GROQ_MODEL = 'llama-3.3-70b-specdec';
const DEEP_GEMINI_MODEL = 'gemini-1.5-pro';
const DEEP_OPENROUTER_MODEL = 'openai/gpt-4o';
const SYSTEM_PROMPT = `You are a prompt engineer. Rewrite the user's prompt to be clearer, more specific, and more effective while keeping the original intent. Output ONLY the rewritten prompt.`;
const STYLE_PROMPTS = {
  default: SYSTEM_PROMPT,
  concise: `You are a prompt engineer. Rewrite the user's prompt to be as concise and direct as possible while preserving intent. Remove all fluff, unnecessary words, and redundant phrasing. Output ONLY the rewritten prompt.`,
  detailed: `You are a prompt engineer. Rewrite the user's prompt to be extremely detailed and comprehensive. Add relevant context, specify edge cases, and structure it for maximum clarity and completeness. Output ONLY the rewritten prompt.`,
  'code-focused': `You are a prompt engineer. Rewrite the user's prompt for a code or technical task. Use precise technical terminology, specify input/output formats, constraints, and edge cases. Output ONLY the rewritten prompt.`,
};
const CORS_HEADERS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Allow-Headers': 'authorization, content-type',
};

// ─── Helpers ───────────────────────────────────────────────────────────────
async function sha256(input) {
  const hash = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(input));
  return Array.from(new Uint8Array(hash)).map(b => b.toString(16).padStart(2, '0')).join('');
}

async function getAuthUser(authHeader) {
  if (!authHeader) return null;
  const token = authHeader.replace('Bearer ', '');
  const sb = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
    auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
    global: { headers: { Authorization: `Bearer ${token}` } },
  });
  const { data: { user }, error } = await sb.auth.getUser(token);
  return error || !user ? null : user;
}

async function checkQuota(sb, userId, promptHash) {
  const { data: user } = await sb.from('users').select('*').eq('id', userId).single();
  if (!user) return { allowed: false, reason: 'User not found' };

  const userType = user.user_type || 'free';
  const today = new Date().toISOString().slice(0, 10);
  const limit = QUOTA_LIMITS[userType] || 10;

  const { data: agg } = await sb.from('usage_log').select('quota_consumed').eq('user_id', userId).eq('date', today);
  const todayConsumed = (agg || []).reduce((s, r) => s + (r.quota_consumed || 0), 0);
  if (todayConsumed >= limit) {
    return { allowed: false, reason: 'daily_limit', userType, consumed: todayConsumed, limit };
  }

  const { data: promptLog } = await sb.from('usage_log')
    .select('*').eq('user_id', userId).eq('prompt_hash', promptHash).eq('date', today).maybeSingle();

  const refineCount = promptLog?.refine_count || 0;
  if (promptLog && userType === 'free' && refineCount >= RE_REFINE_LIMIT_FREE) {
    return { allowed: false, reason: 're_refine_limit', userType, consumed: todayConsumed, limit };
  }

  return { allowed: true, userType, refineCount, todayConsumed, limit, userId };
}

async function updateLog(sb, { userId, promptHash, refinedText, userType, originalPrompt, tokenCount, score }) {
  const today = new Date().toISOString().slice(0, 10);
  const { data: existing } = await sb.from('usage_log')
    .select('*').eq('user_id', userId).eq('prompt_hash', promptHash).eq('date', today).maybeSingle();

  if (existing) {
    await sb.from('usage_log').update({ refine_count: existing.refine_count + 1 }).eq('id', existing.id);
  } else {
    await sb.from('usage_log').insert({ user_id: userId, prompt_hash: promptHash, refine_count: 0, quota_consumed: 1, date: today });
  }

  if (userType === 'premium') {
    const { error: insertError } = await sb.from('refine_history').insert({
      user_id: userId,
      original_prompt: originalPrompt || '',
      refined_prompt: refinedText,
      token_count_before: tokenCount || 0,
      token_count_after: 0,
      score: score || 0,
    });
    if (insertError) console.error('[RED] Failed to insert refine_history:', insertError);
  }
}

// ─── SSE → text parsing ────────────────────────────────────────────────────
function sseParser(type) {
  let buf = '';
  let fullText = '';

  function extract(line) {
    const json = line.replace(/^data:\s*/, '').trim();
    if (!json || json === '[DONE]') return '';
    try {
      const p = JSON.parse(json);
      if (type === 'gemini') {
        return p.candidates?.[0]?.content?.parts?.map(p => p.text || '').join('') || '';
      }
      return p.choices?.[0]?.delta?.content || '';
    } catch { return ''; }
  }

  return {
    write(chunk) {
      buf += new TextDecoder().decode(chunk, { stream: true });
      const parts = [];
      const lines = buf.split('\n');
      buf = lines.pop() || '';
      for (const line of lines) {
        if (line.startsWith('data: ')) {
          const c = extract(line);
          if (c) { parts.push(c); fullText += c; }
        }
      }
      return parts.length ? new TextEncoder().encode(parts.join('')) : null;
    },
    flush() {
      const l = buf.trim();
      if (l.startsWith('data: ')) {
        const c = extract(l);
        if (c) { fullText += c; return new TextEncoder().encode(c); }
      }
      return null;
    },
    text() { return fullText; },
  };
}

// ─── Providers ─────────────────────────────────────────────────────────────
async function tryProvider(name, url, opts) {
  const ac = new AbortController();
  const timer = setTimeout(() => ac.abort(), PROVIDER_TIMEOUT_MS);
  try {
    const res = await fetch(url, { ...opts, signal: ac.signal });
    if (!res.ok) throw new Error(`${name} ${res.status}`);
    return { body: res.body, cleanup: () => clearTimeout(timer) };
  } catch (e) {
    clearTimeout(timer);
    throw e;
  }
}

const PROVIDERS = [
  {
    name: 'groq',
    call: (messages) => tryProvider('groq', 'https://api.groq.com/openai/v1/chat/completions', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${GROQ_API_KEY}` },
      body: JSON.stringify({ model: GROQ_MODEL, messages, stream: true }),
    }),
  },
  {
    name: 'gemini',
    call: (messages) => {
      const sys = messages.find(m => m.role === 'system')?.content || '';
      const user = messages.find(m => m.role === 'user')?.content || '';
      return tryProvider('gemini',
        `https://generativelanguage.googleapis.com/v1beta/models/${GEMINI_MODEL}:streamGenerateContent?alt=sse&key=${GEMINI_API_KEY}`,
        { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ contents: [{ parts: [{ text: `${sys}\n\n${user}` }] }] }) },
      );
    },
  },
  {
    name: 'openrouter',
    call: (messages) => tryProvider('openrouter', 'https://openrouter.ai/api/v1/chat/completions', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${OPENROUTER_API_KEY}`, 'HTTP-Referer': 'https://github.com/red-extension' },
      body: JSON.stringify({ model: OPENROUTER_MODEL, messages, stream: true }),
    }),
  },
];

// ─── Premium: priority routing ──────────────────────────────────────────────
async function raceProviders(messages, isDeep) {
  const models = {
    groq: isDeep ? DEEP_GROQ_MODEL : GROQ_MODEL,
    gemini: isDeep ? DEEP_GEMINI_MODEL : GEMINI_MODEL,
  };
  const ac1 = new AbortController();
  const ac2 = new AbortController();

  async function runGroq() {
    const res = await fetch('https://api.groq.com/openai/v1/chat/completions', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${GROQ_API_KEY}` },
      body: JSON.stringify({ model: models.groq, messages, stream: true }),
      signal: ac1.signal,
    });
    if (!res.ok) throw new Error(`groq ${res.status}`);
    ac2.abort();
    return { body: res.body, name: 'groq' };
  }

  async function runGemini() {
    const sys = messages.find(m => m.role === 'system')?.content || '';
    const user = messages.find(m => m.role === 'user')?.content || '';
    const url = `https://generativelanguage.googleapis.com/v1beta/models/${models.gemini}:streamGenerateContent?alt=sse&key=${GEMINI_API_KEY}`;
    const res = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ contents: [{ parts: [{ text: `${sys}\n\n${user}` }] }] }),
      signal: ac2.signal,
    });
    if (!res.ok) throw new Error(`gemini ${res.status}`);
    ac1.abort();
    return { body: res.body, name: 'gemini' };
  }

  return Promise.any([runGroq(), runGemini()]);
}

// ─── Main ──────────────────────────────────────────────────────────────────
serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response(null, { status: 204, headers: CORS_HEADERS });
  if (req.method !== 'POST') return new Response(JSON.stringify({ error: 'Method not allowed' }), { status: 405, headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' } });

  const user = await getAuthUser(req.headers.get('authorization') || '');
  if (!user) return new Response(JSON.stringify({ error: 'Unauthorized' }), { status: 401, headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' } });

  let body;
  try { body = await req.json(); } catch {
    return new Response(JSON.stringify({ error: 'Invalid JSON' }), { status: 400, headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' } });
  }
  const { prompt, token_count, original_prompt, mode, style, score } = body;
  if (!prompt || typeof prompt !== 'string') {
    return new Response(JSON.stringify({ error: 'Missing prompt' }), { status: 400, headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' } });
  }

  const promptHash = await sha256(prompt.trim().toLowerCase());
  const sb = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, { auth: { persistSession: false } });

  const quota = await checkQuota(sb, user.id, promptHash);
  if (!quota.allowed) {
    return new Response(JSON.stringify({
      error: 'quota_exceeded', reason: quota.reason,
      message: quota.reason === 'daily_limit'
        ? `You've used all ${quota.consumed} free refines today — upgrade to RED Premium for 300/day.`
        : `You've used the ${RE_REFINE_LIMIT_FREE} free re-refines for this prompt.`,
    }), { status: 429, headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' } });
  }

  const activeStyle = (quota.userType === 'premium' && style && STYLE_PROMPTS[style]) ? style : 'default';
  const systemPrompt = STYLE_PROMPTS[activeStyle];
  const messages = [{ role: 'system', content: systemPrompt }, { role: 'user', content: prompt }];

  // try providers — priority routing for premium, sequential for free
  let providerResult = null;
  let providerName = '';

  if (quota.userType === 'premium') {
    const isDeep = mode === 'deep';
    try {
      const raced = await raceProviders(messages, isDeep);
      providerResult = raced;
      providerName = raced.name;
    } catch {
      try {
        const model = isDeep ? DEEP_OPENROUTER_MODEL : OPENROUTER_MODEL;
        const bodyData = { model, messages, stream: true };
        providerResult = await tryProvider('openrouter', 'https://openrouter.ai/api/v1/chat/completions', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${OPENROUTER_API_KEY}`, 'HTTP-Referer': 'https://github.com/red-extension' },
          body: JSON.stringify(bodyData),
        });
        providerName = 'openrouter';
      } catch (e) { console.warn('[RED] All providers failed:', e.message); }
    }
  } else {
    for (const p of PROVIDERS) {
      try {
        providerResult = await p.call(messages);
        providerName = p.name;
        break;
      } catch (e) { console.warn(`[RED] ${p.name} failed:`, e.message); }
    }
  }

  if (!providerResult) {
    return new Response(JSON.stringify({ error: 'All LLM providers failed — please try again.' }), { status: 503, headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' } });
  }

  // Stream the response
  const parser = sseParser(providerName);
  const { readable, writable } = new TransformStream();
  const writer = writable.getWriter();

  (async () => {
    try {
      const reader = providerResult.body.getReader();
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        const content = parser.write(value);
        if (content) await writer.write(content);
      }
      const flushed = parser.flush();
      if (flushed) await writer.write(flushed);
    } catch (e) {
      console.warn('[RED] Stream error:', e.message);
    } finally {
      providerResult.cleanup();
      await updateLog(sb, {
        userId: user.id,
        promptHash,
        refinedText: parser.text(),
        userType: quota.userType,
        originalPrompt: original_prompt || prompt,
        tokenCount: token_count || 0,
        score: score || 0,
      }).catch(e => console.error('[RED] updateLog failed:', e));
      await writer.close().catch(() => {});
    }
  })();

  return new Response(readable, {
    headers: { ...CORS_HEADERS, 'Content-Type': 'text/plain', 'Cache-Control': 'no-cache' },
  });
});
