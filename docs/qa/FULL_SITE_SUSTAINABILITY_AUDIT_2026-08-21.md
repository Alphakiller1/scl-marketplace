# SCL Full-Site Sustainability, Efficiency & Visual Matrix Audit

**Date:** 2026-08-21  
**Production:** https://sportscappersleaderboard.com  
**Release:** `f1734c1572375a732a276dfd89435b0cb9084ac1` (PRs #556–#559 live)  
**Health:** `ok` · DB reachable · schema complete · Supabase storage ready · odds reachable · Whop configured  
**Method:** live HTTP timings, `/api/health`, code review of `src/app`, `src/lib`, cron workflows, design-law docs, and the historical visual matrix (`docs/qa/VISUAL_MATRIX_AUDIT.md`).  
**Not a pixel recapture:** this is a **code + live-signal** audit. Desktop 1280 / dark / 375px screenshots and axe were not re-run in-browser.

Verdict: **the product is mechanically sustainable for daily use.** Auth, storage, grading, and ISR are real. Remaining work is **efficiency, cache correctness, and polish debt** — not a rebuild. Two public pages are still too slow under load. Admin/capper workspaces lag the public design law.

---

## 1. Live production scorecard

Measured 2026-08-21 against production (single warm-ish curl, TTFB includes TLS).

| Surface                | HTTP |      Time | Notes                                          |
| ---------------------- | :--: | --------: | ---------------------------------------------- |
| `/api/health`          | 200  |     1.30s | Full probe (DB + storage + odds + mail + Whop) |
| `/` home               | 200  | **0.14s** | Cached; ~667 KB HTML                           |
| `/leaderboard`         | 200  |     0.24s | Cached                                         |
| `/discover`            | 200  |     0.08s | Cached                                         |
| `/packages`            | 200  |     0.04s | Cached                                         |
| `/picks`               | 200  | **2.65s** | **Hot path** — sequential ledger + board       |
| `/cappers/kennykash`   | 200  | **5.34s** | **Hot path** — serial evidence + Whop refresh  |
| `/login`, `/signup`    | 200  |    ~0.13s |                                                |
| `/dashboard`, `/admin` | 307  |    <0.08s | Auth gate working                              |

**Infra from health**

| System           | State                                                                    |
| ---------------- | ------------------------------------------------------------------------ |
| Database         | Reachable, Prisma pool `connection_limit=5`, `pool_timeout=15s`          |
| Schema           | packageAttribution, eventLabels, policyAcceptance, refundPolicy all true |
| Supabase Storage | `scl-profile-media` ready; URL/key refs agree (`ljndtpzuslxgpnlxfhbz`)   |
| Email            | Configured, domain matches site, verification **enforced**               |
| Odds             | Configured + reachable; not rolled over                                  |
| Whop             | OAuth, webhook, affiliate username, account API, storefront sync         |

---

## 2. Visual matrix (code-informed, 0–100)

Scale: **85–100** matches intent · **70–84** right bones · **<70** materially off.

| Surface                   | Mockup fidelity | Composition | Typography | Color / law | Data realism | Imagery | Polish | A11y | Mobile | **Overall** |
| ------------------------- | :-------------: | :---------: | :--------: | :---------: | :----------: | :-----: | :----: | :--: | :----: | :---------: |
| **Homepage**              |       68        |     78      |     82     |     83      |      88      |   52    |   72   |  78  |   80   |   **75**    |
| **Leaderboard**           |       78        |     84      |     85     |     86      |      90      |   52    |   76   |  82  |   85   |   **80**    |
| **Public profile**        |       75        |     88      |     85     |     88      |      88      |   50    |   82   |  80  |   82   |   **79**    |
| **Discover**              |       80        |     85      |     84     |     88      |      90      |   52    |   80   |  80  |   82   |   **80**    |
| **Packages**              |       78        |     80      |     82     |     85      |      85      |   55    |   78   |  78  |   80   |   **78**    |
| **Picks ledger**          |       74        |     80      |     82     |     86      |      88      |   50    |   76   |  80  |   82   |   **78**    |
| **Auth (login/signup)**   |       70        |     76      |     80     |     82      |     n/a      |   n/a   |   74   |  80  |   84   |   **77**    |
| **Capper dashboard**      |       60        |     70      |     75     |     78      |      86      |   50    |   65   |  76  |   78   |   **71**    |
| **New Pick / slip**       |       62        |     68      |     72     |     76      |      84      |   n/a   |   68   |  74  |   76   |   **72**    |
| **Admin overview**        |       55        |     65      |     70     |     72      |      90      |   n/a   |   58   |  75  |   70   |   **66**    |
| **Admin store-setup**     |       58        |     68      |     72     |     70      |      88      |   n/a   |   62   |  76  |   72   |   **68**    |
| **Admin grading / plays** |       55        |     64      |     70     |     72      |      90      |   n/a   |   60   |  78  |   70   |   **67**    |

**Read of the matrix**

- Public boards are the product’s strength: tokens, RankBoard, receipts, honest data.
- **Imagery** is still the weakest _cross-surface_ column (~50). Hue-hash monograms exist; uploaded photos are now unblocked, but most rows still show initials until cappers retry uploads.
- **Admin** is a functional ops console, not SCL-native. That is the largest **quality gap**, not a reliability gap.
- Homepage mockup fidelity improved vs the 2025 audit (hero now uses `LiveBoardShell` + `RankBoardTable`) but is still not the mockup’s evidence dashboard.

---

## 3. Sustainability model (what keeps the site alive)

```
Public loop:  discover → evaluate → follow → view picks → track → rank → reputation → daily return
Capper loop:  New Pick → grade → profile/store → leaderboard
Admin loop:   grade exceptions → storefronts → policies → broadcasts
```

| Layer                           | How it stays sustainable                               | Fragility                                                             |
| ------------------------------- | ------------------------------------------------------ | --------------------------------------------------------------------- |
| **Postgres (`scl` only)**       | Pooled Supabase, 5 connections, sequential heavy pages | Profile + picks can still starve the pool under concurrent traffic    |
| **ISR 60s + `leaderboard` tag** | Home/board/discover/packages cached                    | Media uploads do **not** bust the tag                                 |
| **Odds credits**                | Surface populate 2×/day; expanded boards **manual**    | Day-game expanded markets go stale between owner runs                 |
| **Grading**                     | GitHub cron every 30 min; free score backstops         | MMA/tennis still depend on Odds scores path                           |
| **Whop**                        | Cron every 5 min + on-view freshness (60s)             | Monetization page waits on sync before listing packages               |
| **Storage**                     | Public bucket, service role, HEIC→JPEG→WebP            | HEIC patents: Sharp cannot decode on Vercel without conversion        |
| **Auth**                        | Proxy + layout + action gates; live DB role            | Email verification **on** — unverified cappers blocked from workspace |

---

## 4. User / public / capper findings

### 4.1 Efficiency

| ID  | Finding                                               | Impact | Evidence                                                                                                                                                                                                                                            |
| --- | ----------------------------------------------------- | ------ | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| U1  | **Public profile TTFB ~5.3s**                         | High   | Live `/cappers/kennykash`. Page awaits handle lookup, then **serial** evidence / packages / Whop refresh (`src/app/(marketing)/cappers/[handle]/page.tsx`). Intentional vs 5-connection pool, but one popular profile blocks other Fluid instances. |
| U2  | **Picks ledger TTFB ~2.6s**                           | High   | Live `/picks`. Sequential `getLeaderboardResult` + `getPublicRecentPickRows` + health (`src/app/(marketing)/picks/page.tsx`).                                                                                                                       |
| U3  | **Home still runs two 90-day leaderboard cache keys** | Medium | Hero: `sort: "roi"`; Top board: default sort then client `sortLeaderboard(..., "units")`. `getLeaderboardResult` cache key includes `sort` (`src/lib/queries/leaderboard.ts` 579–588) → **two full scans** per home generation.                     |
| U4  | **Ticker + featured play uncached**                   | Medium | `getLiveActivityTicker`, `getFeaturedGradedPlay` hit Prisma on every home island, unlike 60s cached board.                                                                                                                                          |
| U5  | **Capper monetization waterfall**                     | Medium | `getCapperProfileId` → `refreshWhopStorefrontIfStale` → packages → messages. Sync blocks first paint.                                                                                                                                               |
| U6  | **Pick entry is a full client route**                 | Medium | `/dashboard/picks/new` is `"use client"` wrapping `UnifiedPickEntry` + odds-assist. Correct for interactivity; largest capper JS cost.                                                                                                              |
| U7  | **Dead `QueryProvider`**                              | Low    | `src/components/providers/query-provider.tsx` unused (AGENTS.md already forbids mounting it at root). TanStack Query is a dependency with no runtime consumers.                                                                                     |

### 4.2 Correctness / regression risk

| ID  | Finding                                                          | Impact | Evidence                                                                                                                                                                                                                                           |
| --- | ---------------------------------------------------------------- | ------ | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| U8  | **Avatar upload does not bust `leaderboard` tag or `/discover`** | High   | `profile-media.action.ts` only revalidates `/dashboard/profile`, `/cappers`, `/leaderboard` path, and one handle. Text save **does** `revalidateTag("leaderboard")`. Boards can show old initials for up to 60s — looks like “upload didn’t work.” |
| U9  | **Username + photo fixes are live**                              | Closed | PRs #556–#559: 5 MB limit, HEIC client+server, Safari `ftyp` header, `capperProfile.upsert`, `ensureCapperProfileByUserId`, validation toasts. Locked by `profile-save.test.ts`, `profile-media-upload.test.ts`, `profile-media-format.test.ts`.   |
| U10 | **No `(marketing)` / `(capper)` `error.tsx`**                    | Medium | Only root `src/app/error.tsx`. A Prisma blip on dashboard becomes a generic crash, not an SCL empty/retry.                                                                                                                                         |
| U11 | **Email verification enforced on uploads/saves**                 | Info   | Health `verificationEnforced: true`. Unverified cappers cannot upload or change username — by design, but will look like “save does nothing” if they never see `/verify`.                                                                          |
| U12 | **Expanded odds clock paused**                                   | Medium | `odds-refresh.yml` schedule commented out. Surface boards refresh 08:00/20:00 ET; props/alternates only on manual populate. Pick-entry can on-demand fetch (credits).                                                                              |

### 4.3 Visual / UX (user side)

| ID  | Finding                                       | Axis              | Notes                                                                                         |
| --- | --------------------------------------------- | ----------------- | --------------------------------------------------------------------------------------------- |
| U13 | Letter/monogram avatars still dominate boards | Imagery           | `CapperAvatar` hue-hash fallback; photos now possible                                         |
| U14 | Header `max-w-6xl` vs body `max-w-[1400px]`   | Composition       | `site-header.tsx` vs home shell — chrome narrower than board                                  |
| U15 | Sub-12px labels                               | Typography / a11y | `text-[0.5rem]` odds-assist, `text-[0.55rem]` leaderboard Early, `text-[0.56rem]` market-chip |
| U16 | Rank chevron `size-8` (32px)                  | Mobile            | Below 40px tap target (`rank-board-table.tsx`)                                                |
| U17 | Hex gradient on mobile slip dock              | Color law         | `mobile-slip-dock.tsx` `#1E2940` / `#141C2C`                                                  |
| U18 | Profile specialties input unlabeled           | A11y              | `profile-tag-input.tsx` placeholder-only                                                      |
| U19 | Capper Security omitted from primary nav      | IA                | Reached from profile footer only (`(capper)/layout.tsx`)                                      |
| U20 | Profile load failure is a plain card          | States            | Not `EmptyState` + retry                                                                      |

---

## 5. Admin-side findings

### 5.1 Efficiency

| ID  | Finding                                                | Impact   | Evidence                                                                                                          |
| --- | ------------------------------------------------------ | -------- | ----------------------------------------------------------------------------------------------------------------- |
| A1  | Admin pages are **uncached live Prisma**               | OK / Low | Correct for ops freshness. Overview uses `Promise.all` for counts. Store-setup is sequential to protect the pool. |
| A2  | Capper detail page is very large (~admin/cappers/[id]) | Medium   | Deep review UI; fine at low admin concurrency, expensive if many tabs open.                                       |
| A3  | Whop cron every 5 minutes × all live storefronts       | Medium   | Sustainable at current roster; batch size 5. Cost grows linearly with storefronts.                                |
| A4  | Dead revalidate path `/admin/packages`                 | Low      | `revalidate-commerce.ts` — route does not exist. Harmless extra ISR work.                                         |

### 5.2 Correctness / security / regression

| ID  | Finding                                                            | Impact          | Evidence                                                                                                          |
| --- | ------------------------------------------------------------------ | --------------- | ----------------------------------------------------------------------------------------------------------------- |
| A5  | Grade cron: if `CRON_SECRET` unset, `x-vercel-cron: 1` is accepted | Low (misconfig) | `src/app/api/cron/grade/route.ts`. Production currently has the secret (workflow succeeds). Keep secret required. |
| A6  | `/api/admin/db-patch` is a standing DDL endpoint                   | Low             | CRON_SECRET gated. Launch audit already asked to retire once unused.                                              |
| A7  | `/api/player-image` public, no rate limit                          | Low–Med         | ESPN search proxy. Cached, but unbounded.                                                                         |
| A8  | Seed-ghosts / schema-status / verify-whop-sync                     | OK              | CRON_SECRET, not session.                                                                                         |
| A9  | No `(admin)/error.tsx`                                             | Medium          | Admin DB errors fall to generic root boundary.                                                                    |
| A10 | Admin skeleton is generic 4-bar                                    | Polish          | `admin-route-skeleton.tsx` does not match plays/store-setup layout.                                               |

### 5.3 Visual / UX (admin)

| ID  | Finding                                               | Axis        | Notes                                                                                 |
| --- | ----------------------------------------------------- | ----------- | ------------------------------------------------------------------------------------- |
| A11 | Raw shadcn `Table` on plays                           | Polish      | Not RankBoard / SCL dense table                                                       |
| A12 | Tailwind `amber-500` status chips                     | Color law   | `admin/page.tsx`, `admin-release-readiness.tsx`, `store-status-chip.tsx`, store-setup |
| A13 | Messages empty state is a `<p>`                       | States      | Not `EmptyState`                                                                      |
| A14 | Shell `max-w-6xl` vs public 1400px                    | Composition | Ops console feels cheaper than the public board                                       |
| A15 | Capability matrix / StatBlocks are generic Card grids | Polish      | Admin overview                                                                        |

Admin is **secure and usable**. It is **not** at the public product bar. That is expected for Phase 1 ops, but it is the main “site-wide quality” complaint if owners live in `/admin` daily.

---

## 6. Storage / backend / frontend layers

### Storage

- **OK:** Bucket exists, refs agree, public URLs on `*.supabase.co`, `next/image` allows wildcard.
- **OK:** Uploads go Server Action → Sharp WebP → upsert object `{userId}/avatar.webp`.
- **Gap:** ISR/tag invalidation after media (U8).
- **OK:** HEIC handled in browser (`heic2any` + `ftyp` sniff) and server (`heic-convert`) because Sharp prebuilds cannot decode HEVC HEIC on Vercel.

### Backend

- **OK:** Prisma only in Server Components / actions / route handlers. Singleton `@/lib/prisma`.
- **OK:** Money/odds math centralized; no `any`.
- **OK:** Rate limits on signup, login, reset, support, storefront messages, `/go/[slug]`.
- **Pool:** 5 connections is the binding constraint. Sequential heavy pages are a **correct** mitigation that **transfers** latency to the user (U1, U2). Long-term: raise pool on Pro **or** cache picks/profile aggregates like leaderboard.

### Frontend

- **OK:** App Router, Server Components default, marketing header does not call `auth()` (ISR preserved).
- **OK:** Home streams via Suspense islands.
- **Debt:** oversized client editors (profile-form ~548, leaderboard ~642, pick-entry stack).
- **Debt:** roughly 80 arbitrary SCL text-color token escapes, the amber palette, and one hex gradient.

### Cron / jobs

| Job                     | Cadence                    | Status               |
| ----------------------- | -------------------------- | -------------------- |
| Grade                   | `:07` and `:37` every hour | Live, health-checked |
| Odds populate (surface) | 08:00 + 20:00 ET           | Live                 |
| Odds refresh (expanded) | Manual only                | **Paused**           |
| Whop sync               | Every 5 min                | Live                 |

---

## 7. Regression / lint / quality-gate risk

| Gate                           | State                                                         | Risk                                                                                                                               |
| ------------------------------ | ------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------- |
| `typecheck` / `lint` / `build` | Required on CI                                                | Low — no `any`, no `asChild`                                                                                                       |
| Unit tests                     | Large `tsx --test` suite                                      | Medium — many **source-string** tests (`assert.match(file)`). They lock architecture; they do not prove Sharp/HEIC/runtime upload. |
| Playwright e2e                 | Documented, not the default CI core                           | **High gap** — profile save, photo upload, New Pick, admin grade unguarded in browser                                              |
| Visual checklist               | PR honor system                                               | Medium — admin PRs often skip SCL-native components                                                                                |
| Lint                           | 0 errors; leftover unused-arg warnings in identity/storefront | Low                                                                                                                                |
| Format                         | pre-commit                                                    | Low                                                                                                                                |

**Highest regression vectors (next 30 days of merges)**

1. Re-introducing `capperProfile.update` instead of `upsert` (username/photo rollback).
2. Dropping `revalidateTag("leaderboard")` on commerce or profile writes.
3. Restoring a **subset** of odds-refresh crons (cadence test exists; still easy to “save credits” wrongly).
4. Serializing home queries again / adding a third leaderboard window.
5. Raising Prisma `Promise.all` fan-out on public pages without raising `connection_limit`.

---

## 8. Comparison to prior audits

| Prior item                       | 2025/early-Aug    | Now                                                            |
| -------------------------------- | ----------------- | -------------------------------------------------------------- |
| Home TTFB ~3.5s serial 6 queries | P1                | **Mostly fixed** — home 0.14s cached; still duplicate 90d keys |
| Ghost cappers on public board    | P1 trust          | **Gated** (`SCL_ALLOW_GHOST_PUBLICATION`)                      |
| Seed admin live                  | Blocker           | **Disabled**                                                   |
| Package example.com links        | Blocker           | **Fixed**                                                      |
| Letter avatars                   | P1 visual         | **Partial** — uploads unblocked; imagery score still ~50       |
| Profile photo / username         | Not in old matrix | **Fixed in prod today**                                        |
| Picks / public profile TTFB      | Not highlighted   | **New P1** (2.6s / 5.3s)                                       |
| Admin SCL pass                   | Not scored        | **New P1 polish** (overall ~66–68)                             |

---

## 9. Prioritized remediation (sustainability first)

Effort is technical scope, not calendar time.

### P0 — correctness users will still feel as “broken”

| #   | Work                                                                                                                   | Why                                  | Scope                                        |
| --- | ---------------------------------------------------------------------------------------------------------------------- | ------------------------------------ | -------------------------------------------- |
| 1   | **Align media revalidation with profile save** — `revalidateTag("leaderboard")`, `/discover`, `/cappers/[handle]` page | Upload “didn’t apply” on boards      | **Shipped with this audit**                  |
| 2   | **Cache or parallel-safe public profile + picks**                                                                      | 5s / 2.6s TTFB under live traffic    | Medium — `cachedQuery` + tags, or raise pool |
| 3   | **Single home 90d leaderboard fetch**                                                                                  | Duplicate cache keys = 2× DB on miss | **Shipped with this audit**                  |

### P1 — efficiency & ops sustainability

| #   | Work                                                                                               | Why                                                                                  |
| --- | -------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------ |
| 4   | Cache ticker + featured play 30–60s on `leaderboard` tag                                           | Home islands still hit Prisma                                                        |
| 5   | Document / SOP expanded-odds populate until refresh clock returns                                  | Props stale between owner runs                                                       |
| 6   | Rate-limit `/api/player-image`                                                                     | Public ESPN proxy                                                                    |
| 7   | Segment `error.tsx` for `(admin)` and `(capper)`                                                   | Ops/capper crashes become recoverable                                                |
| 8   | Remove dead `/admin/packages` revalidate; drop unused `QueryProvider` or use it only in pick-entry | **`/admin/packages` revalidate removed with this audit**; QueryProvider still unused |

### P2 — visual law / a11y / polish (does not block daily use)

| #   | Work                                                                  | Why                 |
| --- | --------------------------------------------------------------------- | ------------------- |
| 9   | Map `amber-*` admin/store status to `--scl-perf-mid*`                 | Design law          |
| 10  | Replace `mobile-slip-dock` hex gradient with tokens                   | Design law          |
| 11  | Floor labels at `text-xs` / `scl-eyebrow`; bump chevrons to `size-10` | Mobile + a11y       |
| 12  | `EmptyState` on admin messages + profile load failure                 | States checklist    |
| 13  | Label `ProfileTagInput`                                               | A11y                |
| 14  | Admin SCL table pass (plays/grading)                                  | Public vs admin gap |
| 15  | Header width = 1400px or document 6xl as ops chrome                   | Composition         |
| 16  | Playwright: profile save, HEIC/JPG upload, New Pick, admin grade      | Regression          |

### Do **not** do

- Restore odds-refresh as a **subset** of the five UTC times.
- Fan out more Prisma `Promise.all` on public pages without pool headroom.
- Mount `QueryProvider` at the root (busts / bloats every public page).
- Claim sportsbook-sync or live ticks we do not have.

---

## 10. Suggested visual QA recapture (next pass)

Not done in this audit. When recapturing, score the same matrix at:

- 375px dark, 390px dark, 1280px dark, 1280px light
- Home, leaderboard, discover, packages, picks, one real profile, login, dashboard, New Pick, `/admin`, `/admin/store-setup`, `/admin/grading`

Checklist per surface: overflow, tap ≥40px, Skeleton/Empty/Error, heading order, focus, `pos`/`neg` contrast, avatar vs initials, ISR freshness after photo/username/package save.

---

## 11. Bottom line

The site **can run daily**: health is green, storage is configured, grading and Whop clocks are on, and today’s profile bugs are in production with CI locks.

It is **not yet as efficient as it can be**. Public profile and picks are the expensive pages. Avatar cache lag will keep looking like an upload bug until media writes bust the same tag as text saves. Admin is sustainable as an ops tool and weak as an SCL surface.

**Fastest sustainability wins:** (1) media `revalidateTag`, (2) one home leaderboard query, (3) cache picks/profile the way leaderboard is cached.

Shipped with this audit: (1) and (2), plus removal of the dead `/admin/packages` revalidate path. (3) remains open — public profile and picks still serialize against the 5-connection pool.
