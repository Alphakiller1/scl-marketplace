# SCL Accessibility & Performance

Trust and premium feel depend on both. These are quality gates, not nice-to-haves.

## Accessibility (target WCAG 2.1 AA)

- Semantic HTML and landmarks (`header`, `nav`, `main`, `footer`); logical heading order.
- Every input has a programmatic label; icon-only buttons use `aria-label`.
- Visible focus rings (`outline-ring`); full keyboard operability; no keyboard traps.
- Color is never the only signal — pair `pos`/`neg`/`live` with text/icons (e.g. W/L/P pips
  show the letter, status badges show a word).
- Contrast AA on all surfaces, including colored stats on dark navy.
- `prefers-reduced-motion`: disable non-essential motion.
- Announce async results (toasts are polite live regions); don't rely on motion to convey state.

## Performance

- **Server-first:** Server Components by default; fetch on the server; avoid client waterfalls.
- `"use client"` only for genuine interactivity; keep client bundles small.
- Images sized + `next/image`; fonts via `next/font` (no FOUT/CLS).
- Target: fast LCP, near-zero CLS, minimal main-thread work. Leaderboards must stay snappy with
  100s of rows — paginate / virtualize when needed; compute aggregates in the DB, not the client.
- Cache and revalidate intentionally (Next caching + TanStack Query staleTime).
- Avoid heavy shader/animation on data-critical screens.

## Browser zoom

Browser zoom scales CSS pixels. Layouts stay proportional when:

1. **Root type is `html { font-size: 100% }`** — rem tracks the user’s zoom/default font.
2. **Grids use `minmax(0, …fr)`** — never hard floors like `minmax(26rem, …)` that refuse to
   shrink when zoom shrinks the effective viewport.
3. **Flex children that truncate have `min-w-0`** — otherwise long handles blow the row.
4. **Rows use `min-h-*`, not fixed `h-*`** — wrapped labels can grow instead of clipping.
5. **Page shells do not use `overflow-x-hidden`** — clip hides broken overflow; scroll or
   reflow instead. Wide Rank tables may use `overflow-x-auto` _inside_ their own shell.

Verify at 125% / 150% / 175% on ~375 and ~1280 CSS widths before shipping layout PRs.

## Verification

- Lighthouse / Web Vitals sanity check on key pages before merge.
- Playwright smoke tests for the core flows (see SCL_AGENT_WORKFLOW).
- Sentry (once wired) must be clean of new errors after deploy.
