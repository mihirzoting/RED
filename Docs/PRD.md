# RED — Refine Every Detail
### Product Requirements Document (PRD)

**Tagline:** AI-Powered Prompt Intelligence
**Type:** Chrome Extension (Manifest V3)
**Target Platform:** Claude.ai (designed to feel like a native part of the interface)
**Distribution:** GitHub repo, manual install via Chrome Developer Mode (no Web Store for v1)

---

## 1. Problem Statement

Users typing prompts into Claude (or any LLM chat) often:
- Write vague, underspecified prompts that produce weaker responses
- Waste tokens (and money, on paid API tiers) on bloated, redundant phrasing
- Have no feedback loop telling them *how* to improve a prompt before sending it
- Have no quick way to rewrite a prompt without manually re-typing it

RED solves this by sitting alongside Claude's input box, analyzing what the user types in real time, and offering a one-click AI-powered refinement — without ever leaving the page.

---

## 2. Goals

- Give users **instant, free, unlimited feedback** on prompt quality (clarity, token cost, efficiency) with zero latency, since this runs entirely client-side.
- Give users a **one-click AI refine** option that rewrites their prompt for clarity/efficiency, with a visible diff, and lets them paste it directly into Claude's input box.
- Build a **sustainable free + premium model** so the project can run without burning through paid API budgets indefinitely.
- Make the UI feel like a **native extension of Claude itself** — neutral chrome borrowed from Claude's own interface, with RED's own indigo brand color and tiered status colors used deliberately for scoring/flags — not a bolted-on third-party tool.

### Non-goals (v1)
- Not publishing to the Chrome Web Store yet
- Not supporting other LLM chat UIs yet (ChatGPT, Gemini, etc.) — Claude.ai only for v1
- Not building a mobile app or browser-agnostic version (Chrome only, MV3)

---

## 3. Users

| Tier | Who they are |
|---|---|
| **Free** | Anyone with a Google/email account, casual users, students, people testing the tool |
| **Premium** | Power users, professionals, bug bounty hunters / devs / prompt engineers who refine prompts frequently and want history + faster/better refines |

---

## 4. Core Features

### 4.1 Local Real-Time Analysis (Free, Unlimited, No API calls)
Runs entirely client-side, no backend cost, no rate limit.

- **Token count** — exact count using a tokenizer library (e.g., `gpt-tokenizer` or `@dqbd/tiktoken`)
- **Estimated cost** — token count × hardcoded per-model pricing table (Claude Opus/Sonnet/Haiku rates)
- **Vague-language flags** — detects filler/vague words ("stuff", "things", "somehow", "etc.") and highlights them
- **Structure suggestions** — flags missing context, run-on sentences, ambiguous asks
- **Four score metrics (0–100 each)**: **Clarity, Context richness, Token efficiency, Specificity** — each a composite heuristic score derived from the existing checks above (vague-language density, missing-context/run-on penalties, structural completeness), surfaced as an overall score circle plus four individual metric bars. Not new detection systems — a scoring/aggregation layer on top of existing heuristics, tier-colored per DESIGN.md Section 3 (High ≥80 / Medium 50–79 / Low <50). Framed to users as a heuristic estimate, not an objective grade (see Section 7, Risks).
- **Debounced** — triggers ~400–600ms after the user stops typing (not on every keystroke)

> **Deferred — Grammar correctness:** considered for this release but explicitly out of scope for v1. Accurate grammar checking needs either a real grammar-check library (bundle-size cost, on top of the already-vendored 2MB tokenizer) or an LLM call — the latter would break the "free, unlimited, local" promise of this section and would need to live behind the quota system like Refine does instead. Revisit as a possible Premium feature or a separate quota-gated check in a future stage — don't build a placeholder for it now.

### 4.2 AI-Powered Refine (Quota-limited)
- User clicks **"Refine"** → prompt sent to backend (Supabase Edge Function) → LLM rewrites it
- Response **streamed** into the RED panel below the original (not auto-pasted)
- Shows a **diff view** (original vs. refined) so users see exactly what changed
- Two action buttons after refine result appears:
  - **Paste** → injects refined text directly into Claude's input box
  - **Re-refine** → regenerates a new version (counts toward the 2 free re-refines, see quota logic below)

### 4.3 LLM Provider Chain (Fallback)
Calls happen server-side (Supabase Edge Function), never directly from the browser (keeps API keys safe).

1. **Groq** (primary — fastest, generous free tier)
2. **Gemini** (fallback)
3. **OpenRouter** (final fallback)

