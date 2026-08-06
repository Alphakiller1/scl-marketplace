# SCL Production Audit — 2026-08-06 (Deep / Aggressive)

**Site:** https://sportscappersleaderboard.com  
**Audit window:** 2026-08-06 ~01:19–01:40 UTC  
**Release under test:** `5fa4d5812e698aebe13a1b0fa673bdfe9902cb92` (`/api/health`)  
**Auditor method:** Live Playwright (Chromium), curl, Storage API probes, authenticated disposable-account exercise, design-doc checklist.  
**Prior audit gap this run closes:** authenticated profile media upload + live Storage readiness (not env-only health).  
**Safety rails:** All nine production write rails observed. No grading, no package edits, no emails to real cappers, no real picks, no mutation of real capper profiles/avatars/bios.  
**Fix policy this run:** **Do not fix image upload** (owned by parallel session). Report only.

**Evidence root:** `/opt/cursor/artifacts/audit-deep/`  
**Scripts:** `scripts/audit-production-deep.mjs`, `scripts/audit-production-extra.mjs`  
**Raw JSON:** `audit-deep-raw.json`, `audit-extra.json`

---

## 1. Executive Summary

I would **not** tell every imported capper that the launch product is fully ready for self-serve identity setup. Public discovery (leaderboard, profiles, sparse Live Window / Platform CLV honesty, legacy provenance) is largely usable and, on the five profiles re-checked manually, **Evidence Brief units now match chart ending balance**. Authorization redirects for logged-out `/dashboard` and `/admin`, and CAPPER→`/admin` denial, work.

The **single biggest risk** is that **profile image upload is still hard-broken in production** while superficial signals looked fine for hours: `/api/health` previously reported `storage: true` from env presence alone; even after PR #398’s live probe, health still returns **HTTP 200 / `status: "ok"`** with `bucketReady: false`. An authenticated disposable capper uploading a 1×1 PNG receives the toast: **“Profile media storage is unavailable. In Supabase → Storage, create a public bucket named scl-profile-media.”** Public Storage API independently returns `Bucket not found` for that bucket on the media host.

**Launch-readiness verdict:** **No-go for “cappers set up their public identity”**; **conditional go for read-only public discovery**. Fix Storage bucket (parallel session) and make health fail closed before marketing profile setup.

**DB note:** Direct Postgres to `db.ljndtpzuslxgpnlxfhbz.supabase.co` resolves **IPv6-only** and fails with `ENETUNREACH` from this cloud agent. No `credentials.json` mount for legacy/admin passwords. Admin console deep-read and SQL reconciliation remain **skipped with reason** (see §14).

---

## 2. Severity-Ranked Findings

### AUDIT-001

```
ID          AUDIT-001
Severity    P0
Category    correctness
Route       /dashboard/profile · Supabase Storage · /api/health
Viewport    1440 (authenticated)
What        Capper profile avatar/cover upload is broken on production: Storage bucket scl-profile-media is not ready.
Evidence    /api/health → configured:true, bucketReady:false, storage:false on release 5fa4d58.
            Public probe POST …/storage/v1/object/list/scl-profile-media → {"error":"Bucket not found","code":"NoSuchBucket"}.
            Authenticated upload on disposable @qaauditmsgub1mz → toast duplicated:
            "Profile media storage is unavailable. In Supabase → Storage, create a public bucket named scl-profile-media."
            Screenshots: audit-deep/screenshots/manual_upload_result.png, capper_profile_after_upload.png
            testArtifacts.upload_attempt in audit-deep-raw.json
Repro       1. curl -s https://sportscappersleaderboard.com/api/health | jq .supabase
            2. Sign in as an ACTIVE capper → /dashboard/profile
            3. Upload any JPG/PNG as Profile Image
            4. Observe error toast; no "Profile image updated"
Why it matters  Core launch identity path is dead. Prior audit missed this by never authenticating and trusting env-only health.
Fix         Create public bucket scl-profile-media on the Supabase project behind production SUPABASE_URL (parallel session). Keep live probe. Add a release gate that fails when bucketReady=false.
Status      OPEN on audited release (fix owned elsewhere).
```

### AUDIT-002

