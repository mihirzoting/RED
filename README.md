# RED (Refine Every Detail)

Chrome extension that enhances Claude.ai with real-time prompt analysis, refinement suggestions, and efficiency metrics. Built with Manifest V3, Supabase, and Razorpay.

## Features

- **Real-time Prompt Analysis** — scores clarity, context richness, token efficiency, and specificity
- **Prompt Refinement** — one-click improvement via Groq/Gemini/OpenRouter with 4 styles (default, concise, detailed, code-focused)
- **Tiered Quota System** — Free (10/day) and Premium (300/day) with re-refine limits
- **Premium History** — persistent prompt history with Chart.js score trends, export CSV, and insights
- **Neubrutalist Design System** — indigo brand with teal/amber/red tiered status colors

## Architecture

```
                    ┌──────────────┐
                    │  Claude.ai   │
                    │  (host page) │
                    └──────┬───────┘
                           │ Shadow DOM
                    ┌──────▼───────┐
                    │  RED Panel    │
                    │ (injected)    │
                    └──────┬───────┘
                           │
        ┌──────────────────┼──────────────────┐
        │                  │                  │
  ┌─────▼─────┐    ┌──────▼──────┐    ┌──────▼──────┐
  │  Popup     │    │  Edge Fns   │    │  Supabase   │
  │ (auth/     │    │  (Deno)     │    │  (DB + RLS) │
  │  account)  │    │             │    │             │
  └───────────┘    └─────────────┘    └─────────────┘
```

## Project Structure

```
RED/
├── assets/
│   ├── icons/                    — Extension icons (16/48/128)
│   └── *.svg, *.png              — Panel UI assets
├── lib/
│   ├── vendor/
│   │   ├── gpt-tokenizer.js      — Tokenizer library
│   │   ├── chart.min.js          — Chart.js for premium history
│   │   └── tabler-icons/         — Icon set
│   ├── analysis.js               — Heuristic prompt analysis engine
│   ├── auth.js                   — Shared token refresh (popup + panel)
│   ├── detect-input.js           — Claude input box observer
│   ├── history-free.js           — Free tier local history (chrome.storage)
│   ├── history-premium.js        — Premium Supabase history + Chart.js
│   ├── inject-panel.js           — Shadow DOM panel (1439 lines)
│   └── tokenizer.js              — Token counting
├── popup/
│   ├── popup.html                — Auth + account popup
│   └── popup.js                  — Login/signup/upgrade/polling logic
├── supabase/
│   ├── functions/
│   │   ├── create-payment-link/  — Razorpay Payment Link creator
│   │   ├── razorpay-webhook/     — payment.captured webhook handler
│   │   └── refine/               — Prompt refinement (LLM provider chain)
│   ├── migrations/
│   │   ├── 00001_schema.sql      — Tables, RLS, triggers
│   │   ├── 00002_add_score_column.sql
│   │   ├── 00003_allow_null_refined_prompt.sql
│   │   └── 00004_ensure_rls_policies.sql
│   └── config.toml               — Supabase CLI config
├── tests/
│   ├── analysis.test.js          — 79 tests
│   ├── auth.test.js              — 9 tests
│   ├── content-script.test.js    — 8 tests
│   ├── detect-input.test.js      — 13 tests
│   ├── edge-functions.test.js    — 71 tests (Razorpay + refine + SSE)
│   ├── history-free.test.js      — 22 tests
│   ├── history-premium.test.js   — 23 tests
│   ├── inject-panel.test.js      — 26 tests
│   └── tokenizer.test.js         — 8 tests
├── background.js                 — Service worker
├── content-script.js             — Main content script (input watcher, refine, save)
├── manifest.json                 — Manifest V3
├── .env.example                  — Required API keys template
├── .gitignore
└── Docs/
    └── ROADMAP.md                — Development roadmap
```

## Setup

### 1. Extension

1. Enable Chrome's Developer Mode at `chrome://extensions`
2. Click "Load unpacked" and select the `RED` directory
3. Visit `claude.ai` — the panel appears below the input box

