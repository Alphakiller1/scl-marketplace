# SCL Design Specification — v2.0 "The Ledger & The Board"

**This file is LAW. Models apply it; they do not reinterpret it. Supersedes and retires v1.1.2.**

Change from v1.x: numeric values gain a green→amber→red performance spectrum (distinct
from discrete settlement colors); Settlement Gold stays removed; four named visual modes;
mockup odds-chip; "Track Your Record" recruitment CTA; the owner-approved hero carousel is
retained. See "Numeric color system" and "Visual modes" for the load-bearing changes.

## Identity thesis

SCL is a verified capper marketplace. Its visual world is the bet ticket, the settlement
ledger, and the odds board. Everything a capper does becomes inspectable evidence — records,
receipts, CLV, samples, movement. Commerce is downstream of proof. The signature component is
the Proof Receipt: a bet-receipt with a perforated tear line and a pink VERIFIED stamp.

## Visual modes (every surface declares one)

Modes share tokens; they differ in composition, density, and texture.

- **Live** — home, odds board, pick stream. Scanline texture, cobalt time rails, minimal
  cards, timestamps/market status prominent.
- **Proof** — receipts, verification history, audit. Warm ticket paper, tear lines, stamps,
  evidence IDs, calm forensic spacing.
- **Rank** — leaderboards, seasons. Rank rail at left, right-aligned metrics, dense rows,
  performance ramp, earned color only.
- **Studio** — New Pick, dashboard, profile/offer editing. Neutral surfaces, persistent
  action summary, preview/evidence always visible.

## Color role rules

- **Pink = conviction** — primary CTA, selected odds chips, VERIFIED badge/stamp + the
  verified-% meter, rank 1–3 medals, combined-odds figures, section-head hairlines, slip
  accents, logo mark.
- **Blue = navigation** — active nav/sport pill, selected book rail, segmented view/scope
  switches, focus ring, links inside evidence.
- **No Settlement Gold, ever** (`#E9B64B`/`#B98F2E`/…). Rank medals are pink; the rank crown
  renders pink, never gold.
- Never mix pink fill + blue fill on one control. Off-role pink/blue is a spec violation.

## Numeric color system (v2 core change) — two orthogonal systems, never conflated

**A. Settlement semantic (discrete, result-only).** `--scl-win`/`--scl-loss`/`--scl-push`
appear ONLY on graded outcomes: Win/Loss/Push pills, a single graded play's unit delta,
W/L/P form dots, and the PRE-GAME ✓ verify chip (win-green). This is the scarce, trusted
signal — it means a real result settled.

**B. Performance spectrum (continuous, magnitude).** ROI, Units, CLV, win% render on a
green→amber→red ramp keyed to magnitude (`--scl-perf-strong/-mid/-weak`). Strong = green,
mid = amber, weak/negative = red.

- Thresholds live in ONE shared module (`lib/perf-scale.ts`), never hardcoded per component.
- Color is never the only signal — the number itself is always shown (WCAG 1.4.1); ramp is
  luminance-stepped for deuteran/protan safety; test forced-colors.
- Amber is a data-magnitude color only — never rank, status, honor, or decoration. This is
  what keeps it distinct from the removed Settlement Gold (a status color).
- Sample maturity (Established/Developing/Early) uses the same ramp for "more picks = greener,"
  but Early caps at amber, never red — immaturity is not failure.

## Tokens (globals.css :root / .dark) — unchanged from v1 except the perf ramp

```
--scl-ink-950:#07090F; --scl-ink-900:#0C111B; --scl-ink-800:#121A28;
--scl-ink-700:#1B2536; --scl-ink-600:#26334A; --scl-line:#243045;
--scl-text:#EDF1F7; --scl-muted-label:#7E8AA0; --scl-muted-data:#AAB6C9;
--scl-pink:#BA008E; --scl-pink-deep:#8D006A; --scl-pink-ink:#FFF3FC;
--scl-blue:#105FD9; --scl-blue-deep:#0043AC; --scl-blue-ink:#F1F9FF;
--scl-win:#2FBF7B; --scl-loss:#E5484D; --scl-push:#8B97AB;
--scl-perf-strong:#2FBF7B; --scl-perf-mid:#E6A93C; --scl-perf-weak:#E5484D; /* tune in review */
--scl-radius-card:14px; --scl-radius-chip:10px; --scl-radius-receipt:6px;
--scl-shadow-card:0 8px 24px rgba(0,0,0,.35); --scl-shadow-slip:0 12px 30px rgba(0,0,0,.55);
```