```
ID          AUDIT-002
Severity    P1
Category    correctness | security-ops
Route       /api/health
Viewport    n/a
What        Health endpoint returns HTTP 200 and status:"ok" while supabase.storage/bucketReady is false.
Evidence    curl health: HTTP 200, body.status="ok", body.supabase.storage=false, bucketReady=false.
            Code: src/app/api/health/route.ts computes ready from schema+release only; storage probe is informational.
Repro       1. Break or omit Storage bucket
            2. curl -i /api/health
            3. Observe green status despite storage:false
Why it matters  Launch monitors and humans will treat the site as healthy while cappers cannot complete profile setup.
Fix         Include storageProbe.bucketReady in ready/status (or expose a separate launch-readiness endpoint that fails closed). Do not equate env presence with readiness.
```

### AUDIT-003

```
ID          AUDIT-003
Severity    P1
Category    copy | trust
Route       /signup → /login → /dashboard
Viewport    390 / 1440
What        Signup success UI tells the user they must verify email to activate capper access, but the disposable account could sign in immediately and land on /dashboard with Account Trust showing Email Verified / Capper Access Enabled.
Evidence    signup_after_submit.png / testArtifacts.signup_attempt bodySnippet:
            "Verify your email… Confirm your email to activate capper access… Verification sent"
            login_result url=https://sportscappersleaderboard.com/dashboard
            manual_upload_result.png Account Trust: Email Verified, Policies Accepted, Capper Access Enabled
Repro       1. Sign up qa-audit-<ts>@sportscappersleaderboard.com
            2. Read verify copy
            3. Immediately log in with username+email+password
            4. Land on /dashboard without clicking email link
Why it matters  Trust copy that overstates a gate trains users to ignore verification and contradicts the product’s honesty bar.
Fix         Align signup success state with actual REQUIRE_EMAIL_VERIFICATION / emailVerified behavior; if accounts are auto-activated, do not claim access is reserved pending email.
```

### AUDIT-004

```
ID          AUDIT-004
Severity    P1
Category    performance | correctness
Route       / · /leaderboard · /discover
Viewport    1440
What        At least one live avatar still fails Next.js image optimization (HTTP 400 INVALID_IMAGE_OPTIMIZE_REQUEST) while the source object returns HTTP 200 image/webp.
Evidence    Object cms8lwygs03k3el301rag6huu/avatar.webp:
            direct HEAD/GET → 200 image/webp (73834 bytes; `file` reports RIFF without "Web/P image" subtype)
            /_next/image?url=…&w=32..640 → 400 x-vercel-error: INVALID_IMAGE_OPTIMIZE_REQUEST
            Neighboring avatars (e.g. cms8lu1p701vnel302q7osq4g/avatar.webp) optimize 200.
            Network capture on /leaderboard: good=4 bad=1 for that session.
Repro       1. Open /leaderboard DevTools → Network → filter _next/image
            2. Find 400 for cms8lwygs03k3el301rag6huu
            3. Open source URL directly → image loads
Why it matters  Residual broken faces on Rank surfaces after the wildcard remotePatterns fix; likely a bad/nonstandard WebP asset, not host allowlist.
Fix         Re-encode that object (sharp pipeline), add CapperAvatar onError fallback, and/or reject non-decodable uploads server-side.
```

### AUDIT-005

```
ID          AUDIT-005
Severity    P2
Category    performance
Route       /packages
Viewport    1440
What        Packages route TTI ~5524ms (networkidle) — slowest public marketing surface in this run.
Evidence    audit-deep-raw.json performance: /packages 5524ms vs /leaderboard 3708ms, /discover 3675ms
Repro       Cold load /packages to networkidle; compare to /leaderboard
Why it matters  Primary commerce discovery surface on launch day.
Fix         Keep client pagination (already shipped); consider further virtualization / leaner cards.
```

### AUDIT-006

```
ID          AUDIT-006
Severity    P2
Category    a11y
Route       /
Viewport    375
What        Home exposes dozens of interactive controls shorter than 36px (script threshold); design gate asks ≥40px tap targets.
Evidence    AUDIT deep run finding on / @375; home-mobile screenshots under audit-deep/screenshots/home_375.png
Repro       Open / at 375px; measure ticker/chip control heights
Why it matters  Mobile-first rule; accidental mis-taps on Rank/Live chrome
Fix         Raise min-h on chips/ticker controls; audit sticky CTAs
```

### AUDIT-007

