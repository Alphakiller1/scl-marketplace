# SCL Production Audit — 2026-08-05

**Site:** https://sportscappersleaderboard.com  
**Audit date:** 2026-08-05 / 2026-08-06 UTC  
**Release under test:** `ab61a7a9f5414706fe522a8bbd4b6b9047da3b6d` (via `/api/health`)  
**Auditor method:** Live Playwright browser automation, curl verification, DOM extraction, screenshot review.  
**Safety rails:** All nine production write rails observed. No users modified, no grading run, no emails sent, no picks submitted.

---

## 1. Executive Summary

SCL’s production launch is **visually polished and mostly honest about sparse verification data**, but I would **not yet tell every imported capper to treat the public record as fully reconcilable** without fixing cross-surface stat mismatches and broken avatar delivery. The product loads, ranks cappers, explains legacy import provenance, and uses em-dashes instead of fabricated zeros in the sparse-data panels that matter most (Platform CLV, Live Window sub-tables). Authorization redirects for `/admin` and `/dashboard` work correctly when logged out.

The **single biggest risk** is **data-integrity drift between surfaces**: leaderboard legacy totals, profile Evidence Brief aggregates, and the cumulative-units chart can disagree on the same capper (confirmed on `@wgsdfs`: header **+144.73U** vs chart end **+26.75U**). On a product whose promise is verifiable performance, that reads as a bug even when individual pick receipts look correct.

**Launch-readiness verdict:** **Conditional go** — safe for read-only public discovery and capper login, but **fix P1 data/chart reconciliation and avatar 404/400 errors before marketing the board as audit-grade**.

**DB note:** Direct Postgres access from this cloud agent environment was **blocked** (`Network is unreachable` to `db.ljndtpzuslxgpnlxfhbz.supabase.co:5432/6543`). All data-integrity checks below cross-check **public UI surfaces** and `/api/health`; operator should re-run SQL reconciliation locally.

---

## 2. Severity-Ranked Findings

### AUDIT-001

```
ID          AUDIT-001
Severity    P1
Category    performance | correctness
Route       /, /leaderboard, /picks, /packages
Viewport    all tested (375–1536)
What        Capper avatar images fail via Next.js Image Optimizer with HTTP 400 INVALID_IMAGE_OPTIMIZE_REQUEST while the source Supabase object returns HTTP 200.
Evidence    curl -I https://sportscappersleaderboard.com/_next/image?url=...mvxjcfriirguhjujurhf.supabase.co... → 400 x-vercel-error: INVALID_IMAGE_OPTIMIZE_REQUEST; direct Supabase URL → 200 image/webp. Console errors in audit-report.json on /, /leaderboard, /picks, /packages. Screenshot: /opt/cursor/artifacts/screenshots/home-desktop.png (broken initials visible in ticker/table).
Repro       1. Open /. 2. Open DevTools → Network. 3. Filter _next/image. 4. Observe 400 for cms8lu1p701vnel302q7osq4g, cms8lwygs03k3el301rag6huu, cmsgnfykr0000l8043aezu6hj avatars.
Why it matters  Broken avatars erode premium polish on every ranked surface; likely Supabase project hostname mismatch (avatars on mvxjcfriirguhjujurhf.supabase.co vs production SUPABASE_URL narrowing remotePatterns in next.config.ts).
Fix         Align SUPABASE_URL / image remotePatterns to include all storage hosts serving live avatar URLs, or migrate avatar objects to the production bucket; add onError fallback in CapperAvatar.
```

### AUDIT-002

