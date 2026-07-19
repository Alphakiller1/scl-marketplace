# SCL Design Contract

The non-negotiable design language. Every screen inherits this. If a change violates the
contract, it does not ship. This is enforced in `.cursor/rules/scl-design-system.mdc`.

## Identity

SCL is **the public performance layer for sports handicappers** — the most credible place to
discover who is actually winning. Mood: _Bloomberg Terminal for cappers × Apple Sports clarity
× Linear polish × DraftKings energy._ Premium, fast, sports-native, trustworthy, status-driven,
data-rich, mobile-first, dense but never cluttered.

We are **not**: a generic SaaS landing page, a casino, a crypto dashboard, a fantasy template,
a spreadsheet, a WordPress sports blog, or a default shadcn clone.

## Color system (tokens only — never raw hex/Tailwind palette colors)

Defined in `src/app/globals.css`, dark-mode first. Every color has a job:

| Token                                             | Utility                      | Job                                                                                              |
| ------------------------------------------------- | ---------------------------- | ------------------------------------------------------------------------------------------------ |
| `background` / `card` / `surface-2` / `surface-3` | `bg-*`                       | Deep **purple** base + layered surfaces (depth)                                                  |
| `border` / `border-strong`                        | `border-*`                   | Premium hairlines; `-strong` leans **blue** (nav chrome). Section conviction hairlines stay pink |
| `brand`                                           | `text-brand`, `bg-brand`     | SCL identity — **pink-magenta**. Conviction accents, verified, rank highlights                   |
| `primary`                                         | `bg-primary`, `text-primary` | **Pink** — conviction CTAs (see `design/SCL-DESIGN-SPEC.md` v2.0)                                |
| `accent`                                          | `bg-accent`                  | Purple bridge — mix of brand-pink **and** navigation-blue                                        |
| `pos`                                             | `text-pos`, `bg-pos/15`      | Positive performance (wins, +units, +ROI) — green                                                |
| `neg`                                             | `text-neg`, `bg-neg/15`      | Negative performance (losses, −units) — red                                                      |
| `live`                                            | `text-live`, `bg-live/15`    | Live/real-time chrome — **cobalt blue** (nav family; not a separate cyan)                        |
| `push`                                            | —                            | Push/void neutral                                                                                |
| `perf-*`                                          | shared performance helpers   | ROI, units, CLV, and win-rate magnitude; never rank or decoration                                |
| `muted-foreground`                                | `text-muted-foreground`      | Secondary metadata, labels                                                                       |

Rules: no random colors, no meaningless glow. Gradients are reserved for **brand identity
only** — the pink→blue `.scl-brand-text` wordmark/heading fill and the restrained pink+blue
`.scl-glow` radial / `.scl-card-gradient`. The trophy mark (`SclLogo`) carries the same
pink→blue gradient. Home hero bitmap atmosphere is **magenta chart + cobalt metal** (not
sky-blue and not pink-only). Full layer stack + design matrix:
`docs/SCL_VISUAL_IMPLEMENTATION.md`. The page feels alive through **hierarchy, data, and
status — not noise.**

## Typography

**Numbers are the product.** Stats use `tabular-nums` (helper class `.nums`) so columns align.

- Rank numbers: large, bold.
- Capper names: semibold, truncate gracefully.
- Stats (ROI/units/win%): bold, tabular, color-coded by sign.
- Labels (sport/time): uppercase, tracked, `text-muted-foreground`, ~0.7rem.
- Body: `text-muted-foreground` for secondary copy.
- Never: tiny cramped table text, inconsistent sizes, weak labels.

## Spacing, radius, surfaces

- Radius scale from `--radius` (0.7rem). Cards `rounded-xl`/`rounded-2xl`.
- Layered depth: `background` → `card` → `surface-2` → `surface-3`. Use elevation to group.
- Generous row spacing in tables; never spreadsheet-tight.
- Public product shell max width is `1400px`, with `px-4 sm:px-6 lg:px-8`.
- Auth/admin workspaces may remain narrower when the task is form-focused.

## Motion (subtle, meaningful — `motion`)

Allowed only for: rank movement, live status, pick status change, filter transitions, card
expansion, profile stat reveal, trophy moments, loading skeletons. Never decorative, never
slow hero animations, never readability-harming shaders. Respect `prefers-reduced-motion`.

## Status & verification language

Trust is the product. Always show verification (`VerificationBadge`), grade status
(`StatusBadge`), and source transparency. Never imply sportsbook sync or verification we don't
have.

## Required states

Every async surface ships with **loading** (`Skeleton*`), **empty** (`EmptyState`), and
**error** (inline + `toast`) states. No exceptions.