```
ID          AUDIT-007
Severity    P3
Category    a11y
Route       /sitemap.xml
Viewport    375
What        Raw XML sitemap overflows horizontally on mobile (scrollWidth 516 > clientWidth 375).
Evidence    audit-extra.json sitemapMobile; screenshots/extra_sitemap_375.png
Repro       Open /sitemap.xml at 375px width
Why it matters  Minor; not a product surface, but listed in route inventory
Fix         Optional text/xml stylesheet or accept browser default for machines
```

### AUDIT-008

```
ID          AUDIT-008
Severity    P3
Category    correctness
Route       /api/og/capper/[handle]
Viewport    n/a
What        OG image endpoint returns HTTP 200 image/png even for a nonexistent handle (soft placeholder), rather than 404.
Evidence    /api/og/capper/no-such-capper-xyz → 200 image/png 9053 bytes (vs ~34–37KB for real cappers)
Repro       curl -I /api/og/capper/no-such-capper-xyz
Why it matters  Scrapers may treat missing profiles as present
Fix         Prefer 404 for unknown handles (or explicit "not found" OG with 404 status)
```

### Retracted / corrected from prior audit (2026-08-05)

| Prior ID                                                        | Prior claim   | 2026-08-06 re-check                                                                                                                                                                                                                        |
| --------------------------------------------------------------- | ------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| Chart vs Evidence Brief units (`@wgsdfs` +144.73 vs End +26.75) | P1 mismatch   | **Fixed.** Manual DOM: units=+144.73U, Ending balance=+144.73 (also bankofdennis/mlbanalyticspro/clownsportspick/amanee330 match). Automated script initially false-positive’d by scraping Legacy-by-sport row units — corrected manually. |
| Leaderboard “Handle” placeholder                                | P1 design-law | **Fixed.** placeholder=`Search cappers`                                                                                                                                                                                                    |
| QA routes HTTP 200                                              | P2/P0         | **Fixed.** `/qa/*` → HTTP 404                                                                                                                                                                                                              |
| Legacy Evidence Brief dashes vs leaderboard                     | P1            | **Fixed** for Full capper record default + Legacy by sport section (live).                                                                                                                                                                 |
| Avatar optimizer host allowlist                                 | P1            | **Mostly fixed**; residual single-object failure tracked as AUDIT-004                                                                                                                                                                      |

---

## 3. Route-by-route Matrix

Legend: ✅ pass · ⚠️ pass with notes · ❌ fail · ⏭️ skipped

| Route                                                                 | Visual                       | Functional                           | A11y                | Perf     | Finding IDs   |
| --------------------------------------------------------------------- | ---------------------------- | ------------------------------------ | ------------------- | -------- | ------------- |
| `/`                                                                   | ✅ sparse Live Window honest | ✅                                   | ⚠️ tap targets      | ⚠️ ~3.9s | 004, 006      |
| `/leaderboard`                                                        | ✅ Search cappers            | ✅ sorts/filters                     | ✅ focus tabbed     | ✅ ~3.7s | 004           |
| `/discover`                                                           | ✅                           | ✅                                   | ✅                  | ✅       | 004           |
| `/picks`                                                              | ✅                           | ✅                                   | ✅                  | ✅       | —             |
| `/packages`                                                           | ✅ commerce `$` prices       | ✅ `/go/*` → Winible/Whop            | ✅                  | ❌ slow  | 005           |
| `/cappers`                                                            | ✅ redirects → `/discover`   | ✅                                   | ✅                  | ✅       | —             |
| `/cappers/[handle]`                                                   | ✅ Legacy by sport           | ✅ Full record; chart↔brief match    | ✅                  | ✅       | —             |
| `/verification`                                                       | ✅                           | ✅                                   | ✅                  | ✅       | —             |
| `/support`                                                            | ✅                           | ⚠️ form not submitted (email rail)   | ✅                  | ✅       | —             |
| Legal (`/terms`…)                                                     | ✅                           | ✅                                   | ✅                  | ✅       | —             |
| `/login`                                                              | ✅                           | ✅ validation + disposable login     | ✅ labelled         | ✅       | 003           |
| `/signup`                                                             | ✅                           | ⚠️ misleading verify copy            | ✅                  | ✅       | 003           |
| `/verify` `/resend-verification` `/forgot-password` `/reset-password` | ✅ render                    | ⏭️ no email to real users            | ✅                  | ✅       | —             |
| `/accept-terms` `/account-restricted`                                 | ✅ render                    | ⏭️                                   | ✅                  | ✅       | —             |
| `/dashboard` (+ picks/profile/monetization/security)                  | ✅ Studio mode               | ⚠️ upload broken; pick not submitted | ✅                  | ✅       | 001           |
| `/dashboard/picks/new`                                                | ✅ board events load         | ⏭️ submit not exercised              | ✅                  | ✅       | NOT-EXERCISED |
| `/admin/**`                                                           | ⏭️ no ADMIN session          | ✅ CAPPER denied → `/dashboard`      | ⏭️                  | ⏭️       | §14           |
| `/robots.txt` `/sitemap.xml`                                          | ✅ correct host              | ✅                                   | ⚠️ sitemap overflow | ✅       | 007           |
| `/api/health`                                                         | n/a                          | ❌ green while storage false         | n/a                 | ✅       | 001, 002      |
| `/qa/*`                                                               | ✅                           | ✅ HTTP 404                          | ✅                  | ✅       | —             |