```
ID          AUDIT-002
Severity    P1
Category    data-integrity
Route       /cappers/wgsdfs
Viewport    1440
What        Evidence Brief header shows +144.73U total units but Performance trend chart labels End +26.75U for the same capper with 228 graded sample.
Evidence    DOM extraction 2026-08-06: headerUnits "+144.73U", chartEnd "End +26.75U". Screenshot: /opt/cursor/artifacts/screenshots/wgsdfs-chart-audit.png, /opt/cursor/artifacts/screenshots/capper_profile_wgsdfs.png.
Repro       1. Open /cappers/wgsdfs. 2. Read Evidence Brief UNITS (+144.73U). 3. Read chart caption End +26.75U.
Why it matters  Product promise is inspectable cumulative performance; two authoritative numbers on one profile contradict each other.
Fix         Reconcile chartSeries profitUnits sum with capper aggregate units in src/lib/queries/capper.ts + evidence-brief.tsx; chart end must equal header or header must label scope (e.g. legacy-inclusive vs SCL-only).
```

### AUDIT-003

```
ID          AUDIT-003
Severity    P1
Category    design-law
Route       /leaderboard
Viewport    1440, 375
What        Visible placeholder text "Handle" in leaderboard search input violates design law ("The word handle must not appear").
Evidence    Screenshot /opt/cursor/artifacts/screenshots/leaderboard-desktop.png; DOM count placeholder="Handle" = 2; src/components/scl/leaderboard-filters.tsx line 199 placeholder="Handle".
Repro       1. Open /leaderboard. 2. Inspect search field placeholder.
Why it matters  Explicit v2.0 spec prohibition; also confuses betting "handle" with capper username.
Fix         Change placeholder to "Capper" or "Search cappers" in leaderboard-filters.tsx; audit admin search placeholder too (admin/cappers uses "Name, handle, or email" — acceptable in admin-only copy).
```

### AUDIT-004

```
ID          AUDIT-004
Severity    P1
Category    data-integrity
Route       /leaderboard ↔ /cappers/[handle]
Viewport    1440
What        Legacy-imported cappers show full W-L-ROI-Units on leaderboard but Evidence Brief on profile shows em-dashes with 0 SCL-graded sample until they accumulate new graded picks.
Evidence    @bankofdennis: leaderboard 636-531-24, +35.4%, +1416.82U vs profile Evidence Brief RECORD/ROI/UNITS all —, "Chart unlocks after 10 graded plays. Current sample: 0". Screenshot /opt/cursor/artifacts/screenshots/capper_profile_bankofdennis.png vs leaderboard-desktop.png. Legacy badge copy present: "Includes 1,001 Settled Results Carried Over… Totals Only, No Per-Pick Record".
Repro       1. Open /leaderboard, note @bankofdennis stats. 2. Click through to /cappers/bankofdennis. 3. Compare Evidence Brief to leaderboard row.
Why it matters  Followers evaluating from leaderboard see numbers that vanish on profile; legacy totals are disclosed via badge but not in Evidence Brief row.
Fix         Surface legacy-carried totals in Evidence Brief (labeled, separate from SCL-graded) or exclude legacy totals from leaderboard rank metrics until SCL sample exists — pick one honest model.
```

### AUDIT-005

```
ID          AUDIT-005
Severity    P2
Category    security | correctness
Route       /qa/board-odds-hygiene, /qa/desktop-profile-composition
Viewport    1440
What        QA routes return HTTP 200 while rendering Next.js 404 page body (not fixture content).
Evidence    curl status 200; page body contains NEXT_HTTP_ERROR_FALLBACK;404 and "This page could not be found." Screenshot /opt/cursor/artifacts/screenshots/qa-board-odds-hygiene-desktop.png. No fixture strings (QaBoardOddsHygiene, odds hygiene) in HTML. robots.txt Disallow: /qa/.
Repro       1. curl -I /qa/board-odds-hygiene → 200. 2. View page → 404 UI.
Why it matters  Not a fixture leak (content is safe), but crawlers/monitors expecting HTTP 404 will misclassify; audit spec requires 404 status.
Fix         Return proper 404 status for blocked QA routes (middleware or notFound statusCode); keep ALLOW_QA_SHOTS=0 in production.
```

### AUDIT-006