Fail-fast strategy: short timeout (~4s) per provider before moving to the next — no slow sequential retries.

### 4.4 Quota System

| Tier | Daily quota units | Refines per unit |
|---|---|---|
| Free | 10/day | 1 initial + 2 free re-refines = 3 refines per unit |
| Premium | 300/day | Same 3-per-unit rule (generous already) |

Logic:
- 1st refine on a prompt → consumes 1 quota unit
- 2nd and 3rd refine on the *same* prompt (re-refines) → free, no quota consumed
- 4th refine onward on that same prompt → consumes a new quota unit, and resets to grant 2 more free re-refines

### 4.5 History

| Tier | Behavior |
|---|---|
| Free | Session-only — stored in `chrome.storage.session`, cleared when browser session ends. No backend writes. |
| Premium | Persisted indefinitely in Supabase. Sortable by: Today / Last 7 days / Last 30 days / All time |

### 4.6 Premium Tier (₹999 one-time, lifetime — shown discounted from ₹1499)
- 300 refine-quota-units/day (vs. 10 free)
- **Priority routing** — faster provider selection, possibly racing 2 providers in parallel for lowest latency
- **Deep refine mode** — uses a larger/smarter model for more thorough rewrites
- **Custom refine styles** — concise / detailed / code-focused / etc. (free tier gets one default style)
- **Persistent indefinite history** with sorting/filtering
- **Analytics dashboard** (planned, not in v1 build scope) — score trend chart over time, aggregate stats (avg score, prompts analyzed, tokens saved, refinements used), and an "insights" prompt that summarizes patterns in the user's prompt history. Documented here as a future Premium feature per the mockup you provided; not part of the current build — see ROADMAP.md Stage 9/Stage 8 notes.

### 4.7 Auth
- Supabase Auth — supports **both** email/password and Google OAuth
- Required for: tracking quota, storing premium status, persisting history (premium only)
- Not required for: local analysis (works even logged out)

### 4.8 Payments
- **Instamojo** — Payment Links + webhook (`payment.captured`) → Supabase Edge Function flips `user_type` to `premium`
- User ID passed via Instamojo custom field at checkout so the webhook knows who paid
- One-time purchase ₹999 lifetime, no subscription
- Instamojo sends a POST webhook to Supabase Edge Function on successful payment with buyer email + custom fields
- Webhook validates the request using Instamojo's MAC (Message Authentication Code) before updating the user record

---

## 5. Out of Scope / Explicitly Deferred Decisions
- Chrome Web Store publishing (later, not now)
- A standalone website for download (later, not now)
- Subscription billing (deferred in favor of one-time purchase; can migrate later if usage data shows it's needed)
- Multi-LLM-platform support beyond Claude.ai
- Retention limits on premium history (kept indefinitely — cheap at this scale)

---

## 6. Success Metrics (informal, indie-project scale)
- Extension successfully loads and detects Claude's textarea reliably across UI updates
- Local analysis renders in under ~100ms after debounce
- Refine round-trip (via fastest available provider) completes in a few seconds, ideally streamed so it *feels* faster
- Free-to-premium conversion — track at least directionally once Instamojo is wired up
- Daily quota system correctly blocks free users at the 10-unit mark and never lets it be bypassed client-side

---

## 7. Risks (carried over from planning discussion)
- Claude's DOM/selectors change often → content script breaks silently → needs ongoing maintenance
- "Accuracy" scoring is inherently a soft/fuzzy signal, not ground truth — must be framed to users as a heuristic, not an objective grade
- Free-tier abuse via multiple accounts — acceptable risk for v1, can add friction later (email verification etc.)
- Single point of failure if all 3 LLM providers degrade simultaneously (rare, but plan messaging for it)
- API key must never be shipped inside the extension bundle — always proxied through Supabase Edge Functions

---

## 8. Tech Stack Summary

| Layer | Choice |
|---|---|
| Extension | Manifest V3, vanilla JS (or lightweight, no heavy build chain) |
| Tokenizer | `gpt-tokenizer` or `@dqbd/tiktoken` (client-side) |
| Backend | Supabase (Auth, Postgres, Edge Functions) |
| LLM Providers | Groq → Gemini → OpenRouter (fallback chain) |
| Payments | Instamojo (Payment Links + Webhooks) |
| Hosting | GitHub repo (manual dev-mode install) |

See `ROADMAP.md` for the build order and `DESIGN.md` for UI/visual consistency guidelines.
