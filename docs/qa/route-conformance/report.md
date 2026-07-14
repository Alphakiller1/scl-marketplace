# Route conformance QA — application cleanup

Base: local production build (`next start`) after this PR’s changes.  
Viewports: 375×812 and 1280×800 · themes: dark + light.

## Summary

| Status | Count                                                                                                 |
| ------ | ----------------------------------------------------------------------------------------------------- |
| PASS   | 58                                                                                                    |
| FAIL   | 0                                                                                                     |
| WARN   | 22 (mostly empty numeric samples on empty pick-entry / font stack still Geist Mono pending system PR) |
| SKIP   | 0                                                                                                     |

Automated findings: `npx tsx scripts/route-conformance-qa.ts`

## Route-by-route (before → after)

### `/`

| Check                                           | Before                                                                | After                                                                   |
| ----------------------------------------------- | --------------------------------------------------------------------- | ----------------------------------------------------------------------- |
| Brand / hero coherence                          | FAIL — magenta brand gradient wordmark, `scl-brand-text`, brand icons | PASS — ink surfaces, display type, gold primary CTAs only               |
| Gold scarcity                                   | FAIL — brand accents masquerading as identity                         | PASS — gold on Explore / Become CTAs + verified badge                   |
| Numeric mono (`.nums` → `scl-data`/`StatValue`) | FAIL                                                                  | PASS (class-level); computed face still Geist Mono until system font PR |
| Overflow @375                                   | FAIL risk                                                             | PASS `delta=0`                                                          |
| Tap targets @375                                | mixed                                                                 | PASS ≥40px                                                              |

Screenshots: `home-375-dark.png`, `home-375-light.png`, `home-1280-dark.png`

### `/leaderboard`

| Check                | Before                                | After                                                              |
| -------------------- | ------------------------------------- | ------------------------------------------------------------------ |
| Filter pills         | FAIL — magenta/`brand` selected state | PASS — gold selected sport-pill recipe, min-h-11                   |
| Eyebrow / metrics    | FAIL — `text-brand` + `.nums`         | PASS — muted mono eyebrow, `StatValue`, gold-deep section hairline |
| Overflow / taps @375 | —                                     | PASS                                                               |

Screenshots: `leaderboard-375-dark.png`, `leaderboard-1280-dark.png`

### `/picks`

| Check                | Before                              | After                                                               |
| -------------------- | ----------------------------------- | ------------------------------------------------------------------- |
| Ticket eyebrow gold  | FAIL — `SCL · Pick Receipt` in gold | PASS — muted-label eyebrow; gold reserved for stamp / odds / to-win |
| Section header brand | FAIL                                | PASS — ink icon well + gold hairline                                |
| Overflow @375        | —                                   | PASS                                                                |

Screenshot: `picks-375-dark.png`

### `/dashboard/picks/new`

| Check                               | Before                     | After                                                                  |
| ----------------------------------- | -------------------------- | ---------------------------------------------------------------------- |
| “Verified Board Entry” gold eyebrow | FAIL                       | PASS — muted mono                                                      |
| Slip brand border / green to-win    | FAIL                       | PASS — gold-deep slip border; to-win gold `StatValue`; gold Submit CTA |
| Show all spread/total lines         | FAIL — sub-40px brand link | PASS — `min-h-11` muted control                                        |
| Sport pill clip                     | FAIL — left-edge clip      | PASS — wider bleed + `scroll-px-4`                                     |
| Prop filter pills                   | FAIL — brand selected      | PASS — gold selected recipe                                            |
| Board / chip / slip                 | partial                    | PASS patterns aligned (MarketChip unchanged; slip + dock gold CTA)     |

Screenshot: `pick-new-375-dark.png`  
Note: live board expand + chip select needs odds API + signed-in session in staging; page shell verified anonymously.

### `/dashboard/picks/new/parlay`

| Check                            | Before           | After                                                       |
| -------------------------------- | ---------------- | ----------------------------------------------------------- |
| Inline brand slip / conflict CTA | FAIL             | PASS — ink conflict panel; gold Replace; gold combined odds |
| Sticky slip bar                  | OK from prior PR | PASS — shared `MobileSlipDock`, 44px VIEW SLIP              |
| Sport pills                      | duplicated rail  | PASS — shared `SportPills`                                  |

Screenshot: `pick-parlay-375-dark.png`

## Ticket post-submit

Not exercised in production: no local `.env` / staging credentials in this environment.  
Receipt UI path remains `Ticket` with muted eyebrow + gold stamp/odds/to-win + gold “View on your record” CTA. Re-verify on staging with a test account.

## Known leftover (system / Claude PR)

- Computed data font is still **Geist Mono** via tokens — application now uses `scl-data` / `StatValue` everywhere on these routes; swapping the token to IBM Plex Mono is a globals/primitives task.
- Default `Button` size variants still shrink at `md:` in the primitive; headers/CTAs on these routes override to `min-h-11 md:h-11`.

## How to re-run

```bash
npm run build && npx next start -p 3000
npx tsx scripts/route-conformance-qa.ts
```