```
ID          AUDIT-006
Severity    P2
Category    performance
Route       /packages
Viewport    1440
What        /packages networkidle load ~4930ms vs ~3138ms home, ~3694ms leaderboard.
Evidence    Playwright timing run 2026-08-06; screenshot packages-desktop.png (52 package cards, large DOM).
Repro       1. Cold load /packages with Network idle. 2. Compare to /leaderboard.
Why it matters  Primary commerce discovery surface; long TTI on mobile networks.
Fix         Paginate or virtualize package grid; defer below-fold cards; audit client bundle on packages-register.tsx.
```

### AUDIT-007

```
ID          AUDIT-007
Severity    P2
Category    design-law | copy
Route       /picks
Viewport    1440
What        Pick ledger labels pending picks "Not Odds Verified" (good) but column header area mixes "Odds Verification" (blue) legend with pink "Record Verification" — tier labeling is honest; sparse verified count visible (~3 Odds Verified rows vs many pending).
Evidence    /opt/cursor/artifacts/screenshots/picks-desktop-audit.png; DOM picks page excerpt.
Repro       1. Open /picks. 2. Scan PROOF column.
Why it matters  Launch context: 5142 SELF_REPORTED vs ~35 VERIFIED — UI handles this without implying full board verification (positive).
Fix         None required for honesty; consider stronger empty-state copy when verified column is empty for a filtered view.
```

### AUDIT-008

```
ID          AUDIT-008
Severity    P3
Category    polish
Route       /sitemap.xml
Viewport    375
What        Horizontal overflow on mobile viewport for raw XML sitemap page.
Evidence    audit-report.json layout finding; screenshot sitemap-xml-mobile.png.
Repro       1. Open /sitemap.xml at 375px width. 2. Observe horizontal scroll.
Why it matters  Low user impact (non-UI route).
Fix         Serve sitemap with Content-Type text/xml and optional mobile stylesheet or accept overflow.
```

### AUDIT-009

```
ID          AUDIT-009
Severity    P3
Category    copy
Route       /
Viewport    1440
What        Footer copyright year inconsistent (2025 on home screenshot vs 2026 on other pages).
Evidence    home-desktop.png description "© 2025"; picks page "© 2026 Sports Cappers Leaderboard".
Repro       1. Compare footer on / vs /picks.
Why it matters  Minor trust/polish on launch day.
Fix         Centralize footer year via server component Date or static 2026.
```

### AUDIT-010

```
ID          AUDIT-010
Severity    P3
Category    design-law
Route       /packages, /terms
Viewport    1440
What        Dollar signs appear for third-party Whop/Winible subscription pricing ($6.99/month, $40/day, Terms US $100 arbitration cap).
Evidence    packages-desktop.png; terms-desktop.png.
Repro       1. Open /packages. 2. Observe $ prices on package cards.
Why it matters  Design law "Units, never dollars" targets **betting volume/handle**, not third-party checkout prices. Legal $ in Terms is expected.
Fix         No change required for commerce/legal; ensure no $ appears on ROI/Units/record columns (confirmed: units use U suffix).
```

---

## 3. Route-by-Route Matrix

