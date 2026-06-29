# RULES.md — Standing Rules for Building RED

These rules apply to **every** prompt, every stage, every session. Treat this as a persistent system-level contract, not a one-time instruction. If a specific stage prompt ever conflicts with this file, ask before proceeding rather than silently picking one.

---

## 1. Project Identity (don't drift from this)

- Project name: **RED** (Refine Every Detail)
- Type: Chrome Extension, Manifest V3, targeting Claude.ai
- Distribution: GitHub repo, manual dev-mode install (NOT Chrome Web Store, not yet)
- Always check `PRD.md`, `ROADMAP.md`, and `DESIGN.md` before building anything — never invent features, flows, or visual styles not described in these docs. If something is genuinely ambiguous or missing from the docs, stop and ask rather than guessing.

---

## 2. Tech Stack — Do Not Substitute

| Layer | Required | Do NOT use instead |
|---|---|---|
| Extension | Manifest V3, vanilla JS | No React/Vue/build tooling for the extension itself unless a stage explicitly calls for it |
| Tokenizer | `gpt-tokenizer` or `@dqbd/tiktoken` | No custom/approximate token counters |
| Backend | Supabase (Auth, Postgres, Edge Functions) | No Firebase, no custom Node server |
| LLM providers | Groq -> Gemini -> OpenRouter (in this fallback order) | Don't add/swap providers without being asked |
| Payments | Instamojo | No Stripe, no Razorpay, no Lemon Squeezy (already decided against) |
| Design system | Tiered status-color system per DESIGN.md — indigo brand (`#534AB7`) + teal/amber/red/blue status tiers, persistent floating card toggled by indicator badge | No neubrutalist patterns; no single-accent-only (retired); no click-away dismissal |

If a task seems to require a different tool than what's listed here, flag it and explain why instead of silently substituting.

---

## 3. Security Rules (non-negotiable)

- **Never** put API keys (Groq, Gemini, OpenRouter, Instamojo, Supabase service role key) directly in extension code/bundle. They belong server-side only, in Supabase Edge Function environment variables/secrets.
- The extension talks **only** to Supabase Edge Functions — never directly to Groq/Gemini/OpenRouter/Instamojo from client-side JS.
- Never trust `user_type` (free/premium) or quota counts sent from the client. Always verify server-side against the database on every quota-gated request.
- Use Row Level Security (RLS) on every Supabase table so users can only read/write their own rows.
- When generating example `.env` files, always use placeholder values and name the file `.env.example` — never commit real secrets.

---

## 4. Code Style & Conventions

- **File naming:** kebab-case for files (`content-script.js`, `refine-button.js`), camelCase for JS variables/functions, PascalCase only if a stage introduces components/classes
- **Comments:** explain *why*, not *what* — avoid comments that just restate the code line
- **No dead code:** don't leave commented-out blocks or unused placeholder functions in "finished" stage output
- **Error handling:** every async operation must have explicit error handling — no silent failures.
- **Defensive coding for fragile integrations:** Claude's DOM structure can change. Any code that queries Claude's page elements must use fallback selector strategies and fail gracefully.

---

## 5. Design Rules (enforce DESIGN.md automatically)

Every UI-producing task must self-check against DESIGN.md Section 11 (Consistency Checklist) before being considered done:
- Neutral chrome (background/border/text) borrowed from Claude's tokens, hardcoded fallbacks only
- Status colors assigned strictly by score tiers (High ≥80 / Medium 50–79 / Low <50) — never arbitrary
- Indigo (`#534AB7`) reserved for brand + primary actions only
- Indicator badge always at `top: 60px, right: 12px` — position never changes regardless of card state
- Card closes ONLY via × icon or badge click — no click-away dismissal
- Card positioned `top: 110px, right: 12px, width: 320px, height: auto`
- Score section includes tier label row ("HIGH ≥ 80 · GOOD") + summary sentence
- Prompt box and refined box use monospace font
- Token display is plain text line below prompt box — no chip/icon row
- Issues rendered as inline pill chips (not block cards)
- "+N pts" badge hidden until a valid finite refine delta exists
- Status communicated by color + text/icon together, never color alone
- Icons from Tabler Icons, vendored locally

If you produce a UI component that fails any of these, fix it before presenting as finished.

---

## 6. Stage Discipline

- Build **one stage at a time**, exactly as scoped in `ROADMAP.md`.
- Every stage must satisfy its "Done when" criteria before being considered complete.
- Flag assumptions explicitly in output summary.

---

## 7. Output Expectations

For every task, end your response with:
1. A list of files created/modified
2. A one-line description of what each file does
3. Any assumptions made
4. Anything you weren't able to complete and why

---

## 8. Things to Never Do

- Never publish or prepare Chrome Web Store submission materials
- Never add a subscription/recurring billing flow (one-time purchase only)
- Never expose Supabase service role keys to the client
- Never silently change the fallback LLM provider order (Groq -> Gemini -> OpenRouter)
- Never replace the current tiered status-color design direction without explicit instruction
- Never add click-away dismissal to the RED card — it closes only via × or badge toggle
- Never inject `margin-right` or any layout shift on Claude's page content
- Never move the indicator badge position based on card open/close state
- Never show "+N pts" badge when no refine result exists or delta is NaN
- Never invent new premium features not listed in PRD.md without flagging as a suggestion first

---

## 9. When In Doubt

Stop and ask a clarifying question rather than guessing on:
- Anything touching payments or money logic
- Anything touching auth/security
- Any visual decision not covered by DESIGN.md
- Any feature not explicitly described in PRD.md or ROADMAP.md
