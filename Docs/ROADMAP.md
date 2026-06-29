# RED — Build Roadmap
### Step-by-step component guide (for self-build or prompting an LLM per stage)

This roadmap is broken into independent stages. Each stage has: **goal, what to build, why it matters, and what "done" looks like.** Build in order — later stages depend on earlier ones being functional.

---

## Stage 0 — Project Setup

**Goal:** Get a loadable (even if empty) Chrome extension running.

**Build:**
- Folder structure:
  ```
  RED/
    manifest.json
    content-script.js
    popup/
      popup.html
      popup.js
      popup.css
    panel/
      panel.html (if using iframe injection) or panel.js (if injecting DOM directly)
      panel.css
    lib/
      tokenizer.js
      analysis.js
    background.js (service worker)
    assets/
      icons/
  ```
- `manifest.json` — Manifest V3, with:
  - `content_scripts` matching `https://claude.ai/*`
  - `permissions`: `storage`, `scripting`
  - `host_permissions` for your Supabase Edge Function domain
  - `action` (popup) for login/account/quota display

**Done when:** Extension loads in `chrome://extensions` (dev mode) with no errors, shows your icon, and the content script logs something to console on claude.ai.

---

## Stage 1 — Detect Claude's Prompt Box (Content Script)

**Goal:** Reliably find Claude's input textarea/contenteditable element and hook into it.

**Build:**
- A `MutationObserver` watching for Claude's input element (since it may load after page render, and Claude's SPA navigation won't trigger full page reloads)
- A resilient selector strategy — don't rely on a single brittle class name; prefer `[contenteditable="true"]` + role/aria attributes where possible, since Claude's class names can change between deploys
- Event listener on `input`/`keyup` to capture current text content

**Why this matters:** This is the single most fragile part of the whole project — Claude's frontend changes periodically, and this is the piece that breaks first. Isolate this logic into one small module (`lib/detect-input.js`) so it's the only thing you need to patch when Claude updates their UI.

**Done when:** Typing in Claude's box logs the current text to console in real time, and the script survives a page refresh and in-app navigation.

---

## Stage 2 — Inject the RED Indicator + Card (UI Shell)

**Goal:** Insert a small, always-visible indicator badge into the page, which expands into the full analysis/refine card on click. This replaces the right-gutter docked-panel model from the previous revision — see `DESIGN.md` Section 5 for the full spec.

**Build:**
- Inject a small circular indicator (`~40px`, `position: fixed`, `right: 24px; top: 24px`) — this reuses the exact position and most of the styling of the previous revision's "collapsed icon" state
- Indicator shows the wand icon by default; once an analysis exists, add a thin tier-colored ring (teal/amber/red per DESIGN.md Section 3) as an at-a-glance signal
- On click, expand into the full card as an absolutely-positioned overlay anchored near the indicator (`max-width: 360px`) — **reuse the drawer-overlay open/close animation and `composedPath()` click-away dismissal already built in the previous revision** rather than rebuilding it; what was a narrow-viewport fallback becomes the only expand behavior now
- The gutter-width calculation, `main`/`[role="main"]`/`max-w-*` selector matching, and sidebar-toggle-triggered re-docking logic from the previous revision are **no longer needed for the indicator's default state** and can be removed — the indicator is small enough to never require a "is there room" check
- Use Shadow DOM to scope RED's CSS and avoid clashing with Claude's own styles, same as before
- Skeleton sections inside the expanded card (top to bottom, per `DESIGN.md` Section 6): header, score circle + 4 metric bars, prompt box with inline highlights, token strip, issues list, refined output (hidden until a refine is triggered), Paste/Re-refine footer actions (hidden until a result exists)

**Done when:** The indicator renders and stays visible regardless of viewport width or Claude's sidebar state, expands into the full card cleanly on click, and the card closes via its close icon or click-away without needing any gutter-space calculation.

---

## Stage 3 — Local Analysis Engine (Free, Unlimited)

**Goal:** Real-time, zero-API-call prompt analysis.

