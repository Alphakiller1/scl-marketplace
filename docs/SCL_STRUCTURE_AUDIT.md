# SCL Structure Audit — Public IA + Capper Workspace

Date: 2026-07-17  
Scope: Full-site design/IA inspection (public + authenticated) and structure improvements.

## Product loop (target)

Discover → evaluate → follow → view picks → track → rank → build reputation → return daily.

## Original findings → status

### Public site

| Finding                                                       | Severity | Status                                                                                |
| ------------------------------------------------------------- | -------- | ------------------------------------------------------------------------------------- |
| Picks missing from primary nav                                | High     | **Done** — Picks first in desktop + mobile nav                                        |
| Hero buried discovery / founding-first                        | High     | **Reverted** — owner word-for-word slide copy restored (founding-first order)         |
| Home should lead with primary leaderboard (not picks feed)    | High     | **Done** — SCL Primary Leaderboard first; Latest Picks removed from home              |
| Capper cards missing sports / specialties / last-pick recency | High     | **Done** — `CapperCard` surfaces sports chips, specialties, last pick                 |
| Packages empty state dead-end                                 | Medium   | **Done** — education + escape CTAs                                                    |
| Verified Only buried in filters                               | Medium   | **Done** — Record Trust under Sport + quick presets                                   |
| Login trust copy generic                                      | Medium   | **Done** — board-timestamped / off-platform payments                                  |
| Guest “Track Your Record” vague                               | Low      | **Done** — Join SCL in marketing header                                               |
| Footer missing How Verification Works                         | Low      | **Done** — footer link to `#how-verification-works`                                   |
| Provisional label no explanation on cards                     | Low      | **Done** — `ProvisionalRecordHelp` on cards                                           |
| New Pick vs Submit A Play inconsistency                       | Medium   | **Done** — dashboard / picks / entry use **New Pick**                                 |
| Mobile home trust signals below fold                          | Medium   | **Done** — condensed trust chip row above primary board                               |
| Leaderboard filter overload                                   | Medium   | **Partial** — Record Trust + quick presets (Top Verified / NFL / NBA / MLB / Hot 30D) |

### Authenticated

| Finding                                   | Severity | Status             |
| ----------------------------------------- | -------- | ------------------ |
| New Pick not first-class in workspace nav | High     | **Done**           |
| No sticky mobile New Pick                 | High     | **Done** — FAB     |
| `/dashboard/history` missing              | High     | **Open** — Phase A |
| `/dashboard/packages` 404                 | High     | **Open** — Phase A |
| Profile vs Settings mixed                 | Medium   | **Open** — Phase A |

## Still open (larger builds)

1. Capper **History** page (filterable graded history + units chart)
2. Capper **Packages** management UI
3. Split **Profile** vs **Settings**

## Verification checklist

- [x] Picks-first marketing nav
- [x] Owner-approved hero slide copy (word-for-word; founding → discover → verify)
- [x] Home = SCL Primary Leaderboard first (no Latest Picks block)
- [x] Capper cards: sports + specialties + last pick + provisional help
- [x] Leaderboard Record Trust + quick presets
- [x] Packages education empty state
- [x] Auth trust copy + login timeout
- [x] Capper New Pick nav + FAB + terminology
- [x] Footer How Verification Works
- [x] Home trust chip row
- [ ] History + packages management routes
