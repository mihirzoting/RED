import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!;
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
const RAZORPAY_WEBHOOK_SECRET = Deno.env.get('RAZORPAY_WEBHOOK_SECRET')!;

const CORS_HEADERS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Allow-Headers': 'content-type',
};

async function verifySignature(body: string, signature: string, secret: string): Promise<boolean> {
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

serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response(null, { status: 204, headers: CORS_HEADERS });
  if (req.method !== 'POST') {
    return new Response(JSON.stringify({ error: 'Method not allowed' }), { status: 405, headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' } });
  }

  const rawBody = await req.text();
  const signature = req.headers.get('x-razorpay-signature') || '';

  const isValid = await verifySignature(rawBody, signature, RAZORPAY_WEBHOOK_SECRET);
  if (!isValid) {
    console.warn('[RED] Invalid Razorpay webhook signature');
    return new Response(JSON.stringify({ error: 'Invalid signature' }), { status: 400, headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' } });
  }

  let event;
  try { event = JSON.parse(rawBody); } catch {
    return new Response(JSON.stringify({ error: 'Invalid JSON' }), { status: 400, headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' } });
  }

  if (event.event !== 'payment.captured') {
    return new Response(JSON.stringify({ status: 'ignored' }), { status: 200, headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' } });
  }

  const entity = event.payload?.payment?.entity || {};
  const notes = entity.notes || {};
  let userId = notes.user_id;
  const payerEmail = entity.email || notes.email;

  if (!userId) {
    if (!payerEmail) {
      console.warn('[RED] Razorpay webhook missing both user_id and email');
      return new Response(JSON.stringify({ error: 'Missing user_id and email' }), { status: 400, headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' } });
    }

    const sb = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
      auth: { persistSession: false },
    });
    const { data: users, error: lookupError } = await sb
      .from('users')
      .select('id')
      .eq('email', payerEmail)
      .limit(1);

    if (lookupError) {
      console.error('[RED] Razorpay webhook email lookup error:', lookupError.message);
      return new Response(JSON.stringify({ error: 'DB lookup failed' }), { status: 500, headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' } });
    }

    if (!users || users.length === 0) {
      console.warn(`[RED] Razorpay webhook no user found for email: ${payerEmail}`);
      return new Response(JSON.stringify({ error: 'User not found' }), { status: 404, headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' } });
    }

    userId = users[0].id;
  }

  const sb = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
    auth: { persistSession: false },
  });

  const { error: upsertError } = await sb.from('users').upsert({
    id: userId,
    user_type: 'premium',
    premium_since: new Date().toISOString(),
  }, { onConflict: 'id' });

  if (upsertError) {
    console.error('[RED] Failed to update user to premium:', upsertError.message);
    return new Response(JSON.stringify({ error: 'DB update failed' }), { status: 500, headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' } });
  }

  console.log(`[RED] User ${userId} upgraded to premium via Razorpay`);
  return new Response(JSON.stringify({ status: 'ok' }), { status: 200, headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' } });
});
