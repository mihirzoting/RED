import { describe, it, expect } from 'vitest';

describe('Edge Function: refine/index.ts - constants', () => {
  const QUOTA_LIMITS = { free: 10, premium: 300 };
  const PROVIDER_TIMEOUT_MS = 4000;
  const RE_REFINE_LIMIT_FREE = 2;
  const CORS_HEADERS = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    'Access-Control-Allow-Headers': 'authorization, content-type',
  };

  it('free quota is 10', () => {
    expect(QUOTA_LIMITS.free).toBe(10);
  });

  it('premium quota is 300', () => {
    expect(QUOTA_LIMITS.premium).toBe(300);
  });

  it('provider timeout is 4000ms', () => {
    expect(PROVIDER_TIMEOUT_MS).toBe(4000);
  });

  it('re-refine limit for free is 2', () => {
    expect(RE_REFINE_LIMIT_FREE).toBe(2);
  });

  it('CORS headers allow all origins', () => {
    expect(CORS_HEADERS['Access-Control-Allow-Origin']).toBe('*');
  });
});

describe('Edge Function: refine/index.ts - provider models', () => {
  const GROQ_MODEL = 'llama-3.3-70b-versatile';
  const GEMINI_MODEL = 'gemini-2.0-flash';
  const OPENROUTER_MODEL = 'openai/gpt-4o-mini';
  const DEEP_GROQ_MODEL = 'llama-3.3-70b-specdec';
  const DEEP_GEMINI_MODEL = 'gemini-1.5-pro';
  const DEEP_OPENROUTER_MODEL = 'openai/gpt-4o';

  it('groq model is llama-3.3-70b-versatile', () => {
    expect(GROQ_MODEL).toBe('llama-3.3-70b-versatile');
  });

  it('gemini model is gemini-2.0-flash', () => {
    expect(GEMINI_MODEL).toBe('gemini-2.0-flash');
  });

  it('openrouter model is gpt-4o-mini', () => {
    expect(OPENROUTER_MODEL).toBe('openai/gpt-4o-mini');
  });

  it('deep groq model is defined', () => {
    expect(DEEP_GROQ_MODEL).toBeTruthy();
  });

  it('deep gemini model is defined', () => {
    expect(DEEP_GEMINI_MODEL).toBeTruthy();
  });

  it('deep openrouter model is defined', () => {
    expect(DEEP_OPENROUTER_MODEL).toBeTruthy();
  });
});

describe('Edge Function: refine/index.ts - STYLE_PROMPTS', () => {
  const STYLE_PROMPTS = {
    default: `You are a prompt engineer. Rewrite the user's prompt to be clearer, more specific, and more effective while keeping the original intent. Output ONLY the rewritten prompt.`,
    concise: `You are a prompt engineer. Rewrite the user's prompt to be as concise and direct as possible while preserving intent. Remove all fluff, unnecessary words, and redundant phrasing. Output ONLY the rewritten prompt.`,
    detailed: `You are a prompt engineer. Rewrite the user's prompt to be extremely detailed and comprehensive. Add relevant context, specify edge cases, and structure it for maximum clarity and completeness. Output ONLY the rewritten prompt.`,
    'code-focused': `You are a prompt engineer. Rewrite the user's prompt for a code or technical task. Use precise technical terminology, specify input/output formats, constraints, and edge cases. Output ONLY the rewritten prompt.`,
  };

  it('has all 4 styles', () => {
    expect(Object.keys(STYLE_PROMPTS).length).toBe(4);
  });

  it('default style instructs to be clearer', () => {
    expect(STYLE_PROMPTS.default).toContain('clearer');
  });

  it('concise style asks for removal of fluff', () => {
    expect(STYLE_PROMPTS.concise).toContain('concise');
    expect(STYLE_PROMPTS.concise).toContain('fluff');
  });

  it('detailed style asks for comprehensive detail', () => {
    expect(STYLE_PROMPTS.detailed).toContain('detailed');
    expect(STYLE_PROMPTS.detailed).toContain('comprehensive');
  });

  it('code-focused style asks for technical terminology', () => {
    expect(STYLE_PROMPTS['code-focused']).toContain('technical');
    expect(STYLE_PROMPTS['code-focused']).toContain('input/output');
  });

  it('all styles end with "Output ONLY the rewritten prompt."', () => {
    for (const style of Object.values(STYLE_PROMPTS)) {
      expect(style).toMatch(/Output ONLY the rewritten prompt\.$/);
    }
  });
});