| Route                             | Visual      | Functional  | A11y        | Perf        | Notes / IDs                                                    |
| --------------------------------- | ----------- | ----------- | ----------- | ----------- | -------------------------------------------------------------- |
| `/`                               | Pass        | Pass        | Pass\*      | Warn        | Sparse data honest (35 odds-verified); avatar errors AUDIT-001 |
| `/leaderboard`                    | Pass        | Pass        | Pass\*      | Pass        | Handle placeholder AUDIT-003; avatars AUDIT-001                |
| `/discover`                       | Pass        | Pass        | Pass        | Pass        | Redirect alias for /cappers                                    |
| `/picks`                          | Pass        | Pass        | Pass        | Pass        | Honest Not Odds Verified labels AUDIT-007                      |
| `/packages`                       | Pass        | Pass        | Pass        | Fail        | Slow load AUDIT-006; $ is commerce AUDIT-010                   |
| `/cappers`                        | Pass        | Pass        | Pass        | Pass        | Redirects to /discover                                         |
| `/cappers/[handle]`               | Warn        | Pass        | Pass        | Pass        | Chart mismatch AUDIT-002; legacy split AUDIT-004               |
| `/verification`                   | Pass        | Pass        | Pass        | Pass        |                                                                |
| `/support`                        | Pass        | Pass        | Pass        | Pass        | Form not submitted (rail 6)                                    |
| `/terms`                          | Pass        | Pass        | Pass        | Pass        | Legal $ AUDIT-010                                              |
| `/privacy`                        | Pass        | Pass        | Pass        | Pass        |                                                                |
| `/disclaimer`                     | Pass        | Pass        | Pass        | Pass        |                                                                |
| `/responsible-gaming`             | Pass        | Pass        | Pass        | Pass        |                                                                |
| `/refund-policy`                  | Pass        | Pass        | Pass        | Pass        |                                                                |
| `/login`                          | Pass        | Pass        | Pass        | Pass        | Keyboard focus 10/10 visible (phase 2)                         |
| `/signup`                         | Pass        | Pass        | Pass        | Pass        | Submit disabled until valid (expected)                         |
| `/verify`                         | Pass        | Pass        | Pass        | Pass        |                                                                |
| `/resend-verification`            | Pass        | Pass        | Pass        | Pass        |                                                                |
| `/forgot-password`                | Pass        | Pass        | Pass        | Pass        | Not submitted                                                  |
| `/reset-password`                 | Pass        | Pass        | Pass        | Pass        |                                                                |
| `/accept-terms`                   | Pass        | Pass        | Pass        | Pass        |                                                                |
| `/account-restricted`             | Pass        | Pass        | Pass        | Pass        |                                                                |
| `/dashboard`                      | N/E         | Pass        | N/E         | N/E         | 307 → login when logged out ✓                                  |
| `/dashboard/*`                    | **Skipped** | **Skipped** | **Skipped** | **Skipped** | No capper credentials in cloud env                             |
| `/admin`                          | N/E         | Pass        | N/E         | N/E         | 307 → login when logged out ✓                                  |
| `/admin/*`                        | **Skipped** | **Skipped** | **Skipped** | **Skipped** | No admin credentials in cloud env                              |
| `/robots.txt`                     | Pass        | Pass        | Pass        | Pass        | Correct domain, Disallow /qa/                                  |
| `/sitemap.xml`                    | Warn        | Pass        | Pass        | Pass        | Mobile overflow AUDIT-008; correct domain                      |
| `/api/health`                     | Pass        | Pass        | Pass        | Pass        | DB reachable from Vercel                                       |
| `/qa/board-odds-hygiene`          | Pass        | Warn        | Pass        | Pass        | 404 body, 200 status AUDIT-005                                 |
| `/qa/desktop-profile-composition` | Pass        | Warn        | Pass        | Pass        | Same as above                                                  |

\*A11y Pass with spot checks; full WCAG audit not instrumented for every route.

---

## 4. Responsive Matrix

| Page           | 375                | 390  | 768  | 1024 | 1440 | 1536 | 1920 | 150% zoom | 200% zoom |
| -------------- | ------------------ | ---- | ---- | ---- | ---- | ---- | ---- | --------- | --------- |
| `/`            | Pass               | Pass | Pass | Pass | Pass | Pass | Pass | —         | —         |
| `/leaderboard` | Pass               | Pass | Pass | Pass | Pass | Pass | Pass | Pass      | Pass      |
| `/picks`       | Pass               | —    | Pass | —    | Pass | Pass | —    | —         | —         |
| `/packages`    | Pass               | —    | Pass | —    | Pass | Pass | —    | —         | —         |
| `/sitemap.xml` | **Fail** AUDIT-008 | —    | Pass | —    | Pass | Pass | —    | —         | —         |

