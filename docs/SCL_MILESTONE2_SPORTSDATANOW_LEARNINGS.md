# Milestone 2 — Learnings from SportsDataNow

Competitor teardown of **SportsDataNow** (SDN, `sportsdatanow.com` / `app.sportsdatanow.com`)
and what to adopt, adapt, or reject for SCL Milestone 2 (≈ Phase 2 in
[`SCL_PHASE_1_PRODUCT_SPEC.md`](SCL_PHASE_1_PRODUCT_SPEC.md)). Extends
[`SCL_COMPETITOR_STANDARD.md`](SCL_COMPETITOR_STANDARD.md); every recommendation is checked
against SCL's lane and its hard "don'ts" (no production scraping; official APIs or internal
data only).

## 1. What SportsDataNow is

An **automated pick-tracking, verification, grading, and analytics** product for cappers /
VIP-group operators / betting content creators ($25/mo Standard; Custom for hands-free
channel sync). The loop:

1. **Capture** — auto-pulls every pick a capper posts on X, Discord, Telegram, Instagram, or
   Email (the capper's _own_ channels); also manual entry, copy-paste, and bet-slip screenshot
   OCR.
2. **Verify** — timestamps each pick _at capture_ and asserts it was logged **pre-game** — the
   record reflects real calls, not hindsight.
3. **Grade** — auto-grades off official scoreboards, typically **within ~15 min** of game end.
4. **Analyze** — win %, ROI, unit/$ P&L, longest win/loss streaks, daily P&L over custom
   windows, breakdowns by sport / bet type / period.
5. **Broadcast** — a **public leaderboard** of verified records + one-click **shareable
   visuals** generated from the dashboard.

## 2. Strategic read — SDN is the _tracking primitive_; SCL is the _reputation layer_

SDN is a **personal capper tool** (track _my_ picks, prove _my_ record, market _myself_). SCL
is the **public performance/reputation layer** (rank _all_ cappers, let bettors discover and
trust them, run the marketplace). They overlap on exactly one thing: **a verified record only
matters if the verification is trustworthy.** SDN is the current state-of-the-art for _how_ to
make a capper's record trustworthy — and trust is SCL's entire moat ("I trust this because the
records are visible"). So the highest-value learnings are the **verification and capture
mechanics**, not the tracker UI.

Stay in lane: adopt SDN's _trust primitives_, not its _product identity_. SCL must not become a
personal bet tracker, a subscription-for-tracking tool, or a social feed.

## 3. What SCL already has (baseline — don't rebuild)

From `prisma/schema.prisma`:

- `Play`: `sport, league, market, selection, oddsAmerican, units (0.25–5), outcome
(PENDING/WIN/LOSS/PUSH/VOID), profitUnits, notes, createdAt, gradedAt`.
- `GradingAudit` + `GradingSource {AUTO, ADMIN_OVERRIDE, MANUAL}` — a real grading audit trail
  with source + actor + reason. **This is SCL's answer to SDN's "verified grading," and it's
  already more transparent than most competitors.**
- `CapperProfile` with stored **social handles** — the natural hook for authorized channel
  ingestion.
- Phase 1 leaderboards, capper profiles, today's picks, trophy case.

The gaps that matter are **provenance** (how did the pick get here?) and **pre-game proof**
(was it logged before first pitch?) — the two things that convert "a record" into "a _trusted_
record."

## 4. Adopt into Milestone 2 (prioritized)

Each item: the SDN behavior → the SCL fit → the concrete data/UX delta → the guardrail.

### M2-1 · Pre-game timestamp verification (HIGHEST leverage)

- **SDN:** stamps capture time and proves the pick predates the game.
- **SCL fit:** directly deepens the core "verified record" moat; turns the `verified` badge from
  a binary into _earned, per-pick_ trust.
- **Delta:** add `Play.eventStartsAt DateTime?` and derive a `loggedPreGame` boolean
  (`createdAt < eventStartsAt`). Surface a **"Locked pre-game ✓"** chip on `PickCard` and roll a
  **pre-game-logged %** into the capper profile + leaderboard verification tier. Picks logged
  after `eventStartsAt` are still shown but flagged **"post-start"** and excluded from verified
  ROI.
- **Guardrail:** `eventStartsAt` comes from official schedule data (same official-API sourcing
  SCL already commits to), never scraped.

### M2-2 · Pick provenance / source on every Play

- **SDN:** knows whether a pick was auto-captured, pasted, or OCR'd from a slip.
- **SCL fit:** provenance _is_ trust. A leaderboard that shows "auto-captured from the capper's
  public X" reads far more credibly than "typed into a form."
- **Delta:** add `Play.source enum {MANUAL, IMPORTED_X, IMPORTED_DISCORD, IMPORTED_TELEGRAM,
SCREENSHOT_OCR}` and `Play.sourceRef String?` (permalink to the originating post). Show a
  small source icon + "view original" link on each pick.
- **Guardrail:** only the capper's _own_ authorized channels; `sourceRef` links to the capper's
  own public post.

### M2-3 · Verification tiers (replace binary "verified")

- **SDN:** implicit trust from auto-capture + pre-game timestamp.
- **SCL fit:** a **graded** verification badge is more honest and more motivating than a single
  checkmark, and it's uniquely ownable by a _reputation_ product.
- **Delta:** derive a tier per capper/pick:
  `AUTO-VERIFIED` (auto-captured + pre-game) > `VERIFIED` (manual entry, pre-game, admin/auto-
  graded) > `SELF-REPORTED` (post-start or OCR-only). Filter leaderboards by tier; weight
  discovery toward higher tiers.
- **Guardrail:** tiers are computed from provenance + timing facts, never self-asserted.

### M2-4 · Authorized channel ingestion ("Connect your channels")

- **SDN:** hands-free sync from X / Discord / Telegram / Instagram / Email.
- **SCL fit:** the biggest cold-start lever — cappers already post picks where their audience
  is; SCL should _import_ rather than ask them to double-enter. Feeds M2-1/2/3 automatically.
- **Delta:** OAuth/bot connectors for the capper's **own** accounts — a Discord bot in the
  capper's server, a Telegram bot in their channel, X via the official API — that ingest posts,
  parse pick text → `Play`, and stamp capture time. Start with **one** connector (Discord bot is
  lowest-friction and API-clean) as a Milestone-2 spike.
- **Guardrail:** **official APIs / capper-authorized bots only. This is authorized ingestion of
  the capper's own content, categorically different from the banned "production scraping."**
  Make that distinction explicit in the connector's consent copy and in
  `SCL_DATA_CONTRACT.md`.

### M2-5 · Shareable capper record cards (growth loop)

- **SDN:** one-click shareable performance visuals — a marketing flywheel.
- **SCL fit:** cappers marketing their **SCL-verified** record on social drives discovery back
  to SCL — serves the "get discovered / build reputation" loop _and_ is on-brand for a public
  reputation product. Mirrors the Chase content-engine pattern.
- **Delta:** server-rendered OG share image per capper (record, ROI, units, streak, rank,
  verification tier, SCL branding) + "Share my card" on the profile/dashboard. Deterministic,
  self-contained image; no PII beyond the public profile.
- **Guardrail:** only public, verified numbers on the card; watermark + deep link back to the
  SCL profile.

### M2-6 · Advanced analytics (Phase-2 line item — validated metric set)

- **SDN:** daily P&L curve, streak analytics, sport/bet-type/window breakdowns, units-or-dollars
  toggle.
- **SCL fit:** deepens the capper profile and leaderboard evaluation without leaving the lane.
- **Delta:** add a **daily cumulative-units curve** (Recharts, already a dep), **bet-type
  breakdown** (SCL has `market`), **streak** surfacing, and a units/$ display toggle. All
  read-only aggregations over existing `Play` rows.
- **Guardrail:** aggregation only; no new external data.

### M2-7 · CLV as a differentiator (stretch)

- **SDN:** notably does **not** emphasize CLV; Pikkit / OddsJam / Betfolyo do.
- **SCL fit:** CLV on the _reputation layer_ (not a personal tracker) would be genuinely
  differentiated — "this capper consistently beats the closing number" is the strongest public
  trust signal in betting.
- **Delta:** add `Play.closingOddsAmerican Int?` (from official closing-line data when
  available) → per-capper CLV%. Ship **only** if a compliant official closing-line source
  exists; otherwise defer. Do not fake it.
- **Guardrail:** official data only; label honestly ("CLV where closing data available").

## 5. Do NOT copy

- **SDN's product identity** — it's a personal tracker + subscription. SCL monetizes the
  **marketplace** (packages → native checkout in M2), not a tracking subscription.
- **Screenshot/bet-slip OCR as a trust source** — fine as a _convenience entry_ path, but it is
  self-reported; it must land as `SELF-REPORTED` tier, never as `VERIFIED`.
- **Instagram/Email capture first** — lower API quality / higher abuse surface; start with
  Discord, then X, then Telegram.
- **A personal-tracker dashboard** that competes with the capper's own tools — SCL's dashboard
  exists to _submit/verify/rank_, not to be someone's private bankroll app.

## 6. Suggested Milestone 2 sequence

1. **M2-1 pre-game timestamp verification** + **M2-2 provenance fields** — schema + UI; unlocks
   everything else and is pure trust upside. (Small, high leverage.)
2. **M2-3 verification tiers** — derived from 1+2; leaderboard/discovery filters.
3. **M2-5 shareable record cards** — growth loop, independent of the connectors.
4. **M2-4 Discord connector spike** — one authorized connector end-to-end; prove the ingestion
   → `Play` → verified pipeline.
5. **M2-6 advanced analytics** — profile depth.
6. **M2-7 CLV** — only if a compliant closing-line source lands.

Native Stripe checkout + the social/following graph remain the other Phase-2 tracks per the
product spec; the items above are the SDN-derived trust/growth additions, sequenced so the
**verification moat is deepened first**.