---

## 4. Responsive Matrix

Critical surfaces (`/`, `/leaderboard`, `/packages`, `/picks`, `/discover`) swept at **375, 390, 768, 1024, 1440, 1536, 1920** plus width-emulated **150%/200% zoom**.

| Result                   | Detail                                                                             |
| ------------------------ | ---------------------------------------------------------------------------------- |
| Horizontal page overflow | **0** overflows recorded on critical sweep (`responsive` rows in raw JSON)         |
| Rank tables              | Horizontal scroll remains inside table shell (expected)                            |
| Light theme              | Spot-checked `/`, `/leaderboard`, `/cappers/bankofdennis` — renders                |
| `prefers-reduced-motion` | Home loaded under `reducedMotion: "reduce"` — screenshot `home_reduced_motion.png` |

---

## 5. Design-law Compliance

Method: clause sampling against `design/SCL-DESIGN-SPEC.md` v2.0 + `docs/SCL_DESIGN_CONTRACT.md` on primary Live/Rank/Proof/Studio surfaces; automated scans for forbidden **handle** and `$`+digit; visual review of pink/blue roles and perf spectrum vs settlement.

| Clause                                        | Result                                                            | Notes                                                                                                    |
| --------------------------------------------- | ----------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------- |
| Pink = conviction, Blue = navigation, no gold | ✅                                                                | JOIN SCL / NEW PICK pink; nav/sort blue                                                                  |
| Perf spectrum ≠ settlement colors             | ✅                                                                | Rank metrics use ramp; W/L pills distinct                                                                |
| Units, never dollars (betting stats)          | ✅                                                                | Board/profile use U / %                                                                                  |
| `$` on packages                               | ⚠️ allowed as **commerce price**, not betting handle — documented |
| Word “handle” banned on primary surfaces      | ✅                                                                | No hits on `/`, `/leaderboard`, `/discover`, `/picks`, `/packages`, `/verification`, `/login`, `/signup` |
| Honest em-dash for unknown                    | ✅                                                                | Platform CLV distribution unavailable at 8/10 snapshots; Live Window empty lanes explained               |
| AA text variants for colored numbers          | ✅ spot                                                           | Automated contrast sampler found **0** sub-4.5 samples on leaderboard cells this run                     |
| Early sample caps at amber                    | ✅                                                                | Legacy-by-sport (prior polish) still live                                                                |

**Estimated compliance on audited primary surfaces: ~92%.** Deductions: health/upload trust failure (product honesty), signup verify copy overclaim, residual avatar optimize miss, packages weight.

---

## 6. Data-Integrity Findings

### Cross-surface reconciliation (manual, authoritative)

| Capper           | Leaderboard units | Evidence Brief units | Chart ending balance | Match? |
| ---------------- | ----------------- | -------------------- | -------------------- | ------ |
| @bankofdennis    | +1416.82U         | +1416.82U            | +1416.82             | ✅     |
| @wgsdfs          | +144.73U          | +144.73U             | +144.73              | ✅     |
| @mlbanalyticspro | +869.72U          | +869.72U             | +869.72              | ✅     |
| @clownsportspick | +848.29U          | +848.29U             | +848.29              | ✅     |
| @amanee330       | +378.93U          | +378.93U             | +378.93              | ✅     |