No horizontal page overflow detected on product pages at tested widths (phase 1 + phase 2 Playwright `scrollWidth <= clientWidth` checks).

---

## 5. Design-Law Compliance

**Method:** Manual screenshot review + DOM text scan against `design/SCL-DESIGN-SPEC.md` v2.0 and `docs/SCL_DESIGN_CONTRACT.md` (22 clauses checked).

| Clause                                      | Status             | Evidence                                                 |
| ------------------------------------------- | ------------------ | -------------------------------------------------------- |
| Pink = conviction (CTAs, verified stamp)    | Pass               | JOIN SCL, Track Your Record buttons pink                 |
| Blue = navigation (nav pills, filters)      | Pass               | Leaderboard timeframe pills blue when active             |
| No Settlement Gold                          | Pass               | Rank crowns pink; no gold hex detected in automated scan |
| Performance spectrum vs settlement separate | Pass               | ROI/units green-red ramp; W/L pills discrete             |
| Units not dollars on performance            | Pass               | +144.73U, +1416.82U format                               |
| No word "handle" in product copy            | **Fail** AUDIT-003 | Leaderboard search placeholder                           |
| Honest em-dash for unknown                  | Pass               | CLV —, Platform CLV 8/10 snapshots, shape tables —       |
| AA-safe perf text variants                  | Pass\*             | Visual review; pos/neg text readable on dark             |
| Legacy provenance disclosed                 | Pass               | Legacy Capper badge + carried-over copy                  |
| Mobile-first / 375 no overflow              | Pass               |                                                          |
| Tabular nums on metrics                     | Pass               | Inter tabular in tables                                  |
| Proof Receipt / verification honest         | Pass               | Featured receipt shows FanDuel BOARD, graded auto        |
| No fabricated zeros in sparse panels        | Pass               | Live Window shape rows show — not 0                      |
| Uppercase budget                            | Pass               | Eyebrows uppercase; headings sentence case               |
| Scanline on Live surfaces                   | Pass               | Home hero board texture                                  |
| Light theme                                 | Pass\*             | leaderboard-light-1440.png captured                      |
| Commerce $ allowed off-board                | Pass               | AUDIT-010                                                |

**Compliance: 20/22 = 91%** (2 failures: handle placeholder; legacy leaderboard/profile stat model ambiguity counted as partial on data-honesty clause).

---

## 6. Data-Integrity Findings

### Launch-context verification (UI-based; DB unreachable from agent)

| Check                                       | Expected                          | Observed                                                                         | Verdict          |
| ------------------------------------------- | --------------------------------- | -------------------------------------------------------------------------------- | ---------------- |
| Odds-verified pick count (home Live Window) | ~34                               | **35** ODDS-VERIFIED PICKS                                                       | Pass (±1 timing) |
| Platform CLV sparse state                   | Honest empty                      | "CLV distribution requires 10 closing snapshots. Current snapshots: **8 of 10**" | Pass             |
| Self-reported dominance                     | ~5142 self-reported               | Picks ledger overwhelmingly "Not Odds Verified" / pending                        | Pass             |
| robots/sitemap canonical host               | sportscappersleaderboard.com      | Confirmed in curl output                                                         | Pass             |
| QA fixture leak                             | Must not expose fixtures          | 404 body, no fixture markers                                                     | Pass             |
| Legacy board-verification implication       | Legacy picks never board-verified | Legacy badge + "Totals Only, No Per-Pick Record"; picks show tier honestly       | Pass             |

### Cross-surface reconciliation (5 cappers)

