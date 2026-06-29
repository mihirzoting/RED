# RED — Design Doc
### Visual & UX consistency guidelines (Tiered Status System)

**Principle:** RED has moved through three directions now: full neubrutalism → minimal/single-accent native-blend → this revision, a **tiered status-color system** modeled directly on a set of mockups you provided. RED keeps the "borrow Claude's neutral chrome" philosophy from the minimal era (backgrounds/borders/text still inherit from Claude's own tokens), but drops the single-accent rule. RED now has one brand color (indigo) plus a small, meaningful set of status colors (good/warning/issue/info) used consistently wherever something is being scored or flagged.

> Note: the "single accent, never decorative" rule from the previous revision is retired. Status colors are now tier-driven by actual values, not a single always-red flag color.

---

## 1. Design Philosophy

- **Neutral chrome stays borrowed.** Panel background, borders, and body text still come from Claude's own computed styles wherever possible.
- **Color now carries meaning, deliberately.** A small fixed palette of tiered status colors used *consistently* — the same teal/amber/red/blue mapping everywhere a score or issue appears, never an arbitrary decorative choice.
- **One brand color, used for brand + primary actions.** Indigo (`#534AB7`) is RED's own color — logo, primary buttons, links, active states — distinct from the status-tier colors.
- **Compact floating card, persistent until toggled.** RED is a fixed-position card anchored top-right, always visible once opened, toggled by the indicator badge. It does NOT close on outside clicks.

---

## 2. Design Tokens

### Sourcing strategy
Read Claude's actual computed styles (background, border, text, font, radius) from a native Claude element via `getComputedStyle` wherever possible. Hardcoded values below are fallbacks only.

### Borders, shadow, radius
```css
border: 1px solid var(--red-border, rgba(0,0,0,0.08));   /* light fallback */
border: 1px solid var(--red-border, rgba(255,255,255,0.12)); /* dark fallback */
box-shadow: 0 4px 20px rgba(0,0,0,0.12);
border-radius: 10px;  /* card container */
border-radius: 8px;   /* buttons, inputs, prompt/refined boxes */
border-radius: 6px;   /* badges, chips, small elements */
```

---

## 3. Color Palette

| Role | Color(s) | Usage |
|---|---|---|
| Background / border / text (neutral chrome) | Borrowed from Claude's own tokens | Card background, dividers, body text |
| **Brand (indigo)** | Fill `#534AB7` · light tint `#EEEDFE` · tint text `#3C3489` | Logo, primary action button, refined-box accent border, links, active tab/pill state |
| **Status — High / Good** | Fill `#1D9E75` · light bg `#E1F5EE` · text `#085041` / `#0F6E56` | Score ≥80, positive deltas |
| **Status — Medium / Warning** | Fill `#EF9F27` · light bg `#FAEEDA` · text `#633806` | Score 50–79, vague-language/filler-word flags |
| **Status — Low / Issue** | Fill `#E24B4A` · light bg `#FCEBEB` · text `#791F1F` / `#A32D2D` | Score <50, specificity/redundancy issues |
| **Status — Info** | Light bg `#E6F1FB` · text `#0C447C` | Informational suggestions (not a problem, just a tip) |

**Score tiers:** High ≥80, Medium 50–79, Low <50 — single source of truth project-wide.

**Rule:** status colors assigned by actual score/value only, never decoratively. Indigo reserved for brand + primary-action moments only.

---

## 4. Typography

- Inherit Claude's `font-family` directly.
- Weights: 400 body, 500 for titles/values/buttons.
- **Prompt box and refined prompt box:** `font-family: monospace` for prompt text content.

---

## 5. Placement & Architecture

RED is a **persistent floating card** anchored top-right of the viewport, toggled by a small indicator badge. It does NOT auto-dismiss on outside clicks — it stays visible until the user explicitly closes it via the badge or the × icon.

### Indicator badge (always visible)
- Small circular badge (~40px), `position: fixed`, `top: 60px`, `right: 12px`
- Indigo background, wand icon
- Once an analysis exists: thin colored ring in current score's tier color
- Click → toggles card open/closed
- Badge position does NOT change when card opens/closes — always `top: 60px, right: 12px`

### Full card
- `position: fixed`, `top: 110px`, `right: 12px`, `width: 320px`
- `height: auto`, `max-height: calc(100vh - 130px)`, `overflow-y: auto`
- `border-radius: 12px`, soft shadow
- Slides in from right on open (~200ms ease-out), slides out to right on close
- Closes ONLY via: × icon in header, or clicking the indicator badge again
- **No click-away dismissal** — outside clicks do not close the card
- Card overlaps Claude's page content (acceptable — not permanently docked)
- No `margin-right` injection on Claude's layout

---

## 6. Components

### 6.1 Card Header
- Logo: 28px rounded-square, indigo background, wand icon in light tint
- Title ("RED") + subtitle ("claude.ai extension"), small badge (version/plan) pushed right
- Close (×) icon far right — clicking closes the card

### 6.2 Score Circle + Tier Label + Metric Bars
- **Score circle**: 52px circle, 3px border in tier color, large number + small "SCR" label inside, colored to match tier
- **Tier label row** (below circle): "[TIER] ≥ [THRESHOLD]" in tier fill color + colored dot + word label
  - High ≥80 → teal + "GOOD"
  - Medium 50–79 → amber + "WARNING"  
  - Low <50 → red + "ISSUE"
  - Example: "HIGH ≥ 80  · GOOD"
- **Summary sentence** (below tier label): small muted text
  - "X of 4 metrics at target. [Lowest metric] at [value] — needs improvement."
  - All ≥80: "All metrics at target. Prompt looks great."
- **Four metric bars**: label → track (5px height) → fill (tier-colored by own score) → numeric value
  - Metrics: Clarity, Context richness, Token efficiency, Specificity

### 6.3 Prompt Box
- Bordered, neutral-background box with user's prompt text in **monospace font**
- Inline `<span>` highlights:
  - **Highlight** (amber bg/text) — phrases worth flagging
  - **Redundant** (red bg/text, strikethrough) — filler words to cut

### 6.4 Token Display
- Single plain text line directly below the prompt box (no chip row, no icons)
- Format: "36 tokens · $0.000029"
- Style: 11px, muted color, no border

### 6.5 Issues List
- **Inline pill chips** — not full block cards
- Each chip: icon + bold label only (no explanation body text)
- Warning chip: amber bg (`#FAEEDA`), amber text (`#633806`), ⚠ icon + label (e.g. "Vague scope")
- Info chip: blue bg (`#E6F1FB`), blue text (`#0C447C`), ℹ icon + label (e.g. "Add context")
- Chips sit inline, `flex-wrap`, `gap: 8px`

### 6.6 Refined Output
- Header row: sparkle icon (indigo) + "Refined prompt" title + "+N pts" badge (teal, only shown when delta is a valid finite number — hidden before any refine runs)
- Refined box: neutral background, **indigo left border**, refined text in **monospace font**
- No word-level diff

### 6.7 Footer Actions
- **Paste**: outline button, indigo text/border
- **Re-refine**: primary filled button, indigo background
- Both `border-radius: 8px`, no shadow
- Hidden until a refine result exists

### 6.8 History List (deferred — Stage 8)
- Each row: tier-colored score badge + truncated prompt + meta (time, tokens) + status badges + chevron

### 6.9 Popup (Account/Login)
- Login form: email/password + Google OAuth button
- Logged-in view: Plan (Free/Premium), today's quota (X/10 or X/300), Upgrade button (free only), Refresh, Sign out
- Indigo for primary actions only — no status-tier colors on this surface

---

## 7. Icons

- **Tabler Icons** (`ti ti-*` classes), vendored locally — never loaded from a runtime CDN in the shipped extension.

---

## 7.5 Illustrations

- Not used. Drop illustration system entirely.

---

## 8. Motion

- Card open/close: slide from right (~200ms ease-out / ease-in)
- Score bar fills: animate width on update (~200ms ease-out)
- Indicator ring: fade/transition color when score changes

---

## 9. Theme Adaptation

- Neutral chrome borrowed from Claude's computed styles.
- Brand indigo and four status-tier colors stay constant across light/dark.

---

## 10. Accessibility

- Verify contrast for all five colors against both light and dark backgrounds.
- Status communicated by color + text/icon together, never color alone.
- Visible focus outline on all interactive elements (2px indigo).

---

## 11. Consistency Checklist

- [ ] Neutral chrome (background/border/text) borrowed from Claude's tokens, hardcoded fallbacks only?
- [ ] Status colors assigned strictly by score tiers (High ≥80 / Medium 50–79 / Low <50)?
- [ ] Indigo (`#534AB7`) reserved for brand + primary actions only?
- [ ] Indicator badge always visible at `top: 60px, right: 12px`, position unchanged by card state?
- [ ] Card only closes via × icon or badge click — no click-away dismissal?
- [ ] Card positioned `top: 110px, right: 12px, width: 320px, height: auto`?
- [ ] Score section includes tier label row + summary sentence?
- [ ] Prompt box and refined box use monospace font?
- [ ] Token display is plain text line (no chip row)?
- [ ] Issues rendered as inline pill chips (not block cards)?
- [ ] "+N pts" badge hidden until a valid refine result exists?
- [ ] Status communicated by color + text/icon together, never color alone?
- [ ] Icons from Tabler Icons, vendored locally?

If any answer is no, the component needs another pass.