### 2. Supabase

1. Create a project at [supabase.com](https://supabase.com)
2. Enable **Auth providers**: Email/Password + Google OAuth in the Auth dashboard
3. Open **SQL Editor** and run all migration files in order:
   ```
   supabase/migrations/00001_schema.sql
   supabase/migrations/00002_add_score_column.sql
   supabase/migrations/00003_allow_null_refined_prompt.sql
   supabase/migrations/00004_ensure_rls_policies.sql
   ```
4. Copy `.env.example` to `.env` and fill in your Supabase project URL and anon key (Settings > API)
5. Configure Google OAuth: add your extension's redirect URL (`https://<extension-id>.chromiumapp.org/`) to the Google Cloud Console and Supabase Auth settings

### 3. Razorpay (Premium Payments)

1. Create an account at [razorpay.com](https://razorpay.com)
2. Navigate to Settings → API Keys and generate a key pair
3. Run these commands to deploy Edge Functions and set secrets:

```bash
supabase functions deploy create-payment-link --project-ref YOUR_PROJECT_REF
supabase functions deploy razorpay-webhook --project-ref YOUR_PROJECT_REF
supabase functions deploy refine --project-ref YOUR_PROJECT_REF

supabase secrets set RAZORPAY_KEY_ID=rzp_live_your_key
supabase secrets set RAZORPAY_KEY_SECRET=your_secret
supabase secrets set RAZORPAY_WEBHOOK_SECRET=your_webhook_secret
supabase secrets set GROQ_API_KEY=gsk_your_key
supabase secrets set GEMINI_API_KEY=your_key
supabase secrets set OPENROUTER_API_KEY=sk-or-your-key
```

4. In Razorpay Dashboard → Settings → Webhooks, add:
   - **URL**: `https://YOUR_PROJECT_REF.supabase.co/functions/v1/razorpay-webhook`
   - **Event**: `payment.captured`
   - **Secret**: the same value as `RAZORPAY_WEBHOOK_SECRET`

### 4. LLM Providers (for Refinement)

Get API keys from any of these and store as Edge Function secrets:
- [Groq](https://console.groq.com) — primary (fastest)
- [Gemini](https://aistudio.google.com) — fallback
- [OpenRouter](https://openrouter.ai) — final fallback

## Running Tests

```bash
npm install
npx vitest run
```

All 259 tests should pass across 9 test files.

## Edge Functions

| Function | Route | Purpose |
|----------|-------|---------|
| `refine` | `/refine` | Prompt refinement via LLM chain; checks quota, streams response, logs usage |
| `create-payment-link` | `/create-payment-link` | Creates Razorpay Payment Link (₹999 lifetime) |
| `razorpay-webhook` | `/razorpay-webhook` | Handles `payment.captured` webhook, upgrades user to premium |

## RLS & Security

Row-Level Security is enforced on all tables:

- `refine_history` — `auth.uid() = user_id` for SELECT/INSERT/DELETE
- `usage_log` — `auth.uid() = user_id` for SELECT/INSERT/UPDATE
- `users` — `auth.uid() = id` for SELECT/UPDATE

The anon key is safe for client-side use (subject to RLS). The service role key is used only by Edge Functions and is never exposed to the extension.

## Quota System

| Tier | Daily Limit | Re-refines | Price |
|------|-------------|------------|-------|
| Free | 10 | 2 per prompt | Free |
| Premium | 300 | Unlimited | ₹999 lifetime |

## Payment Flow

1. User clicks "Upgrade" in popup or panel
2. Extension calls `/create-payment-link` Edge Function with `user_id` + `email`
3. Edge Function creates a Razorpay Payment Link (returns short URL)
4. Extension opens the URL in a new tab
5. User completes payment (test card: `4111 1111 1111 1111`)
6. Razorpay sends `payment.captured` webhook to `/razorpay-webhook`
7. Webhook verifies HMAC-SHA256 signature, extracts `user_id` from notes, upgrades user
8. Extension polls Supabase every 5s (up to 60s) for `user_type` to flip to `premium`
