# SCL — Launch-Readiness Audit

**Date:** 2026-08-01 · **Release candidate:** PR #341 · **Target:** https://scl-marketplace.vercel.app
**Method:** live HTTP matrix (65-link crawl, TTFB, SEO signals), full quality gates, code sweeps (buttons, zoom/density, security), ops checks. Complements the design-fidelity scores in `VISUAL_MATRIX_AUDIT.md` (build `8322ca4` — partially stale; deltas noted below).

---

## Verdict

The release candidate is mechanically sound and now includes a live release gate in the Admin Console. Ghost records are private by default, the leaked seed administrator is disabled, paid picks are server-embargoed, and package performance is tied only to explicitly attributed picks. Production launch still requires a verified real owner administrator and a green post-deploy health check after the PR is merged.

## Scorecard (this audit)

| Axis             | State          | Evidence                                                                                                                                                                                                                                                                              |
| ---------------- | -------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Route health     | ✅             | 12 public routes 200; auth routes 307; APIs 401 (gated); custom 404 works                                                                                                                                                                                                             |
| Buttons & links  | ✅ (after fix) | 65-link crawl: 0 dead pages. **Fixed in this pass:** all package Subscribe buttons 302'd to dead `example.com` (seeder bug — PR #305 never merged; re-implemented on main)                                                                                                            |
| Performance      | ✅             | TTFB: home 0.33s, leaderboard 0.18s, discover 0.21s, profile 0.36s (stale audit's 3.5s home is resolved). Packages 0.87s — watch, don't block                                                                                                                                         |
| Quality gates    | ✅             | typecheck 0 · lint 0 · `next build` 0 · **359/359 unit tests**                                                                                                                                                                                                                        |
| Zoom / density   | ✅             | `html{font-size:100%}` intact; no fixed table row heights; no page-level `overflow-x-hidden` outside gated QA fixtures; only rigid px = page-shell `max-w-[1400px]` (intentional) + one `min-h-[72px]`. Buttons/controls now rem-based (`h-10`/`lg:h-9`) so they scale with user zoom |
| SEO              | ✅ (after fix) | OG/meta/twitter cards present; OG image renders (200 png). **Fixed in this pass:** `robots.txt` + `sitemap.xml` were 404 — added App-Router metadata routes                                                                                                                           |
| Auto-grading ops | ✅             | grade-cron green (15-min cadence, last 3 runs success); manual override is admin-only backup                                                                                                                                                                                          |
| DB / infra       | ✅             | P2024 pool exhaustion fixed & verified (0 runtime errors since); migration drift patched via `/api/admin/db-patch`; deploys promote (Hobby throttle lags minutes under heavy merging)                                                                                                 |
| Accessibility    | ⚠️ not re-run  | CI enforces AA contrast + focus states exist; axe pass on populated states still pending (carried from prior audit)                                                                                                                                                                   |

## Launch blockers (must close before real traffic)

| #   | Blocker                                                                   | Why                                                                                                               | Action                                                                                                                     |
| --- | ------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------- |
| 1   | ~~**30 fabricated ghost cappers on a public "verified" board**~~ RESOLVED | Ghost accounts are excluded unless publication is explicitly enabled                                              | Keep `SCL_ALLOW_GHOST_PUBLICATION` unset or `0`; wipe ghosts when the admin demonstration data is no longer needed         |
| 2   | ~~**Default admin credentials**~~ RESOLVED 2026-08-01                     | The seed admin was live and ACTIVE in production with the seed password still working, published in a public repo | Account DISABLED in production; the owner-provisioning workflow keeps seed accounts disabled when a real owner is promoted |
| 3   | **Prod DB password rotation** (standing item)                             | Was shared in plaintext during development                                                                        | Rotate in Supabase; update Vercel + GitHub secrets                                                                         |
| 4   | **Demo Subscribe links**                                                  | Every package checkout pointed at dead `example.com`                                                              | ✅ Fixed this pass — seeder now uses SCL's real Winible referral; prod re-seeded                                           |
| 5   | **Real owner administrator**                                              | Seed credentials are disabled, so a verified owner must hold the production ADMIN role                            | Run **Provision existing production owner** with the owner's existing verified account email                               |
| 6   | **Production service configuration**                                      | Signup verification, support delivery, odds verification, grading, and media need their provider credentials      | Resolve every blocked item in **Admin → Launch readiness** before merging                                                  |

## Post-launch hygiene (should, not must)

- **Retire `/api/admin/db-patch`** once its DDL is confirmed no longer needed — a standing schema-mutation endpoint (even CRON_SECRET-gated) is unnecessary surface.
- **Vercel Pro** — Hobby throttling delays production promotes minutes behind merges on busy days.
- Packages TTFB (0.87s) — cache the marketplace query like the other aggregates.
- Axe/a11y re-pass on populated states; mobile 375/390 + light-theme visual pass (never captured).
- `VISUAL_MATRIX_AUDIT.md` P2 design polish: avatars/monograms beyond player props, package-card trust ordering, profile Analyst default.

## What this pass changed

1. `scripts/seed-ghosts.ts` — ghosts pinned to WINIBLE; `checkoutUrl`/`targetUrl` now `WINIBLE_CAPPER_REFERRAL_URL` (was fabricated `example.com/...`). Prod re-seeded after deploy.
2. `src/app/robots.ts` + `src/app/sitemap.ts` — crawler policy (disallow workspace/api/go/qa) + static-core sitemap.
3. This document.