**Build (`lib/tokenizer.js` + `lib/analysis.js`):**
- Integrate a tokenizer library (`gpt-tokenizer` or `@dqbd/tiktoken`) to get accurate token counts
- Hardcode a small pricing table (input/output token cost per Claude model — pull current numbers from Anthropic's pricing page)
- Heuristic checks:
  - Vague word detection (simple keyword list: "stuff", "things", "somehow", "etc", "maybe", etc.)
  - Sentence-length / run-on detection
  - Missing-context heuristics (e.g., prompt under N words with no clear verb/object structure)
- **Four score metrics (0–100 each)**: **Clarity, Context richness, Token efficiency, Specificity** — normalize and combine the heuristic checks above into four composite scores plus an overall score (see PRD.md Section 4.1 and DESIGN.md Section 6.2 for the exact definitions, tier thresholds, and bar/circle rendering). This is a scoring/aggregation layer on top of the existing checks, not new detection logic.
- Grammar correctness is explicitly **not** part of this stage — see PRD.md's deferred note. Don't add a placeholder for it.
- Debounce trigger (400–600ms after typing stops) before running analysis
- Render results into the card's score circle, metric bars, and prompt-box inline highlights (see DESIGN.md Section 6.2–6.3)

> Note: if Stage 3 was already marked done before this addition, treat this as an extension of existing `lib/analysis.js` / `lib/inject-panel.js` code (adding the four scoring functions, replacing the earlier two-score bar render path with the score-circle + 4-bar layout), not a ground-up rebuild of the stage.

**Done when:** Typing into Claude's box updates token count/cost/flags in the RED panel within ~100ms of the debounce firing, entirely offline (test with network disabled to confirm zero dependency on backend).

---

## Stage 4 — Supabase Backend Setup

**Goal:** Auth, database, and Edge Functions ready to support refine + quota + premium logic.

**Build:**
- Supabase project setup
- **Auth:** enable email/password + Google OAuth providers
- **Tables:**
  ```sql
  users (
    id uuid primary key references auth.users,
    email text,
    user_type text default 'free', -- 'free' | 'premium'
    premium_since timestamptz,
    created_at timestamptz default now()
  )

  usage_log (
    id uuid primary key default gen_random_uuid(),
    user_id uuid references users(id),
    prompt_hash text,
    refine_count int default 0,
    quota_consumed int default 0,
    date date default current_date
  )

  refine_history (
    id uuid primary key default gen_random_uuid(),
    user_id uuid references users(id),
    original_prompt text,
    refined_prompt text,
    token_count_before int,
    token_count_after int,
    created_at timestamptz default now()
  )
  ```
- Row Level Security (RLS) policies — users can only read/write their own rows

**Done when:** You can sign up/log in via Supabase Auth from a test page, and manually insert/query rows in each table via the Supabase dashboard.

---

## Stage 5 — Edge Function: Refine Proxy

**Goal:** Server-side function that enforces quota and calls the LLM chain — this is what the extension actually talks to (never the LLM providers directly).

**Build:**
- Supabase Edge Function (`/refine`) that:
  1. Authenticates the request (Supabase session token)
  2. Looks up `user_type` and today's `usage_log` for this user
  3. If free and quota unit cap reached → return a "limit reached" response (no LLM call)
  4. Otherwise, determine if this is a new prompt (consumes quota) or a re-refine within the free 2-re-refine window
  5. Calls Groq first; on failure/timeout (~4s), falls to Gemini, then OpenRouter
  6. Streams the response back to the extension
  7. Updates `usage_log` (and `refine_history` if premium) after a successful call

**Why this matters:** This is the only place your LLM API keys live. Store them as Supabase secrets/env vars, never in the extension bundle.

**Done when:** Calling the Edge Function with a test prompt and a valid auth token returns a refined prompt, and quota correctly decrements/blocks after repeated test calls.

---

## Stage 6 — Wire Up Refine in the Extension

**Goal:** Connect the panel's "Refine" button to the live Edge Function.

**Build:**
- On "Refine" click: send the current prompt text + auth token to the Edge Function
- Stream the response into the panel's output area as it arrives
- Render a simple diff view (original vs. refined — highlight added/removed/changed segments)
- Show "Paste" and "Re-refine" buttons once a result is ready
- "Paste" → programmatically sets Claude's input box content to the refined text (must dispatch proper `input` events so Claude's own React state picks up the change)
- Handle and display quota-exceeded responses clearly (with an upgrade prompt for free users)

**Done when:** Full loop works live — type a prompt, click Refine, see streamed result, click Paste, and it appears correctly in Claude's box ready to send.

---

## Stage 7 — Auth + Popup UI

**Goal:** Login/signup flow and account status display.

**Build:**
- `popup.html`/`popup.js`: login form (email/password) + "Sign in with Google" button
- Display current plan (Free/Premium), today's quota usage (`X/10` or `X/300`), and an "Upgrade" button if free
- Store session token in `chrome.storage.local` (or session, per your security preference) for use by the content script when calling the Edge Function

