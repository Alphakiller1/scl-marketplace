# SCL Design Specification — "The Ledger & The Board"

Version 1.1 — This file is LAW. Models apply it; they do not reinterpret it.

## Identity thesis

SCL is a verified capper marketplace. Its visual world is the bet ticket,
the settlement ledger, and the odds board. Conviction uses a darker pink;
navigation uses blue. Green/red are semantic ONLY (graded win/loss). The
signature component is the Ticket: a bet-receipt card with a perforated tear
line and a pink VERIFIED stamp.

## COLOR ROLE RULES (v1.1)

- **Pink = conviction** — primary CTA, selected odds chips, VERIFIED
  badges/stamps, rank 1–3 medals, combined-odds figures, section-head
  hairlines, slip-bar accents, logo mark.
- **Blue = navigation** — active sport pill, book-rail selected state,
  segmented controls that switch views/filters, other active nav chrome.
- Never mix pink fill + blue fill on the same control. Never use Settlement
  Gold (`#E9B64B` / `#B98F2E` / `#241A05` / `#C6952F`) — removed in v1.1.

Token provenance: darker pink + blue hexes are the sRGB conversion of SCL's
prior brand OKLCH (`feat/brand-pink-purple-blue`: brand `oklch(0.58 0.25 342)`,
primary `oklch(0.52 0.2 260)`), deepened for dark-board contrast per the v1.1
direction. Ink surfaces unchanged from v1.0.

## Tokens (globals.css :root / .dark)

--scl-ink-950:#07090F; /_ page — NEVER pure #000 _/
--scl-ink-900:#0C111B; /_ nav/section _/
--scl-ink-800:#121A28; /_ card _/
--scl-ink-700:#1B2536; /_ chip/input _/
--scl-ink-600:#26334A; /_ hover _/
--scl-line:#243045; /_ hairline border _/
--scl-text:#EDF1F7;
--scl-muted-label:#7E8AA0; /_ labels only _/
--scl-muted-data:#AAB6C9; /_ numeric values — must pass AA _/
--scl-pink:#BA008E; /_ conviction — darker pink _/
--scl-pink-deep:#8D006A;
--scl-pink-ink:#FFF3FC; /_ text on pink _/
--scl-blue:#105FD9; /_ navigation _/
--scl-blue-deep:#0043AC;
--scl-blue-ink:#F1F9FF; /_ text on blue _/
--scl-win:#2FBF7B;
--scl-loss:#E5484D;
--scl-push:#8B97AB;
--scl-radius-card:14px;
--scl-radius-chip:10px;
--scl-shadow-card:0 8px 24px rgba(0,0,0,.35);
--scl-shadow-slip:0 12px 30px rgba(0,0,0,.55);

## Light theme (.light overrides) — "Ticket Paper", never gray SaaS

--scl-ink-950:#F3F1EA; --scl-ink-900:#ECE9E0; --scl-ink-800:#FFFFFF;
--scl-ink-700:#F5F3ED; --scl-ink-600:#E9E5DA; --scl-line:#D8D3C4;
--scl-text:#161B26; --scl-muted-label:#6E7686; --scl-muted-data:#454E60;
--scl-pink:#A6007F; /_ deepened for paper contrast _/
--scl-blue:#044CB6; /_ deepened for paper contrast _/

## Typography (next/font/google)

Display: "Barlow Condensed" 600/700 — headings, team names, big numbers,
section titles. Uppercase for section heads, letter-spacing .06–.08em.
UI/body: "Barlow" 400/500/600/700 — paragraphs, buttons, labels.
Data: "Barlow" 500/600/700 with font-variant-numeric: tabular-nums
(and tnum/lnum features) — EVERY odds figure, line, spread, total, unit
count, ROI %, win %, record string, and timestamp. No exceptions.
Do **not** use a monospaced face for ledger numbers (IBM Plex Mono and
similar blocky monos read as generic AI-dashboard type).
Eyebrows: Barlow UI, 9–10px, uppercase, letter-spacing .16–.18em.

## Conviction scarcity rule (the identity depends on this)

Pink appears ONLY on conviction surfaces listed under COLOR ROLE RULES.
Blue appears ONLY on navigation surfaces listed there. Everything else uses
ink/text/muted tokens. If pink or blue appears off-role, it is a spec violation.