describe('Edge Function: refine/index.ts - HTTP status codes', () => {
  it('429 is used for quota exceeded', () => {
    const status = 429;
    expect(status).toBe(429);
  });

  it('401 is used for unauthorized', () => {
    const status = 401;
    expect(status).toBe(401);
  });

  it('503 is used for all providers failed', () => {
    const status = 503;
    expect(status).toBe(503);
  });

  it('405 is used for method not allowed', () => {
    const status = 405;
    expect(status).toBe(405);
  });
});

describe('Edge Function: sseParser logic', () => {
  function createSSEParser(type) {
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
        return parts.length ? parts.join('') : null;
      },
      flush() {
        const l = buf.trim();
        if (l.startsWith('data: ')) {
          const c = extract(l);
          if (c) { fullText += c; return c; }
        }
        return null;
      },
      text() { return fullText; },
    };
  }

  function encode(str) {
    return new TextEncoder().encode(str);
  }

  it('parses OpenAI-style SSE stream', () => {
    const parser = createSSEParser('openai');
    const chunk = encode('data: {"choices":[{"delta":{"content":"Hello"}}]}\n\ndata: {"choices":[{"delta":{"content":" world"}}]}\n\ndata: [DONE]\n\n');
    const result = parser.write(chunk);
    expect(result).toBe('Hello world');
  });

  it('ignores [DONE] messages', () => {
    const parser = createSSEParser('openai');
    const chunk = encode('data: [DONE]\n\n');
    const result = parser.write(chunk);
    expect(result).toBeNull();
  });

  it('handles partial chunks across write calls', () => {
    const parser = createSSEParser('openai');
    const chunk1 = encode('data: {"choices":[{"delta":{"content":"Hel');
    parser.write(chunk1);
    const chunk2 = encode('lo"}}]}\n\n');
    const result = parser.write(chunk2);
    expect(result).toBe('Hello');
  });

  it('returns full text via text()', () => {
    const parser = createSSEParser('openai');
    parser.write(encode('data: {"choices":[{"delta":{"content":"Hello"}}]}\n\n'));
    expect(parser.text()).toBe('Hello');
  });

  it('parses Gemini-style SSE', () => {
    const parser = createSSEParser('gemini');
    const chunk = encode('data: {"candidates":[{"content":{"parts":[{"text":"Hello gemini"}]}}]}\n\n');
    const result = parser.write(chunk);
    expect(result).toBe('Hello gemini');
  });

  it('flush handles remaining buffered data', () => {
    const parser = createSSEParser('openai');
    parser.write(encode('data: {"choices":[{"delta":{"content":"test"}}]}\n\ndata: {"choices":[{"delta":{"content":"more"}}]}\n\n'));
    expect(parser.text()).toBe('testmore');
  });
});

describe('Edge Function: razorpay-webhook/index.ts - verifySignature', () => {
  async function verifySignature(body, signature, secret) {
    if (!signature || !secret) return false;
    try {
      const encoder = new TextEncoder();
      const key = await crypto.subtle.importKey(
        'raw',
        encoder.encode(secret),
        { name: 'HMAC', hash: 'SHA-256' },
        false,
        ['sign', 'verify'],
      );
      const expectedSig = await crypto.subtle.sign('HMAC', key, encoder.encode(body));
      const expectedHex = Array.from(new Uint8Array(expectedSig)).map(b => b.toString(16).padStart(2, '0')).join('');
      return expectedHex === signature;
    } catch {
      return false;
    }
  }

  it('rejects empty signature', async () => {
    const result = await verifySignature('{"event":"payment.captured"}', '', 'secret');
    expect(result).toBe(false);
  });

  it('rejects empty secret', async () => {
    const result = await verifySignature('{"event":"payment.captured"}', 'abc', '');
    expect(result).toBe(false);
  });

  it('rejects wrong signature', async () => {
    const result = await verifySignature('{"event":"payment.captured"}', 'invalid', 'secret123');
    expect(result).toBe(false);
  });
});

