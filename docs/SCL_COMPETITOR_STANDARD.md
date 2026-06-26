# SCL Competitor Standard

The quality bar SCL measures itself against, and how we stay differentiated.

## Reference products (study, don't copy)

- **Action Network** — odds, scores, picks, tracking, alerts; strong utility.
- **Pikkit / Juice Reel** — bet tracking, sportsbook sync, social betting, bet histories.
- **Outlier / Apple Sports** — clarity, speed, glanceable data.
- **DraftKings / ESPN** — energy, stats structure, sports-native polish.
- **Baseball Savant** — data richness done legibly.
- **Linear / Stripe Dashboard** — interaction polish and discipline.

Use **Mobbin** for pattern research; **ReactBits** for tasteful interactions only;
**shaders.com** for restrained atmosphere only (never on data-critical screens); **Framer** for
marketing prototypes only — never the product app.

## SCL's differentiated lane (what we own)

Verified **public** capper rankings · transparent records · leaderboard status · capper
reputation · public performance history · top-pick discovery · **trust**. SCL is the public
performance/reputation layer — not a personal bet tracker, not a sportsbook, not a social feed.

## Parity we must hit (from the legacy site)

Sport leaderboards (MLB/NBA/NCAAB/NCAAF/NFL/NHL/PGA/Soccer/Tennis/UFC/WNBA), time windows
(7/30/60/90d, season, year), sort by Win%/Units/ROI, capper profiles with per-sport stats,
today's/yesterday's picks, trophy case, packages. See
`../_phase1-notes/COMPETITIVE_ANALYSIS_legacy_site.md` in the planning workspace.

## Where we beat the legacy site

- Modern, premium, mobile-first experience (theirs is dated, table-driven PHP).
- Self-service signup + email verification (theirs is a manual admin application).
- Automated grading + audit trail + admin override (theirs appears manual).
- Inline stats in the directory (theirs shows none).
- Native package + click tracking → native checkout in Phase 2 (theirs outsources to Winible).

## Hard "don'ts"

- No production scraping for odds/scores/sportsbook/protected data — official APIs or internal
  data only.
- No claims we can't back (no fake "sportsbook sync").
- No feature copying that dilutes the reputation-engine identity.