## Semantic color rule

--scl-win and --scl-loss appear ONLY on graded results (Win/Loss pills, unit
deltas, W/L form dots) and the PRE-GAME ✓ verify chip (win-green). Never as
decoration, never on CTAs, never on charts unless the chart shows P/L.

## Texture (the anti-flat-black device)

Board/pick-flow containers only: scanline —
repeating-linear-gradient(0deg, rgba(255,255,255,.012) 0 1px, transparent 1px 4px)
Marketing surfaces may add ≤3% noise. NOTHING ELSE. No other texture, ever.

## Component recipes

CARD: bg ink-800, 1px line border, radius-card, shadow-card.
CHIP (odds): bg ink-700, 1px line border, radius-chip, min-height 48px,
two rows — label (Barlow 12px, muted-data) over odds (mono 14px, text).
Hover: bg ink-600. SELECTED: bg pink, border pink, text pink-ink, "✓ "
prefix before odds, ring: 0 0 0 2px ink-950, 0 0 0 3.5px pink-deep.
SEGMENTED CONTROL: track ink-800 + line border, radius 10px, 3px padding;
active segment blue bg, blue-ink text (navigation); labels Barlow Condensed 600
uppercase; optional mono date sublabel.
SPORT PILL: 44px height, radius 22px, ink-800 + line border; Barlow
Condensed 600 label + mono count badge. Active: blue bg, blue-ink text.
Zero-count: opacity .42, still tappable.
BOOK RAIL: same geometry as sport pills; multi-select on profile uses blue
selected state. Board head single-select drives which book's odds render.
EVENT ROW: card containing [4px team color bar column][team lines][mono
moneylines right-aligned]; team line = 30px colored monogram chip (team
primaryColor, white Barlow Condensed 700 abbr) + team name (Barlow
Condensed 600 19px) + optional FAV tag (mono 8.5px, pink border);
meta line = mono 10px muted-label: "7:00 PM ET · PRE-GAME ✓(win-green)".
SECTION HEAD: pink-deep 1px top hairline, then Barlow Condensed 600
uppercase title + right-aligned mono 10px context label.
TICKET (signature): card with (a) header — mono eyebrow "SCL · PICK
RECEIPT", selection title Barlow Condensed 700 24px, mono event line;
(b) pink VERIFIED stamp: 2px pink border, radius 6px, rotate(6deg),
absolute top-right, Barlow Condensed 700 uppercase ls .16em;
(c) 3-cell mono stat row (Legs/Odds/Stake), odds value in pink;
(d) tear line: 1.5px dashed line border with two 18px circular notches
(pseudo-elements filled with the page background color);
(e) footer — mono 9px capture block "ODDS CAPTURED <MM·DD·YY HH:MM:SS>
ET / SOURCE: <BOOK> BOARD · GRADES AUTOMATICALLY(win-green)" + right
"TO WIN" label with pink Barlow Condensed value.
VERIFIED BADGE (single component, one vocabulary): "Verified" (pink shield),
"Self-reported" (neutral outline), "NN% Verified" (never abbreviate copy).
STICKY SLIP BAR (mobile): fixed bottom, 56px, radius 14px, pink-deep border,
bg linear-gradient(180deg,#1E2940,#141C2C) [the ONE permitted gradient],
shadow-slip; contents: "N LEGS" (Barlow Condensed 700) + combined odds
(mono, pink) + pink "VIEW SLIP" button.
CAPPER ROW / PICK ROW: horizontal strip recipes — land with the row
components when those modules ship; surfaces must stay token-conformant.

## Motion (complete list — nothing else animates)

- Chip select/deselect: 150ms ease background/ring.
- Verified stamp entrance: scale 1.15→1, rotate 12→6deg, 400ms ease-out.
- Board sport-switch: previous board dims to 50% under scrim, crossfade in.
- All gated behind prefers-reduced-motion (render final state).

## Voice

Sentence case buttons ("Submit play", "View slip" may be uppercase via CSS
only). Errors are specific and name the fix. Empty states always contain a
routing action. Eyebrow labels are uppercase mono.
