# SCL UI Quality Checklist

No Phase 1 UI work is "done" until it passes every gate. Reviewers paste this into the PR.

## Visual / brand

- [ ] Uses SCL **tokens only** (no raw hex, no Tailwind palette colors like `zinc-900`)
- [ ] Dark mode is first-class and correct; light mode also correct
- [ ] No default-shadcn look; no generic SaaS sections; no casino/crypto/fantasy vibe
- [ ] Numbers use `tabular-nums` and are sign-toned (pos/neg) where signed
- [ ] Hierarchy reads instantly: rank, name, key stat, secondary metadata
- [ ] Every color has a job; no decorative gradients/glow beyond `.scl-glow`

## Responsive

- [ ] Designed mobile-first; verified at 375px (no horizontal overflow)
- [ ] Tables have a real **mobile card** equivalent (not a squished table)
- [ ] Tap targets ≥ 40px; sticky actions where useful
- [ ] Tablet checked where relevant

## States

- [ ] Loading state (`Skeleton*` matching real layout)
- [ ] Empty state (`EmptyState` with helpful copy + action)
- [ ] Error state (inline message + `toast`)
- [ ] Live/pending/graded states correct where applicable

## Accessibility

- [ ] Semantic HTML; landmarks; logical heading order
- [ ] All inputs labelled; icon-only buttons have `aria-label`
- [ ] Visible focus states; fully keyboard navigable
- [ ] Contrast meets WCAG AA (incl. on `pos`/`neg`/`gold` surfaces)
- [ ] Respects `prefers-reduced-motion`

## Performance

- [ ] Server Component by default; `"use client"` only where needed
- [ ] No layout shift (CLS); images sized; fonts via `next/font`
- [ ] Data fetched on the server; no waterfalls; no oversized client bundles

## Engineering

- [ ] `npm run typecheck`, `lint`, `format:check`, `build` all green
- [ ] Reuses `src/components/scl/*`; new shared components documented in the Component System
- [ ] No business logic in components (compute in `src/lib`)
- [ ] Playwright covers the core flow if this touches one (see SCL_AGENT_WORKFLOW)
- [ ] CodeRabbit review addressed

## Trust

- [ ] No unverified claims (e.g. sportsbook sync) in copy
- [ ] Verification/grade/source shown honestly