**Done when:** User can log in/out from the popup, and the panel reflects their real quota status pulled from Supabase.

---

## Stage 8 — History Feature

**Goal:** Session history for free users, persistent history for premium.

**Build:**
- Free: store refine results in `chrome.storage.session`, render a simple list in the panel, cleared automatically on browser close
- Premium: write to `refine_history` table (via Edge Function), fetch and render with sort/filter tabs (Today / Last 7 days / Last 30 days / All time)

**Done when:** Free users see history disappear after closing the browser; premium users see persistent history correctly filtered by date range.

---

## Stage 9 — Premium Features

**Goal:** Implement the actual premium-gated capabilities.

**Build:**
- **Priority routing:** premium requests skip straight to fastest provider, or race 2 in parallel
- **Deep refine mode:** toggle in the panel (premium only) that requests a larger model from the Edge Function
- **Custom refine styles:** dropdown (concise/detailed/code-focused/etc.) that modifies the system prompt sent to the LLM — premium only, free tier locked to default style

> **Not in this stage:** the analytics dashboard (score trend chart, aggregate stats, "Insights" prompt) shown in the history-dashboard mockup is documented in PRD.md Section 4.6 as a future Premium feature, but is explicitly out of scope for this build pass. Don't build it as part of Stage 9 — it needs its own scoped stage/prompt later.

**Done when:** All three premium features are functionally gated server-side (Edge Function checks `user_type`, never trusts the client) and visibly different in behavior from free tier.

---

## Stage 10 — Instamojo Integration

**Goal:** Let users purchase premium via Razorpay Payment Links.

**Build:**
- Supabase Edge Function `/create-payment-link` creates a Razorpay Payment Link for ₹999 lifetime access
  - Stores `user_id` and `email` in `notes` so webhook can identify the buyer
- Supabase Edge Function `/razorpay-webhook` listens for `payment.captured` event:
  - Validates HMAC-SHA256 signature via `X-Razorpay-Signature` header
  - Extracts `user_id` from `payload.payment.entity.notes.user_id`
  - Falls back to email lookup if `user_id` is missing
  - Flips `user_type` to `premium` in `users` table
- Upgrade UI in popup + inject panel:
  - 'Upgrade to Premium ₹999 →' calls `/create-payment-link`, opens the returned short URL in a new tab
  - Polls Supabase every 5s for up to 60s to check if `user_type` flipped to premium
  - On confirmation: popup updates to show Premium plan

**Done when:** A test payment correctly flips a test user's account to premium within seconds, and the popup reflects the updated plan status.

---

## Stage 11 — Polish & Resilience

**Goal:** Handle the rough edges before calling v1 "done."

**Build:**
- Graceful fallback messaging if all 3 LLM providers fail (don't just hang/error silently)
- Retry/re-detect logic if Claude's DOM structure changes mid-session
- Loading states for every async action (refine, login, payment)
- Basic error boundaries so one broken component doesn't crash the whole panel
- A short in-extension onboarding tooltip explaining what RED does on first install

**Done when:** You can use RED for a full session without console errors, and it degrades gracefully (clear messaging, not silent failure) when something goes wrong.

---

## Stage 12 — Documentation & GitHub Release

**Goal:** Make it installable by others via dev mode.

**Build:**
- `README.md` with: what RED is, screenshots/GIF, manual install instructions (load unpacked), how to set up your own Supabase/Instamojo keys if self-hosting
- `.env.example` for required keys (never commit real keys)
- License file (MIT recommended for an open extension like this)

**Done when:** A stranger could clone the repo, follow the README, and get RED running locally within ~10 minutes.

---

## Suggested Build Order Summary

```
0. Project setup
1. Detect Claude's input box
2. Inject RED panel UI shell
3. Local analysis engine (free, unlimited)
4. Supabase backend setup
5. Edge Function: refine proxy + quota logic
6. Wire refine button to live backend
7. Auth + popup UI
8. History (session + persistent)
9. Premium features (routing, deep refine, styles)
10. Instamojo integration
11. Polish & resilience
12. Docs & GitHub release
```

Each stage is independently testable — you can build and verify Stage 3 (local analysis) fully before touching Supabase at all, for example. This makes it easy to prompt an LLM with "build me Stage X of RED" and get a self-contained, testable result each time.