Light theme is "Ticket Paper" (page `#F3F1EA`, card `#FFFFFF`, ink `#161B26`, rules `#D8D3C4`,
pink `#A6007F`, blue `#044CB6`). Perf-mid deepens to ~`#B5791E` on paper.

## Typography

Families: **Barlow Condensed** 600/700 (display — headings, team names, big numbers, section
titles). **Barlow** 400–700 (UI/body — copy, buttons, labels). **Inter** 500/600/700 with
`tabular-nums lining-nums` for EVERY odds/line/unit/ROI/%/record/timestamp — no exceptions,
no mono. Eyebrows: Barlow 9–10px uppercase ls .16–.18em.

**Uppercase budget:** uppercase is an accent (eyebrows, stamps, rank labels, short section
IDs, board abbreviations) — never headings, helper text, long buttons, or paragraphs. Product
headings are sentence case.

**Type scale:** hero 56/56 desktop · 38/40 mobile · ≤2 lines; page title 40/44; section 22/26;
card 16/22; body 16/24 @ 58–66ch; label 11/14 uppercase ls .10; metrics Inter tabular — hero
28, card 18, row 14, right-aligned.

**Numeral rules:** always show `+` on positive odds/ROI/units; one-decimal ROI; consistent
unit precision per column; en-dash records (`18‑12‑1`); CLV states its basis; timestamps carry ET.

## Conviction scarcity rule

Pink only on conviction surfaces; blue only on navigation surfaces; everything else uses
ink/text/muted tokens or the performance ramp. Off-role pink/blue is a violation.

## Texture

- **Scanline** — board/pick-flow containers only:
  `repeating-linear-gradient(0deg, rgba(255,255,255,.012) 0 1px, transparent 1px 4px)`.
- **Ticket paper** — the warm light surface, used for Proof Receipts and expanded proof even
  inside dark UI (≤1.5% mono grain). The signature contrast artifact.
- **Marketing surfaces** may add ≤3% noise. Nothing else. (Ledger-grid is Explore — not
  sanctioned until prototyped and versioned.)

## Grid & alignment

12-col desktop, 8/4 primary+rail, max 1200px, gutters 16/24/32. Right-align every comparable
number; numeric columns fixed-width, identity flexible; rank in a fixed 48px left column;
consistent decimals per column; labels align to their values. Vertical rhythm: title→content
32, section 64/40, label→value 4, row padding 18–20/14–16.

## Border / shadow / radius grammar

A border must answer one of: region-end (structural hairline) · interactive (rest→hover→focus
ring) · conviction (pink, one primary per region) · evidence (receipt solid + dashed + notches)
· settlement (win/loss/push 3px left rule on resolved cards — never flood the whole card).
Radius roles: receipt 6 · row/input 8 · control 10 · card 14 · marketing 20. Shadow: static
data = hairline only · hover = lift · slip/tray = floating · receipt/modal = strongest. No
stacking border+shadow+glow on routine objects.

## Text-contrast tiers

label `#7E8AA0` (dark) / `#6E7686` (light, large ≥18px/bold only) · supporting prose
`#AAB6C9` (dark) / `#596273` (light) · primary prose `#D8DFEA` · heading `#EDF1F7` (dark) /
`#161B26` (light). Never use the label color for full sentences.

**Conviction/navigation hues (pink/blue) are for marks, fills, carets, focus, and
underlines — never small text. Small text uses the text/supporting tiers. Every
normal-size text/background pair must pass 4.5:1 in both themes.**

Do not invent `--scl-blue-text` unless a genuine accessible blue text token (≥4.5:1 on
ink) is required and documented here first. Prefer `--scl-text` + blue underline
(`.scl-link`) for links.

## Component recipes

- **CARD** — bg ink-800, 1px line, radius-card, shadow-card.
- **CHIP (odds)** — bg ink-700, 1px line, radius-chip, min-height 44px; single row shows selection then odds. SELECTED: pink fill, pink border, pink-ink text, ring 0 0 0 2px ink-950.
- **SEGMENTED CONTROL** — track ink-800 + line, radius 10px; active segment blue (navigation).
- **SPORT PILL** — 44px, radius 22px, ink-800; active blue. Zero-count opacity .42, still tappable.
- **BOOK RAIL** — sport-pill geometry; profile multi-select blue; board head single-select drives odds.
- **EVENT ROW** — [4px team-color bar][team lines][right-aligned mono moneylines]; meta
  "7:00 PM ET · PRE-GAME ✓(win-green)".
