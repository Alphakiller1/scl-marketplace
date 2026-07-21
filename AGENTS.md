<!-- BEGIN:nextjs-agent-rules -->

# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` before writing any code. Heed deprecation notices.

<!-- END:nextjs-agent-rules -->

# SCL — Agent Guide

This file is the shared source of truth for **every** AI agent working in this repo
(Claude Code, Cursor, Copilot, etc.). Read it before writing code. `CLAUDE.md` and
`.cursor/rules/` both point back here.

## What we're building

**SCL (Sports Capper Leaderboard)** — a marketplace where sports cappers sign up, log every
play, earn a **verified, auto-graded track record**, climb a public leaderboard, and sell
packages to followers. We are building a product that competes with established capper
platforms from day one: fast, polished, mobile-first, and trustworthy.

The bar: **every screen should look and feel like a top-tier modern SaaS product.** If a
change makes the app slower, less accessible, or less polished, it's wrong.

## Stack (do not swap without an OWNER decision)

- **Next.js 16** App Router + **React 19** + **TypeScript** (strict)
- **Tailwind CSS v4** + **shadcn/ui** (Base UI primitives) + `next-themes` (dark default)
- **Prisma 6** + **PostgreSQL** (Supabase) — SCL lives in the isolated **`scl`** schema
- **Auth.js (NextAuth v5)** — credentials + email verification; `CAPPER` / `ADMIN` roles
- **TanStack Query** (client data) + **TanStack Table** (grids/leaderboard)
- **react-hook-form + Zod** (forms + validation; share Zod schemas client & server)
- **Recharts** (charts), **Motion** (animation), **lucide-react** (icons)

## Architecture & conventions

- **App Router only.** Server Components by default; add `"use client"` only when you need
  interactivity, hooks, or browser APIs. Keep client bundles small.
- **Data access on the server.** Query Prisma in Server Components, Route Handlers, or
  Server Actions — never expose the DB client to the browser. Import the singleton from
  `@/lib/prisma`.
- **Folder layout:**
  - `src/app/` — routes. Group by audience: `(marketing)`, `(auth)`, `(capper)`, `(admin)`.
  - `src/components/ui/` — shadcn primitives (generated; avoid hand-editing).
  - `src/components/` — app-specific composed components.
  - `src/lib/` — server/util modules (`prisma.ts`, `auth.ts`, validation schemas, odds, grading).
  - `prisma/` — schema + migrations.
- **Validation:** define a Zod schema per input; reuse it in the form (`react-hook-form` +
  `@hookform/resolvers/zod`) and again on the server before any DB write. Never trust client input.
- **Forms/mutations:** prefer **Server Actions** for writes; use Route Handlers for webhooks
  and third-party callbacks. Always return typed, user-safe errors.
- **Money & odds:** odds are American integers (e.g. `-110`, `+150`); units/stakes are
  `Decimal(10,2)`. Centralize P/L math in `src/lib/grading` — never inline payout math in a component.
- **Naming:** components `PascalCase`, files `kebab-case.tsx`, hooks `use-*.ts`,
  server actions `*.action.ts`, Zod schemas `*.schema.ts`.

## Design system & product docs (read before building UI)

The visual law and product foundation live in `docs/` — `SCL_DESIGN_CONTRACT.md` (tokens,
typography, motion), `SCL_COMPONENT_SYSTEM.md` (the SCL-native components in
`src/components/scl/`), `SCL_PHASE_1_PRODUCT_SPEC.md` (pages + IA), `SCL_UI_QUALITY_CHECKLIST.md`
(the gate), plus mobile-first, a11y/perf, data-contract, competitor, and agent-workflow docs.
**Build features from `src/components/scl/*`, not raw shadcn.**

## UI / UX rules (this is how we compete)

- **shadcn uses Base UI, not Radix.** Polymorphism is the **`render` prop**, NOT `asChild`.
  Example: `<Button render={<Link href="/x" />}>Label</Button>`.
- **Mobile-first.** Build the small-viewport layout first, enhance with `sm:`/`md:`/`lg:`.
  Tap targets ≥ 40px. No horizontal overflow. Test at 375px width.