| Capper           | Leaderboard Record / ROI / Units | Profile Evidence Brief       | Match?                                            |
| ---------------- | -------------------------------- | ---------------------------- | ------------------------------------------------- |
| @wgsdfs          | 81-146-1 / +45.9% / +144.73U     | 81-146-1 / +45.9% / +144.73U | **Yes** (header); chart end **+26.75U** AUDIT-002 |
| @bankofdennis    | 636-531-24 / +35.4% / +1416.82U  | — / — / — (0 SCL graded)     | **No** AUDIT-004 (legacy totals on LB only)       |
| @mlbanalyticspro | 1749-1604-12 / +4.6% / +869.72U  | — / — / —                    | **No** AUDIT-004                                  |
| @clownsportspick | 1187-903-22 / +5.6% / +848.29U   | — / — / —                    | **No** AUDIT-004                                  |
| @Amanee330       | 288-159-10 / +10.1% / +378.93U   | — / — / —                    | **No** AUDIT-004                                  |

**Interpretation:** Non-legacy-active cappers reconcile when SCL-graded sample exists. Legacy-import totals on leaderboard do not appear in profile Evidence Brief — by implementation, not random drift — but it is still a **follower-trust defect**.

### Grading timestamp check (`/admin/grading`)

**NOT EXERCISED** — admin login credentials were not available in the cloud audit environment. Operator should verify locally that no play has `gradedAt` earlier than ~3h after event start.

---

## 7. Accessibility Report (WCAG 2.2 AA spot check)

| Criterion                  | Result | Evidence                                                         |
| -------------------------- | ------ | ---------------------------------------------------------------- |
| 1.4.3 Contrast (text)      | Pass\* | Dark theme body/labels readable; pos/neg stats use text variants |
| 1.4.11 Non-text contrast   | Pass\* | Focus rings visible on /login                                    |
| 2.1.1 Keyboard             | Pass   | Login page 10/10 focusable elements with visible focus (phase 2) |
| 2.4.3 Focus order          | Pass\* | Login tab order logical                                          |
| 2.4.7 Focus visible        | Pass   | keyboard_a11y_login_default.png                                  |
| 3.3.1 Error identification | Pass   | Login empty submit shows 1 validation error                      |
| 4.1.2 Name, role, value    | Pass\* | Search has sr-only "Find a capper"; theme toggle aria-label      |
| 1.4.1 Use of color         | Pass   | W/L/P letters on form strip; sample maturity text labels         |

\*Full automated contrast ratios not measured in this pass; recommend axe-core sweep in CI.

---

## 8. Performance Report

| Route             | HTTP | networkidle load (ms) | Notes          |
| ----------------- | ---- | --------------------- | -------------- |
| `/`               | 200  | 3138                  | Acceptable     |
| `/leaderboard`    | 200  | 3694                  | Acceptable     |
| `/picks`          | 200  | 3300                  | Acceptable     |
| `/packages`       | 200  | **4930**              | AUDIT-006      |
| `/cappers/wgsdfs` | 200  | 4344                  | Heavy profile  |
| `/api/health`     | 200  | <500                  | TTFB excellent |

LCP not reliably captured in headless Playwright (PerformanceObserver returned null); recommend field RUM on Vercel Analytics.

---

## 9. Controls Inspected but Deliberately Not Exercised

| Control                          | Location                      | Observation                                         | Why stopped                              |
| -------------------------------- | ----------------------------- | --------------------------------------------------- | ---------------------------------------- |
| Run grading / auto-grade         | /admin/grading                | NOT OPENED (no admin session)                       | Rail 4 — writes W/L to public record     |
| Suspend/disable user             | /admin/cappers/[id]           | NOT OPENED                                          | Rail 1                                   |
| Approve/reject storefront review | /admin/store-setup            | NOT OPENED                                          | Rail 3                                   |
| Edit/delete package              | /admin or capper monetization | NOT OPENED                                          | Rail 2                                   |
| Submit pick                      | /dashboard/picks/new          | NOT OPENED                                          | Rail 8                                   |
| Forgot-password send             | /forgot-password              | Form validated empty only                           | Rail 6                                   |
| Support form submit              | /support                      | NOT OPENED                                          | Rail 6                                   |
| Policy publish                   | /admin/policies               | NOT OPENED                                          | Rail 7                                   |
| Signup complete                  | /signup                       | Page rendered; submit disabled without valid fields | Would create account — skipped full flow |

