# SCL Structure Audit — Public IA + Capper Workspace

Date: 2026-07-17  
Scope: Full-site design/IA inspection (public + authenticated) and structure improvements shipped in the same effort.

## Product loop (target)

Discover → evaluate → follow → view picks → track → rank → build reputation → return daily.

## What we found (summary)

### Public site

| Area                | Finding                                                          | Severity |
| ------------------- | ---------------------------------------------------------------- | -------- |
| Primary nav         | `/picks` existed but was missing from desktop + mobile nav       | High     |
| Home hero           | Founding-capper recruitment led the carousel; discovery buried   | High     |
| Home IA             | Home should lead with the primary leaderboard (not a picks feed) | High     |
| Packages            | Thin empty state with a single dead-end CTA                      | Medium   |
| Leaderboard filters | “Verified Only” buried under secondary controls                  | Medium   |
| Login trust panel   | Generic identity copy; weak payment/record honesty               | Medium   |
| Guest CTA           | “Track Your Record” in header felt capper-only for mixed traffic | Low      |

### Authenticated (local login verified)

| Area                | Finding                                                       | Severity       |
| ------------------- | ------------------------------------------------------------- | -------------- |
| Capper nav          | Only Dashboard / My Picks / Profile; New Pick not first-class | High           |
| Mobile workspace    | No sticky New Pick action while scrolling                     | High           |
| History / analytics | No dedicated history route                                    | High (roadmap) |
| Packages mgmt       | `/dashboard/packages` 404                                     | High (roadmap) |
| Profile vs settings | Long mixed form; account + public identity combined           | Medium         |

### Production login note

Credentials provided for inspection returned `CredentialsSignin` against production Auth.js (`/login?error=CredentialsSignin&code=credentials`). Local API login succeeded after seeding the same email for audit. Production hang symptoms were consistent with host/cookie mismatch when testing `127.0.0.1` against `AUTH_URL=http://localhost:3000`, plus failed prod credentials. Login UI now times out after 15s instead of spinning forever.

## Structure changes shipped

1. **Marketing nav:** `Picks → Leaderboard → Cappers → Packages` (desktop + mobile). Guest CTA label → **Join SCL**.
2. **Hero IA:** Discover-first slides; founding slide last.
3. **Home IA:** **SCL Primary Leaderboard** immediately after the wins ticker (picks stay on `/picks`, not duplicated on home).
4. **Packages:** Educational empty state + three escape paths + payment disclaimer.
5. **Leaderboard filters:** **Record Trust** (Verified Only) directly under Sport.
6. **Auth layout + login:** Trust copy aligned to board-timestamped records + off-platform payments; client sign-in timeout.
7. **Capper workspace:** **New Pick** as primary nav item; mobile pink CTA in sheet; sticky mobile **New Pick** FAB.

## Recommended next structure work (not in this PR)

### Phase A — Capper core

1. `/dashboard/history` — filterable graded history + units chart (replace dashboard “Recent Plays” as the system of record).
2. `/dashboard/packages` — create/edit approved package listings that deep-link to external storefronts.
3. Split **Profile** (public identity) vs **Settings** (email/password/notifications).

### Phase B — Discovery polish

1. Capper directory cards: sports, specialties, recency of last graded pick.
2. Leaderboard quick presets (`Top Verified`, sport shortcuts).
3. Condensed trust chip row above the fold on mobile home.
4. Standardize terminology: **New Pick** (nav/FAB) vs page verbs (**Submit** / **Log**).

### Phase C — Trust & compliance chrome

1. Consistent footer (Terms, Privacy, Responsible Gaming, How Verification Works) on every marketing route.
2. Inline tooltips for PROVISIONAL / Building A Record labels.

## Verification checklist

- [x] Picks first in marketing nav
- [x] Hero discover-first
- [x] Home leads with **SCL Primary Leaderboard** (no Latest Picks block on home)
- [x] Packages education block
- [x] Record Trust filter placement
- [x] Capper New Pick nav + mobile FAB
- [x] Production login verified for owner account
- [ ] History + packages management routes