- **Use design tokens**, never hard-coded colors. Use `bg-background`, `text-foreground`,
  `text-muted-foreground`, `border-border`, `bg-primary`, etc. Respect light & dark.
- **Accessibility is non-negotiable:** semantic HTML, labelled inputs, `aria-*` where needed,
  visible focus states, keyboard navigable. Icons that convey meaning get `aria-label`.
- **Loading & empty & error states for every async surface.** Use `Skeleton` for loading,
  a thoughtful empty state, and inline errors. Use `sonner` (`toast`) for action feedback.
- **Motion is subtle.** Use `motion` for micro-interactions and page transitions; never
  block interaction or cause layout shift. Respect `prefers-reduced-motion`.
- Prefer existing shadcn components; add new ones with `npx shadcn@latest add <name>`.

## Quality bar (must pass before a PR)

Run and keep green:

```bash
npm run typecheck   # tsc --noEmit
npm run lint        # eslint
npm run format      # prettier --write
npm run build       # next build
```

- **No `any`.** No `@ts-ignore` without a one-line justification. No unused exports.
- Keep components small and composable. Extract logic into `src/lib`. No dead code.
- Pre-commit hooks run lint + format on staged files; CI re-checks lint/typecheck/build on PRs.

## Security & data

- **Never commit secrets.** All secrets live in `.env` (gitignored). Update `.env.example`
  (with placeholders) whenever you add a new env var.
- SCL data is isolated in the **`scl`** Postgres schema. **Never** read from or write to the
  `public` schema (that is a separate analytics database sharing the instance).
- Hash passwords with `bcryptjs`. Enforce auth + role checks on every gated route/action —
  do not rely on hiding UI. Gated capper actions also require a **verified email**.
- Validate and sanitize all external input. Rate-limit public mutation endpoints.

## Workflow

- `main` is the trunk. **Never push to `main`** — branch, then open a PR.
- Branch names: `feat/<slug>`, `fix/<slug>`, `chore/<slug>`.
- Reference the GitHub issue (`#N`). Phase 1 features and prompts live in the separate
  `SCL` planning workspace (`_prompts/`, `SCL_PHASE_1_COMMAND_CENTER.md`).
- Keep PRs focused and reviewable. Update docs/`.env.example` in the same PR as the code.

## When unsure

Read the actual files (especially `node_modules/next/dist/docs/` for Next 16 APIs and the
existing `src/components/ui/*` for component APIs) before guessing. Match the patterns
already in the repo.

## Cursor Cloud specific instructions

- **Dev server:** `npm run dev` (Next on port 3000). Quality scripts are in the Quality bar above
  and `package.json`.
- **Postgres:** local Ubuntu cluster — `sudo pg_ctlcluster 16 main start` if queries fail.
  Schema is `scl` only; use `npm run db:push` / `npm run db:seed` against local `.env`.
- **Home / leaderboard query soft-fail:** if surfaces show “Couldn't load…”, apply additive
  SQL from `docs/qa/SUPABASE_SQL_PATCHES.md` (especially `User.isTest` and
  `Play.closingOddsAmerican`) then restart `npm run dev` so schema-feature caches refresh.
- **Mockup fidelity:** hero CTA language is locked in `design/MOCKUP_FIDELITY_HOME_CONTRACT.md`
  — do not rewrite slide eyebrows/titles/bodies/CTAs/hrefs.
- **Auth host gotcha:** `.env` sets `AUTH_URL=http://localhost:3000`. Browse and sign in via
  `http://localhost:3000`, not `http://127.0.0.1:3000`, or Auth.js cookies/session will not
  stick and login will look broken.
- **Seed logins (local):** `admin@scl.local` / `admin1234`, `capper@scl.local` / `capper1234`.
- **Pick entry:** board-verified logging needs `ODDS_API_KEY` in `.env`; without it the board
  rejects free-text event entry.
- **IA / structure notes:** see `docs/SCL_STRUCTURE_AUDIT.md` for the latest public + capper
  workspace structure audit and roadmap.