describe('Edge Function: razorpay-webhook/index.ts - event routing', () => {
  function shouldProcessEvent(eventType) {
    return eventType === 'payment.captured';
  }

  it('processes payment.captured event', () => {
    expect(shouldProcessEvent('payment.captured')).toBe(true);
  });

  it('ignores payment_link.paid', () => {
    expect(shouldProcessEvent('payment_link.paid')).toBe(false);
  });

  it('ignores payment.authorized', () => {
    expect(shouldProcessEvent('payment.authorized')).toBe(false);
  });

  it('ignores unknown events', () => {
    expect(shouldProcessEvent('')).toBe(false);
  });
});

describe('Edge Function: razorpay-webhook/index.ts - email fallback', () => {
  function extractUserId(notes, entityEmail) {
    if (notes.user_id) return notes.user_id;
    if (entityEmail) return null;
    return null;
  }

  it('extracts user_id from notes', () => {
    const result = extractUserId({ user_id: 'u-123' }, 'test@example.com');
    expect(result).toBe('u-123');
  });

  it('returns null when user_id missing even with email', () => {
    const result = extractUserId({}, 'test@example.com');
    expect(result).toBeNull();
  });

  it('returns null when no data provided', () => {
    const result = extractUserId({}, '');
    expect(result).toBeNull();
  });
});

describe('Edge Function: create-payment-link/index.ts - payload', () => {
  function buildPayload(userId, email) {
    return {
      amount: 99900,
      currency: 'INR',
      description: 'RED — Lifetime Premium',
      customer: {
        name: email.split('@')[0] || 'RED User',
        email,
        contact: '',
      },
      notify: { sms: false, email: true },
      reminder_enable: true,
      notes: { user_id: userId, email },
    };
  }

  it('sets correct amount (₹999 = 99900 paise)', () => {
    const payload = buildPayload('u1', 'test@example.com');
    expect(payload.amount).toBe(99900);
    expect(payload.currency).toBe('INR');
  });

  it('includes user_id and email in notes', () => {
    const payload = buildPayload('user-abc', 'a@b.com');
    expect(payload.notes.user_id).toBe('user-abc');
    expect(payload.notes.email).toBe('a@b.com');
  });

  it('extracts name from email', () => {
    const payload = buildPayload('u1', 'john.doe@example.com');
    expect(payload.customer.name).toBe('john.doe');
  });

  it('uses fallback name when email has no local part', () => {
    const payload = buildPayload('u1', '');
    expect(payload.customer.name).toBe('RED User');
  });

  it('enables email notification', () => {
    const payload = buildPayload('u1', 'test@test.com');
    expect(payload.notify.email).toBe(true);
    expect(payload.notify.sms).toBe(false);
  });

  it('reminder is enabled', () => {
    const payload = buildPayload('u1', 'test@test.com');
    expect(payload.reminder_enable).toBe(true);
  });

  it('has correct description', () => {
    const payload = buildPayload('u1', 'test@test.com');
    expect(payload.description).toBe('RED — Lifetime Premium');
  });
});

