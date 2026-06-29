import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!;
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
const RAZORPAY_KEY_ID = Deno.env.get('RAZORPAY_KEY_ID')!;
const RAZORPAY_KEY_SECRET = Deno.env.get('RAZORPAY_KEY_SECRET')!;

const CORS_HEADERS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Allow-Headers': 'authorization, content-type',
};

serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response(null, { status: 204, headers: CORS_HEADERS });
  if (req.method !== 'POST') return new Response(JSON.stringify({ error: 'Method not allowed' }), { status: 405, headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' } });

  const authHeader = req.headers.get('authorization') || '';
  if (!authHeader) return new Response(JSON.stringify({ error: 'Unauthorized' }), { status: 401, headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' } });

  const token = authHeader.replace('Bearer ', '');
  const sb = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
    auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
    global: { headers: { Authorization: `Bearer ${token}` } },
  });
  const { data: { user }, error: authError } = await sb.auth.getUser(token);
  if (authError || !user) {
    return new Response(JSON.stringify({ error: 'Unauthorized' }), { status: 401, headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' } });
  }

  let body;
  try { body = await req.json(); } catch {
    return new Response(JSON.stringify({ error: 'Invalid JSON' }), { status: 400, headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' } });
  }

  const { user_id, email } = body;
  if (!user_id || !email) {
    return new Response(JSON.stringify({ error: 'user_id and email are required' }), { status: 400, headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' } });
  }

  const { data: existing } = await sb.from('users').select('user_type').eq('id', user_id).single();
  if (existing?.user_type === 'premium') {
    return new Response(JSON.stringify({ error: 'Already premium', message: 'You are already a Premium member.' }), { status: 400, headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' } });
  }

  const basicAuth = btoa(`${RAZORPAY_KEY_ID}:${RAZORPAY_KEY_SECRET}`);

  const payload = {
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
    notes: { user_id, email },
  };

  const rpRes = await fetch('https://api.razorpay.com/v1/payment_links', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Basic ${basicAuth}`,
    },
    body: JSON.stringify(payload),
  });

  if (!rpRes.ok) {
    const errText = await rpRes.text();
    console.error('[RED] Razorpay create link error:', rpRes.status, errText);
    return new Response(JSON.stringify({ error: 'Failed to create payment link' }), { status: 502, headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' } });
  }

  const data = await rpRes.json();
  return new Response(JSON.stringify({ url: data.short_url, id: data.id }), {
    headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' },
  });
});
