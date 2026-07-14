# SCL Design Contract

The non-negotiable design language. Every screen inherits this. If a change violates the
contract, it does not ship. This is enforced in `.cursor/rules/scl-design-system.mdc`.

## Identity

SCL is **the public performance layer for sports handicappers** — the most credible place to
discover who is actually winning. Mood: _Bloomberg Terminal for cappers × Apple Sports clarity
× Linear polish × DraftKings energy._ Premium, fast, sports-native, trustworthy, status-driven,
data-rich, mobile-first, dense but never cluttered.

We are **not**: a generic SaaS landing page, a casino, a crypto dashboard, a fantasy template,
a spreadsheet, a WordPress sports blog, or a default shadcn / AI-template clone.

**Signature system (July 2026):** _The Ledger & The Board_ — blue-cast ink surfaces, scarce
**Settlement Gold**, condensed display + monospace data faces, and the **Ticket** receipt as
the trust-model visual.

## Color system (tokens only — never raw hex/Tailwind palette colors)

Defined in `src/app/globals.css`, dark-mode first (`--scl-*` foundation → semantic aliases).

| Token                                             | Utility                 | Job                                                                          |
| ------------------------------------------------- | ----------------------- | ---------------------------------------------------------------------------- |
| `background` / `card` / `surface-2` / `surface-3` | `bg-*`                  | Blue-cast **ink** ladder (`--scl-ink-950`…`700`) — never pure black          |
| `border` / `border-strong`                        | `border-*`              | Hairlines (`--scl-line`); strong carries gold depth                          |
| `brand` / `primary` / `gold` / `live`             | `text-*`, `bg-*`        | **Settlement Gold** — CTAs, selection, verification, rank, combined odds     |
| `pos`                                             | `text-pos`, `bg-pos/15` | Graded **wins** / +units / +ROI only — never decoration                      |
| `neg`                                             | `text-neg`, `bg-neg/15` | Graded **losses** / −units only — never decoration                           |
| `push`                                            | —                       | Push/void neutral                                                            |
| `muted-foreground`                                | `text-muted-foreground` | Labels (`--scl-muted-label`); data values prefer `--scl-muted-data` via mono |

Rules: Gold is **scarce**. No pink/cyan identity accents. No decorative orbs/glass. Board
surfaces may use `.scl-scanline`. Gradients are not brand identity — gold text via
`.scl-brand-text` is solid Settlement Gold.

## Typography

Three purposeful faces (loaded in `src/app/layout.tsx`):

| Role    | Face             | CSS                                   |
| ------- | ---------------- | ------------------------------------- |
| Display | Barlow Condensed | `--scl-font-display` / `.scl-display` |
| UI      | Barlow           | `--scl-font-ui`                       |
| Data    | IBM Plex Mono    | `--scl-font-data` / `.scl-data`       |

**Every** odds, line, spread, total, units, ROI %, win %, record string, and timestamp uses
`.scl-data` (mono + `tabular-nums`). Eyebrows use `.scl-eyebrow` (mono, 9–10px, tracked,
uppercase).

## Spacing, radius, surfaces

- Card radius `--scl-radius-card` (14px). Chip radius `--scl-radius-chip` (10px).
- Layered depth: page → section → card → raised chip. Use elevation to group.
- Content max width `max-w-6xl`, page padding `px-4 sm:px-6`.

## Motion (subtle, meaningful — `motion`)

Allowed only for: Ticket settling stamp, rank movement, live status, pick status change,
filter transitions, card expansion, profile stat reveal, loading skeletons. Never decorative
orbs. Respect `prefers-reduced-motion` (Ticket settles immediately).

## Status & verification language

Trust is the product. The **Ticket** (`src/components/scl/ticket.tsx`) is the post-submit
ceremony and landing hero signature. Always show verification, grade status, and source
transparency. Never imply sportsbook sync or verification we don't have.

## Required states

Every async surface ships with **loading** (`Skeleton*`), **empty** (`EmptyState`), and
**error** (inline + `toast`) states. No exceptions.