---

## 10. Test Artifacts Created

**None.** No disposable signup, picks, or DB writes were performed during this audit.

---

## 11. Prioritised Remediation Plan

### Fix before telling cappers the public record is audit-grade

1. **AUDIT-002** — Reconcile profile chart end balance with Evidence Brief units (engineer: 4–8h).
2. **AUDIT-004** — Unify legacy totals presentation across leaderboard and profile (product + eng: 1–2 days).
3. **AUDIT-001** — Fix avatar image optimizer / Supabase host alignment (eng: 2–4h).

### Fix this week

4. **AUDIT-003** — Rename "Handle" placeholder (30 min).
5. **AUDIT-005** — Return HTTP 404 for /qa/\* in production (1h).
6. **AUDIT-006** — Paginate /packages (4–8h).
7. Run **admin grading timestamp audit** locally with OWNER_ADMIN_EMAIL session.

### Backlog

8. **AUDIT-008** — sitemap mobile overflow.
9. **AUDIT-009** — Footer copyright year.
10. Add Playwright production smoke for QA 404 status + avatar 200.

---

## 12. What Is Working Well (protect during fixes)

- **Sparse verification UX on home** is launch-appropriate: 35 odds-verified picks, honest — in Platform CLV and shape breakdowns, explicit "No Odds-Verified player props/futures" copy.
- **Legacy import transparency**: Legacy Capper badge + long tooltip about carried-over totals without per-pick evidence.
- **Pick ledger honesty**: Pending picks labeled "Not Odds Verified"; pick hidden until event start.
- **SEO infrastructure**: robots.txt and sitemap.xml use `https://sportscappersleaderboard.com`.
- **Auth gating**: `/admin` and `/dashboard` redirect unauthenticated users to login with callbackUrl.
- **Responsive quality**: No product-page horizontal overflow from 375–1920 including 150%/200% zoom on leaderboard.
- **@wgsdfs** leaderboard ↔ Evidence Brief header stats match exactly when SCL sample exists.

---

## 13. Evidence Index

| Artifact              | Path                                    |
| --------------------- | --------------------------------------- |
| Phase 1 JSON          | /workspace/audit-report.json            |
| Phase 2 JSON          | /workspace/audit-phase2.json            |
| Capper reconciliation | /workspace/capper-profiles-audit.json   |
| Screenshots (112+)    | /opt/cursor/artifacts/screenshots/      |
| Audit script          | /workspace/scripts/audit-production.mjs |

### Key screenshots

- Home desktop: `home-desktop.png`
- Leaderboard: `leaderboard-desktop.png`
- Legacy profile gap: `capper_profile_bankofdennis.png`
- Chart mismatch: `wgsdfs-chart-audit.png`, `capper_profile_wgsdfs.png`
- Picks honesty: `picks-desktop-audit.png`
- QA 404 body: `qa-board-odds-hygiene-desktop.png`
- Light theme: `leaderboard-light-1440.png`

---

## 14. Skipped Scope (explicit)

| Item                                 | Reason                                                                                         |
| ------------------------------------ | ---------------------------------------------------------------------------------------------- |
| Direct Postgres queries              | Network blocked from cloud agent to Supabase :5432/:6543                                       |
| Admin console pages                  | No admin password in cloud environment                                                         |
| Capper dashboard authenticated flows | No legacy capper credentials file (`C:\Users\chase\legacy-dumps\credentials.json` not mounted) |
| Login with imported capper           | Same as above                                                                                  |
| Email send paths                     | Rail 6                                                                                         |
| Full WCAG contrast automation        | Tooling not run; spot checks only                                                              |
| prefers-reduced-motion               | Not exercised                                                                                  |

---

_Audit completed 2026-08-06 UTC. All findings tied to artifacts above._