- **SECTION HEAD** — pink-deep 1px top hairline + Barlow Condensed uppercase title + right mono
  context label. Full treatment for major sections only; minor sections = typography + spacing.
- **PROOF RECEIPT (signature — one canonical component; merge `ticket.tsx` + `verification-receipt.tsx`)**
  — mono eyebrow "SCL · PROOF RECEIPT"; selection title Barlow Condensed 700; pink VERIFIED
  stamp (rect 6px or round rubber-stamp variant, rotate 6°, top-right); dashed tear line with
  two 18px circular notches; capture block "ODDS CAPTURED … / SOURCE: <BOOK> · GRADES
  AUTOMATICALLY(win-green)"; fields: captured odds, closing line + CLV (honest em-dash when
  uncaptured), result, Evidence ID. **State machine:** Capturing → Captured/Pending →
  Line-moved → Live → Awaiting-grade → Won/Loss/Push/Void → Corrected/Disputed →
  Source-unavailable. One schema; recognizable in every state and in dark / paper / mobile /
  share-image / text-only.
- **VERIFIED BADGE** — pink shield + meter FILL in pink; the % numeral renders in the
  text tier (`--scl-text`), never pink fill-as-text. Keep the %.
- **STICKY SLIP BAR (mobile)** — fixed bottom, 56px, radius 14px, pink-deep border, the one
  permitted gradient, shadow-slip. Owns the bottom of the screen; the Compare tray yields to it.
- **LEADERBOARD (Rank mode)** — columns: Rank · Capper · Sports · Record · ROI · Units ·
  Sample(maturity meter) · Verified(pink) · Form(W/L dots). Every metric column is click-to-sort
  (active sort = blue caret). Expand 10 → 20 → 50. Persistent time-scope (7D/30D/90D/All) +
  sport/rank-by/min-sample/verified-only filters in a compact scope bar (never taller than the
  results). ROI/Units on the perf ramp. **Rank rail:** current rank, Δ vs previous (↑/↓/—) with
  magnitude, provisional marker; animate only on a real change (240ms).
- **PLATFORM REPORT** — "most successful bet types": aggregate across active cappers by shape
  (Singles/Parlays) and market (Sides/Totals/Props/Futures), each with sample + performance on
  the ramp; honest per-category empties; eligibility footnote matching the leaderboard predicate.
- **CLV TRACKER** — platform + per-capper: avg CLV, % beating close, distribution; gated by the
  provisional sample threshold; framed strictly as a pricing metric (price vs market close),
  never predictive.
- **TRUST LENS** — Simple / Analyst / Audit tabs on profiles (WAI tabs pattern); persist choice;
  never hide risk/purchase disclosures behind expert modes.
- **COMPARE TRAY** — pin ≤3 cappers; aligned, identically-scoped columns; subordinate to the mobile slip.

## Motion (complete list — nothing else animates; all gated behind prefers-reduced-motion)

Chip select 150ms · Verified stamp scale1.15→1/rotate12→6° 400ms · Board sport-switch crossfade
200ms · Reveal-in (opacity/8px translate) 440ms · Interactive hover-lift translateY(-2px) 200ms
(hover devices only) · Ticker marquee (paused on hover/focus) · Row expand 180–240ms · Tray/sheet
slide 180–240ms · Trust-Lens tab change · Line-moved sheet. Reduced-motion renders final state.

## One-question-per-page

Each surface answers one question in ~5s and promotes that answer above all else — Home: who's
worth inspecting + why trust SCL; Leaderboard: who ranks highest in this scope + how credible;
Profile: is this record credible + relevant; New Pick: what am I committing to + what proof is preserved.

## Navigation, copy & brand

- Nav: **Picks · Leaderboard · Discover**. Logo: the current `scl-logo.tsx` mark (do not vary).
- Primary capper-recruitment CTA: **"Track Your Record"** (retires "Become a Capper"). Sign-in
  entry may remain "Log in / Join SCL".
- Homepage hero = the existing owner-approved carousel, word-for-word. Evidence modules
  (leaderboard snapshot, featured Proof Receipt, "What changed today") sit around/below it — they
  do not replace it.

## Data honesty rule

The mockups depict a mature-data state. Every component MUST also render honest-empty (em-dash),
provisional, early-sample, and awaiting-grade states. No metric is ever fabricated or implied —
specifically no dollar "handle," no invented volume, no green number without a real graded result
behind it. Data absent → labeled em-dash, never a zero styled as data.

## Voice

Sentence-case buttons. Errors name the fix. Empty states always route somewhere. No
"lock/guaranteed/risk-free." Responsible-gaming access persistent in footer and near commerce.