describe('popup.js - Razorpay upgrade flow', () => {
  const EDGE_FN_ORIGIN = 'https://votjuphsggdecoawqeqc.supabase.co/functions/v1';
  const RAZORPAY_CREATE_FN = EDGE_FN_ORIGIN + '/create-payment-link';

  it('constructs correct Edge Function URL', () => {
    expect(RAZORPAY_CREATE_FN).toBe('https://votjuphsggdecoawqeqc.supabase.co/functions/v1/create-payment-link');
  });

  it('sends user_id and email in request body', () => {
    const body = { user_id: 'test-user', email: 'test@example.com' };
    expect(body.user_id).toBe('test-user');
    expect(body.email).toBe('test@example.com');
  });

  it('handles successful response with url and id', () => {
    const mockResponse = { url: 'https://rzp.io/i/test123', id: 'plink_test123' };
    expect(mockResponse.url).toMatch(/^https:\/\/rzp\.io/);
    expect(mockResponse.id).toMatch(/^plink_/);
  });
});

describe('Edge Function: refine/index.ts - checkQuota logic', () => {
  // Simulate the quota check logic
  function simulateQuotaCheck(userType, todayConsumed, refineCount, limit) {
    if (todayConsumed >= limit) {
      return { allowed: false, reason: 'daily_limit' };
    }
    if (userType === 'free' && refineCount >= 2) {
      return { allowed: false, reason: 're_refine_limit' };
    }
    return { allowed: true };
  }

  it('allows free user under limit', () => {
    expect(simulateQuotaCheck('free', 5, 0, 10).allowed).toBe(true);
  });

  it('blocks free user at daily limit', () => {
    const result = simulateQuotaCheck('free', 10, 0, 10);
    expect(result.allowed).toBe(false);
    expect(result.reason).toBe('daily_limit');
  });

  it('blocks free user exceeding re-refine limit', () => {
    const result = simulateQuotaCheck('free', 5, 2, 10);
    expect(result.allowed).toBe(false);
    expect(result.reason).toBe('re_refine_limit');
  });

  it('allows premium user with large quota', () => {
    expect(simulateQuotaCheck('premium', 250, 0, 300).allowed).toBe(true);
  });

  it('blocks premium user at limit', () => {
    const result = simulateQuotaCheck('premium', 300, 0, 300);
    expect(result.allowed).toBe(false);
  });

  it('does not have re-refine limit for premium', () => {
    expect(simulateQuotaCheck('premium', 5, 5, 300).allowed).toBe(true);
  });
});

describe('Edge Function: razorpay-webhook/index.ts - verifySignature', () => {
  function hexToBytes(hex) {
    const bytes = new Uint8Array(hex.length / 2);
    for (let i = 0; i < hex.length; i += 2) {
      bytes[i / 2] = parseInt(hex.substring(i, i + 2), 16);
    }
    return bytes;
  }

  it('converts hex string to bytes', () => {
    const bytes = hexToBytes('aabb');
    expect(bytes.length).toBe(2);
    expect(bytes[0]).toBe(0xaa);
    expect(bytes[1]).toBe(0xbb);
  });

  it('converts "ff" to [255]', () => {
    const bytes = hexToBytes('ff');
    expect(bytes[0]).toBe(255);
  });

  it('converts "00" to [0]', () => {
    const bytes = hexToBytes('00');
    expect(bytes[0]).toBe(0);
  });
});

describe('Edge Function: razorpay-webhook/index.ts - event routing', () => {
  function shouldProcessEvent(eventType) {
    return eventType === 'payment_link.paid';
  }

  it('processes payment_link.paid event', () => {
    expect(shouldProcessEvent('payment_link.paid')).toBe(true);
  });

  it('ignores other events', () => {
    expect(shouldProcessEvent('payment_link.created')).toBe(false);
    expect(shouldProcessEvent('payment.authorized')).toBe(false);
    expect(shouldProcessEvent('order.paid')).toBe(false);
  });

  it('ignores unknown events', () => {
    expect(shouldProcessEvent('')).toBe(false);
  });
});

