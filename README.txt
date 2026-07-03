╔═══════════════════════════════════════╗
║   RED  ✦  v1.0.0                     ║
║   Refine Every Detail                ║
║   AI Prompt Optimizer                ║
╚═══════════════════════════════════════╝

─────────────────────────────────────────
  WHAT IS RED?
─────────────────────────────────────────

RED is a Chrome extension that analyzes and
refines your AI prompts in real time. It
scores clarity, context, token efficiency,
and specificity — then lets you rewrite
with one click via Groq, Gemini, or
OpenRouter.

─────────────────────────────────────────
  INSTALLATION
─────────────────────────────────────────

  1. Open Chrome and go to:
     chrome://extensions

  2. Enable "Developer mode"
     (toggle in top-right corner)

  3. Click "Load unpacked"

  4. Select the RED folder

  5. The extension is now installed.
     Visit any supported site to use it.

─────────────────────────────────────────
  SUPABASE SETUP (Required for Auth & Premium)
─────────────────────────────────────────

  1. Create a project at supabase.com

  2. Enable Auth providers:
     - Email/Password
     - Google OAuth

  3. Run SQL migrations from:
     supabase/migrations/00001_schema.sql
     (plus 00002 through 00004)

  4. Open lib/config.js and set:
     - SUPABASE_URL
     - SUPABASE_ANON_KEY

─────────────────────────────────────────
  RAZORPAY SETUP (Optional — for Premium)
─────────────────────────────────────────

  1. Create an account at razorpay.com

  2. Generate API keys in Settings → API Keys

  3. Deploy Edge Functions:
     supabase functions deploy create-payment-link
     supabase functions deploy razorpay-webhook
     supabase functions deploy refine

  4. Set secrets:
     supabase secrets set RAZORPAY_KEY_ID=rzp_live_...
     supabase secrets set RAZORPAY_KEY_SECRET=...
     supabase secrets set RAZORPAY_WEBHOOK_SECRET=...

  5. In Razorpay Dashboard → Webhooks:
     URL: https://[ref].supabase.co/functions/v1/razorpay-webhook
     Event: payment.captured

─────────────────────────────────────────
  LLM PROVIDERS (Required for Refinement)
─────────────────────────────────────────

  Get API keys from any of:
  • Groq (console.groq.com) — primary
  • Gemini (aistudio.google.com) — fallback
  • OpenRouter (openrouter.ai) — final fallback

  Set as Supabase secrets:
  supabase secrets set GROQ_API_KEY=...
  supabase secrets set GEMINI_API_KEY=...
  supabase secrets set OPENROUTER_API_KEY=...

─────────────────────────────────────────
  DEVELOPMENT
─────────────────────────────────────────

  Tests:       npx vitest run
  Structure:   See README.md for full docs

─────────────────────────────────────────
  CREDITS
─────────────────────────────────────────

  Built with ♥ by Mihir
  Powered by Supabase, Razorpay,
  Groq, Gemini & OpenRouter

  © 2026 RED. All rights reserved.
  https://github.com/anomalyco/RED
