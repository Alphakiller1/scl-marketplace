# SCL final release review

**Date:** 2026-08-02  
**Target:** `https://scl-marketplace.vercel.app`  
**Baseline:** production `eb71ab8`  
**Scope:** public marketplace, authenticated/admin architecture, production database health, deployment path, access control, analytics integrity, responsive design, and launch operations.

## Executive assessment

The public product is visually coherent, responsive, and materially aligned with the SCL design contract. The production database is reachable and the launch schema is present. Admin routes are role-gated and expose operational controls for published plays, grading corrections, capper accounts, storefront workflow, package links, click counts, affiliate percentage, and policy revisions.

This review corrected five release-quality issues:

1. Standardized the public identity to **Sports Capper Leaderboard** while leaving legal-policy and third-party affiliate entity wording untouched.
2. Distinguished overall capper performance from package-attributed performance on the package register and replaced misleading zero/dash rows with an explicit attribution empty state.
3. Protected click analytics from prefetch, subresource, command-line, crawler, and headless traffic.
4. Removed duplicate automatic Vercel deployments and retained the deploy hook/CLI only for manual recovery.
5. Removed the obsolete migration-history repair from every build; the normal production migration deploy remains the release path.

## Visual design matrix

Scores are post-fix release judgments against the SCL design contract, not synthetic Lighthouse scores. Desktop was inspected at 1440×1000 and mobile at 375×812 in the production dark theme; automated contrast tests cover approved dark and light token pairs.

| Surface     | Desktop | Mobile | Design / trust findings                                                                                                                       | Release status        |
| ----------- | ------: | -----: | --------------------------------------------------------------------------------------------------------------------------------------------- | --------------------- |
| Home        |      90 |     89 | Clear competition hierarchy, inspectable evidence, compact live board, no horizontal overflow                                                 | Ready                 |
| Leaderboard |      92 |     92 | Desktop ledger converts to readable mobile cards; rank links and time-window controls no longer capture unrelated clicks                      | Ready                 |
| Picks       |      91 |     91 | Proof-receipt hierarchy, settlement language, and mobile density remain readable                                                              | Ready                 |
| Discover    |      89 |     90 | Lane model and full directory remain visually distinct; empty states stay honest                                                              | Ready                 |
| Packages    |      91 |     91 | Overall record and attributed package evidence are now explicitly separated; external checkout remains clearly labeled                        | Ready                 |
| Login       |      91 |     92 | Trust signals, legal path, and mobile form targets are clear                                                                                  | Ready                 |
| Admin       |      91 |     90 | Distinct Admin chrome, live release gate, operational tool cards, and owner capability matrix; authenticated visuals require an owner session | Ready with owner gate |

### Responsive and accessibility evidence

- No horizontal overflow was found on the six public routes at 375 px.
- Mobile list/table surfaces use purpose-built cards rather than compressed desktop tables.
- Primary controls meet the 40 px mobile target contract; text inputs stay at 16 px on mobile to avoid browser zoom.
- The automated `axe-core` contrast suite passes approved dark/light body, supporting, performance, and CTA token combinations.
- Focusable capper, package, authentication, and navigation controls expose visible focus styles and semantic labels.

## Admin capability audit

| Owner request                  | Current state           | Evidence / constraint                                                                                      |
| ------------------------------ | ----------------------- | ---------------------------------------------------------------------------------------------------------- |
| See all published plays        | Live                    | Searchable straight-play and parlay ledger under Published Plays                                           |
| Correct misgrades              | Live                    | Straight/parlay correction controls plus append-only grading audit                                         |
| Capper management              | Live                    | Account lifecycle, verification, policy acceptance, profile, packages, storefront, and click summary       |
| Storefront status and approval | Live                    | Winible/Whop workflow states, attention queue, approve/suspend/restore, review timestamp and reviewer      |
| Package link management        | Live                    | Name, price, description, checkout/tracking link, trial/promo, visibility, order, provider, internal notes |
| Affiliate percentage           | Live for administration | Editable provider percentage; SCL does not claim provider-side enforcement                                 |
| Click insight                  | Live                    | Per-package and per-capper tracked click totals, now filtered to likely human navigation                   |
| Sales/conversion insight       | Limited                 | Provider-controlled until a verified Whop/Winible integration supplies sales events                        |
| Policy editing                 | Live                    | Terms, Privacy, Responsible Gaming, Refund, and Disclaimer publishing with revision history                |
| Bulk capper email              | Intentionally gated     | Requires approved broadcast sender, consent/audience policy, unsubscribe handling, and delivery reporting  |
| Bulk customer email            | Planned                 | No first-party customer account or marketing-consent model exists yet                                      |

The admin overview now presents this matrix in-product so a valid admin session is unmistakably different from a normal capper dashboard and future capability gaps are explicit rather than invisible.

## Production database and runtime audit

| Check                      | Evidence                                                                                                         | Result                           |
| -------------------------- | ---------------------------------------------------------------------------------------------------------------- | -------------------------------- |
| Runtime connectivity       | `/api/health` reports `database: reachable`                                                                      | Pass                             |
| Package attribution        | `PlayPackage` and `ParlayPackage` health probe                                                                   | Pass                             |
| Event labels               | `Play.eventLabel` health probe                                                                                   | Pass                             |
| Versioned consent          | required `TermsAcceptance` columns health probe                                                                  | Pass                             |
| Refund policy              | `PolicySlug.REFUND` health probe                                                                                 | Pass                             |
| Migration state            | Production build reported 21 applied migrations and no pending migration                                         | Pass                             |
| Current runtime errors     | No error/fatal runtime logs in the latest 24-hour production scan                                                | Pass                             |
| Pool resilience            | Supabase pooler connections are bounded and Prisma is process-singleton scoped                                   | Pass                             |
| Public package publication | Active offers require active account/profile/storefront/package and a tracked URL                                | Pass                             |
| Admin isolation            | `/admin` redirects unauthenticated users; admin APIs return 401 without an admin session                         | Pass                             |
| Seed isolation             | Production seed scripts refuse production and the admin gate counts any enabled `@scl.local` accounts as blocked | Runtime gate                     |
| Real owner admin           | Admin gate requires a verified, active, non-`.local` administrator                                               | Owner must confirm gate is green |

Historical schema and connection errors appeared in the seven-day Vercel aggregation, but they belong to superseded deployments. The latest 24-hour production scan is clean and the current health route confirms the required schema.

## Deployment audit

The project has Vercel Git integration enabled. The prior GitHub workflow also called a production deploy hook after each push, creating two production deployments and running migration work twice for the same commit. Automatic pushes now rely on the native Vercel Git deployment and the workflow waits until `/api/health` serves the exact Git SHA before testing core routes. Manual workflow runs retain the deploy hook and token-based CLI fallback for recovery.

The legacy `resolve-prod-migration.mjs` repair no longer runs as `prebuild`. Normal production builds still run `prisma migrate deploy`; the repair script remains available for deliberate recovery only.

## Verification record

- 423 Node tests passed.
- TypeScript passed with no errors.
- ESLint passed with no errors; two pre-existing unused-parameter warnings remain outside this change.
- Optimized Next.js 16 production build completed successfully.
- Local build emitted expected database fallback logs because production secrets are not copied into the worktree; production health and Vercel logs were inspected separately.

## Final owner release gate

Before announcing launch, sign in with the real owner account and require **zero blocked items** in Admin → Overview → Launch readiness. In particular, confirm the real owner administrator, seed-account lockout, transactional email sender, support inbox, odds provider, grading secret, production database URLs, and deployment identity. These are runtime/owner controls and should not be inferred from source code.