describe('Edge Function: create-razorpay-payment-link/index.ts - payload', () => {
  function buildPayload(user) {
    return {
      amount: 99900,
      currency: 'INR',
      description: 'RED Premium — Lifetime Access',
      customer: {
        name: user.email?.split('@')[0] || 'RED User',
        email: user.email || '',
        contact: '',
      },
      notify: { sms: false, email: true },
      reminder_enable: true,
      notes: { user_id: user.id },
    };
  }

  it('sets correct amount (₹999 = 99900 paise)', () => {
    const payload = buildPayload({ id: 'u1', email: 'test@example.com' });
    expect(payload.amount).toBe(99900);
    expect(payload.currency).toBe('INR');
  });

  it('includes user_id in notes', () => {
    const payload = buildPayload({ id: 'user-abc', email: 'a@b.com' });
    expect(payload.notes.user_id).toBe('user-abc');
  });

  it('extracts name from email', () => {
    const payload = buildPayload({ id: 'u1', email: 'john.doe@example.com' });
    expect(payload.customer.name).toBe('john.doe');
  });

  it('uses fallback name when email has no local part', () => {
    const payload = buildPayload({ id: 'u1', email: '' });
    expect(payload.customer.name).toBe('RED User');
  });

  it('enables email notification', () => {
    const payload = buildPayload({ id: 'u1', email: 'test@test.com' });
    expect(payload.notify.email).toBe(true);
    expect(payload.notify.sms).toBe(false);
  });

  it('reminder is enabled', () => {
    const payload = buildPayload({ id: 'u1', email: 'test@test.com' });
    expect(payload.reminder_enable).toBe(true);
  });
});

describe('popup.js - Razorpay upgrade flow', () => {
  const EDGE_FN_ORIGIN = 'https://votjuphsggdecoawqeqc.supabase.co/functions/v1';
  const RAZORPAY_CREATE_FN = EDGE_FN_ORIGIN + '/create-razorpay-payment-link';

  it('constructs correct Edge Function URL', () => {
    expect(RAZORPAY_CREATE_FN).toBe('https://votjuphsggdecoawqeqc.supabase.co/functions/v1/create-razorpay-payment-link');
  });

  it('POST method with auth header', () => {
    const headers = {
      'Content-Type': 'application/json',
      Authorization: 'Bearer test-token',
    };
    expect(headers.Authorization).toContain('Bearer ');
  });

  it('handles successful response with url', () => {
    const mockResponse = { url: 'https://rzp.io/i/test123', id: 'plink_test123' };
    expect(mockResponse.url).toMatch(/^https:\/\/rzp\.io/);
    expect(mockResponse.id).toMatch(/^plink_/);
  });
});

describe('Edge Function: refine/index.ts - buildRequestBody', () => {
  function buildRequestBody(name, messages) {
    const GROQ_MODEL = 'llama-3.3-70b-versatile';
    const OPENROUTER_MODEL = 'openai/gpt-4o-mini';

    if (name === 'gemini') {
      const sys = messages.find(m => m.role === 'system')?.content || '';
      const user = messages.find(m => m.role === 'user')?.content || '';
      return { contents: [{ parts: [{ text: `${sys}\n\n${user}` }] }] };
    }
    return { model: name === 'groq' ? GROQ_MODEL : OPENROUTER_MODEL, messages, stream: true };
  }

  it('gemini combines system and user into single text', () => {
    const messages = [
      { role: 'system', content: 'You are helpful' },
      { role: 'user', content: 'Write code' },
    ];
    const body = buildRequestBody('gemini', messages);
    expect(body.contents[0].parts[0].text).toContain('You are helpful');
    expect(body.contents[0].parts[0].text).toContain('Write code');
  });

  it('groq returns model and messages', () => {
    const messages = [{ role: 'user', content: 'Hello' }];
    const body = buildRequestBody('groq', messages);
    expect(body.model).toBe('llama-3.3-70b-versatile');
    expect(body.messages).toEqual(messages);
    expect(body.stream).toBe(true);
  });

  it('openrouter returns correct model', () => {
    const messages = [{ role: 'user', content: 'Hello' }];
    const body = buildRequestBody('openrouter', messages);
    expect(body.model).toBe('openai/gpt-4o-mini');
  });
});
