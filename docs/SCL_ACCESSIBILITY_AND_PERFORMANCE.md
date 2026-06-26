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

## Verification

- Lighthouse / Web Vitals sanity check on key pages before merge.
- Playwright smoke tests for the core flows (see SCL_AGENT_WORKFLOW).
- Sentry (once wired) must be clean of new errors after deploy.