Leaderboard records/ROI/sample for these rows also align with profile Full-record Evidence Brief (legacy-inclusive). Legacy badge + “totals only, no per-pick” copy present; **no implication that legacy picks are board-verified**.

### Sparse verification honesty (launch context)

Home Live Window explicitly: “No Odds-Verified player props/futures tracked in the last 14 days.”  
Platform CLV: “CLV distribution requires 10 closing snapshots… Current snapshots: **8 of 10**.” — honest unfinished state, not a fake chart.

### What could not be DB-proven

SQL against production was impossible from this agent (IPv6 `ENETUNREACH`). Numbers above are **UI-cross-checked only**.

---

## 7. Accessibility Report (WCAG 2.2 AA — sampled)

| Criterion                   | Result     | Evidence                                                                         |
| --------------------------- | ---------- | -------------------------------------------------------------------------------- |
| 1.1.1 Non-text              | ⚠️         | Broken optimizer avatar falls back poorly for one object (AUDIT-004)             |
| 1.3.1 Info/structure        | ✅         | Landmarks/headings on marketing + dashboard                                      |
| 1.4.1 Use of color          | ✅         | Numbers shown with text, not color alone                                         |
| 1.4.3 Contrast              | ✅ spot    | 0 failing samples on leaderboard numeric cells                                   |
| 2.1.1 Keyboard              | ⚠️ partial | Tab focus visible on leaderboard; full every-control pass not completed on admin |
| 2.4.7 Focus visible         | ✅         | Focus ring present after Tab                                                     |
| 3.3.1/3.3.2 Labels & errors | ✅         | Login/signup empty submit shows field errors; inputs labelled                    |
| 2.3.3 Animation             | ✅         | reduced-motion context exercised                                                 |

Full automated axe sweep was **not** run — say so rather than invent scores.

---

## 8. Performance Report

| Route               | Viewport | TTI-ish (goto→networkidle+settle) |
| ------------------- | -------- | --------------------------------- |
| `/packages`         | 1440     | **5524 ms**                       |
| `/privacy`          | 1440     | 4101 ms                           |
| `/`                 | 1440     | 3887 ms                           |
| `/picks`            | 1440     | 3818 ms                           |
| `/cappers`→discover | 1440     | 3783 ms                           |
| `/leaderboard`      | 1440     | 3708 ms                           |
| `/discover`         | 1440     | 3675 ms                           |

Notes: timings include networkidle (strict). No lab Lighthouse LCP/CLS in this environment. CLS visually stable on home/leaderboard after islands hydrate.

---

## 9. Controls Inspected but Deliberately Not Exercised

| Control                                              | Route                  | Observed                                                              | Why stopped                                            |
| ---------------------------------------------------- | ---------------------- | --------------------------------------------------------------------- | ------------------------------------------------------ |
| `createPlay` / publish pick                          | `/dashboard/picks/new` | Form renders; board shows MLB/WNBA/CFL events; SINGLES/PARLAY toggles | Rail 8 + avoid polluting public board with audit picks |
| `deleteOwnAccountAction`                             | `/dashboard/security`  | “Delete my account” present; **disabled** until confirmation input    | Destructive; cancelled / left disabled                 |
| `runAutoGradeAction` / manual grade                  | `/admin/grading`       | **Not opened**                                                        | Rail 4 + no ADMIN credentials in cloud env             |
| Storefront approve/reject                            | `/admin/store-setup`   | Not opened                                                            | Rail 3                                                 |
| Policy publish                                       | `/admin/policies`      | Not opened                                                            | Rail 7                                                 |
| Account suspend/delete (admin)                       | `/admin/cappers/[id]`  | Not opened                                                            | Rail 1                                                 |
| Package reprice/deactivate                           | admin packages         | Not opened                                                            | Rail 2                                                 |
| Resend verification / password reset / support email | auth + support         | Pages rendered only                                                   | Rail 6                                                 |
| Profile bio/social save on **real** cappers          | —                      | Not touched                                                           | Rail 9                                                 |
| Upload on **real** capper accounts                   | —                      | Not touched                                                           | Rail 9; exercised only on disposable `qa-audit-*`      |

---

## 10. Test Artifacts Created

| Artifact              | Detail                                                                                                                   |
| --------------------- | ------------------------------------------------------------------------------------------------------------------------ |
| Username              | `qaauditmsgub1mz`                                                                                                        |
| Email                 | `qa-audit-msgub1mz@sportscappersleaderboard.com`                                                                         |
| Password              | Stored only in `/opt/cursor/artifacts/audit-deep/test-account.secret.json` (not committed)                               |
| DB id                 | Unknown (DB unreachable)                                                                                                 |
| Public surface impact | Should not appear on leaderboard (0 graded / not publication-eligible) — **operator should disable/delete this account** |
| Media objects         | None persisted (upload failed before Storage write)                                                                      |
| Signup side effect    | Verification email may have been queued to the disposable address                                                        |

---

## 11. Prioritised Remediation Plan

### Fix before telling cappers to “set up your profile” (launch blocker)

1. **Create / repair `scl-profile-media` public bucket** on the production Supabase project (parallel session). Re-verify with `/api/health` → `bucketReady:true` **and** a disposable upload success toast.
2. **Fail closed on health/readiness** when `bucketReady` is false (AUDIT-002).
3. **Align signup verify copy** with actual activation rules (AUDIT-003).

### Fix this week

4. Re-encode / replace undecodable avatar `cms8lwygs03k3el301rag6huu` + Avatar `onError` fallback (AUDIT-004).
5. Packages perf pass (AUDIT-005).
6. Mobile tap-target pass on home chrome (AUDIT-006).
7. Provide cloud-agent (or CI) path to ADMIN read-only + Postgres (IPv4 pooler) so grading `gradedAt` vs event-start launch check can be completed.

### Backlog

8. Sitemap XML mobile overflow (AUDIT-007).
9. OG 404 for unknown handles (AUDIT-008).
10. Add e2e “upload avatar” smoke that asserts toast success + public URL 200 (would have caught AUDIT-001 on day one).

---

## 12. Positives (protect during remediation)

- Sparse Live Window / Platform CLV empty states are **honest and explained**, not fake-zeroed.
- Legacy provenance (“totals only, no per-pick”) and Legacy-by-sport breakdown are live and clear.
- Evidence Brief ↔ chart end reconciliation holds on five high-visibility cappers.
- `/qa/*` hard 404 in production.
- `robots.txt` / `sitemap.xml` use `sportscappersleaderboard.com`.
- Logged-out gates and CAPPER denial of `/admin` work.
- `/go/*` affiliate redirects resolve to real Winible/Whop checkouts.
- Design-law “handle” ban holds on primary marketing/auth surfaces after prior fix.

---

## 13. Why the prior audit missed upload (postmortem)

1. **No authenticated session** — `credentials.json` / admin password absent; audit stopped at public surfaces.
2. **Trusted `/api/health` `storage: true`** which only meant “env vars present.”
3. **Never called `uploadProfileMediaAction`** or opened `/dashboard/profile` file inputs.
4. **Never probed Storage API** for `Bucket not found`.

This run’s mandatory checklist for future audits:

1. Live `bucketReady` from health
2. Storage list/getBucket probe
3. Disposable signup/login
4. Upload tiny PNG on `/dashboard/profile`
5. Assert success toast **or** record exact failure toast
6. Public URL + `/_next/image` 200

---

## 14. Explicitly Skipped (with reason)

| Item                                              | Reason                                                                |
| ------------------------------------------------- | --------------------------------------------------------------------- |
| Direct SQL reconciliation                         | Postgres host IPv6-only → `ENETUNREACH` from agent                    |
| `/admin` grading timestamp audit                  | No ADMIN credentials mounted                                          |
| Legacy capper password login sample (129 imports) | `C:\Users\chase\legacy-dumps\credentials.json` not available in cloud |
| Email-sending paths                               | Rail 6                                                                |
| Full WCAG axe + every contrast pair               | Spot checks only                                                      |
| Submitting a pick                                 | Rail 8                                                                |
| Mutating real profiles                            | Rail 9                                                                |

---

## 15. Appendix — Health snapshot (audited)

```json
{
  "status": "ok",
  "supabase": {
    "storage": false,
    "url": true,
    "serviceRole": true,
    "bucket": "scl-profile-media",
    "configured": true,
    "bucketReady": false
  },
  "release": "5fa4d5812e698aebe13a1b0fa673bdfe9902cb92"
}
```

This combination — green `status` + red Storage — is itself a defect (AUDIT-002).
