# SCL — GPT + Claude Deliverables (Locked for Cursor)

**Role:** Fable 5 acting as product/trust copy lead (GPT) and architecture merge gate (Claude).  
**Date:** 2026-07-16  
**Production ref:** `scl-marketplace.vercel.app` @ `80154e8`  
**Repo:** `Alphakiller1/scl-marketplace`  
**Audience:** Cursor implementers. These are **final strings and contracts**, not options.

---

## Execution order (dependency chain)

| Step | Owner role   | Deliverable                             | Unlocks                              |
| ---: | ------------ | --------------------------------------- | ------------------------------------ |
|    1 | GPT          | Status taxonomy + chip microcopy        | PR-K, PR-A, feed/profile unification |
|    2 | GPT          | CTA set (“Track Your Record”)           | PR-A                                 |
|    3 | GPT          | Verified-% row treatment                | PR-A                                 |
|    4 | Claude       | Auto-grading architecture + acceptance  | **PR-G (P0 blocker)**                |
|    5 | Claude       | Odds API credit strategy (≤20k)         | PR-J; gates F/H                      |
|    6 | Claude + GPT | CLV data contract + explainer           | PR-F                                 |
|    7 | GPT          | League Action labels + empties          | PR-E                                 |
|    8 | GPT          | Ticker framing + a11y                   | PR-I (after G)                       |
|    9 | GPT          | Pick analysis copy + moderation         | PR-C                                 |
|   10 | GPT          | Stake chips / 0U policy + SEO templates | PR-A / PR-0                          |
|   11 | Claude       | Merge-readiness ledger + sign-off gate  | All PRs                              |

**Cursor does not invent copy or settlement rules.** If a string is missing, stop and ask — do not improvise hype.

---

# STEP 1 — Status taxonomy (LOCKED)

## Axes (orthogonal — never mix in one chip)

| Axis             | Values                                | Meaning                                                              |
| ---------------- | ------------------------------------- | -------------------------------------------------------------------- |
| **Authenticity** | `Verified`                            | Board-bound, pre-game, odds-checked. Pink badge.                     |
| **Authenticity** | `Logged` _(legacy only)_              | Historical non-board picks. Muted. **Not used for new submissions.** |
| **Lifecycle**    | `Pending` → `Live` → `Awaiting Grade` | Before tip → in progress → event ended, not yet settled              |
| **Result**       | `Won` / `Lost` / `Push` / `Void`      | Terminal grades only                                                 |

**Hard rule:** `Verified` never shares color, chip, or aria with `Won`/`Lost`.

### Owner decisions locked here

1. **New picks are board-only.** Free-text / self-reported path stays retired (`createPlay` rejects unbound picks).
2. **Public label for pre-tip = `Pending`** everywhere (feed + profile). Retire visible `Pre-Game` on public surfaces; keep `pre-game` as internal enum if needed.
3. **“Self-reported”** → public string **`Logged`** for legacy rows only; legend:
   - Verified — odds captured on the board before tip and checked against the market.
   - Logged — historical entry not board-checked; does not count toward verified rank.
4. **Demo self-reported seed picks** on `@demo_capper`: keep for now as `Logged` (do not fake them to Verified). Optional later purge is owner ops, not a Cursor invent.

### Chip labels + tooltips (FINAL)

| Key            | Label          | Tooltip / description                                                |
| -------------- | -------------- | -------------------------------------------------------------------- |
| verified       | Verified       | Board pick — logged before tip with odds checked against the market. |
| pending        | Pending        | Event has not started. Grade locks after the final.                  |
| live           | Live           | Event is in progress.                                                |
| awaiting-grade | Awaiting Grade | Event is final. Settlement is running.                               |
| won            | Won            | Graded win. Past result — not a prediction.                          |
| lost           | Lost           | Graded loss.                                                         |
| push           | Push           | Graded push — stake returned.                                        |
| void           | Void           | Graded void — removed from record math per rules.                    |
| logged         | Logged         | Historical non-board entry. Not part of the verified leaderboard.    |

### Receipt / feed microcopy (FINAL)

- Source line pattern (keep): `ODDS CAPTURED {date} {time} ET / SOURCE: {Book} BOARD`
- If grading pipeline healthy: `· Grades automatically`
- If cron unhealthy / lag > SLA: replace with `· Grading delayed — check back soon` (honest; never claim auto if broken)

---

# STEP 2 — CTA set (LOCKED)

| Surface                  | String                                                             |
| ------------------------ | ------------------------------------------------------------------ |
| Nav primary (logged out) | **Track Your Record**                                              |
| Hero secondary CTA       | **Track Your Record**                                              |
| Hero primary (discovery) | **Explore Leaderboard** _(unchanged)_                              |
| Bottom band headline     | **Build A Record People Can Inspect**                              |
| Bottom band supporting   | **Log board-verified plays. Earn a public rank others can check.** |
| Bottom band button       | **Track Your Record**                                              |
| Signup H1                | **Create Your Capper Account**                                     |
| Signup submit            | **Start Tracking**                                                 |
| Login supporting         | **Secure access to the identity behind your record.**              |
| Dashboard empty CTA      | **Submit A Play** _(unchanged — action, not recruitment)_          |

**Do not** use: Become a Capper, Start Winning, Get Locks, Easy Money, Guaranteed.

---

# STEP 3 — Verified-% treatment (LOCKED)

Production shows `100% / 80% / 50% Verified` text on rows. That text is noisy; the **percent is still a real signal**.

| Case                    | Leaderboard row                                                                       | Profile                                              |
| ----------------------- | ------------------------------------------------------------------------------------- | ---------------------------------------------------- |
| **100% verified share** | Pink verification badge only. No “100% Verified” text.                                | Badge + “All picks board-verified” in legend/tooltip |
| **&lt;100%**            | No percent text in the identity cell. Optional outline/muted badge with tooltip only. | Show **“{n}% board-verified”** in Performance meta   |
| **0 graded**            | No verified-% chip                                                                    | “No graded picks yet”                                |

**Aria / tooltip (FINAL)**

- 100%: `aria-label="Fully board-verified record"` · tooltip `All picks on this record were board-verified.`
- &lt;100%: `aria-label="{n} percent of picks board-verified"` · tooltip `{n}% of this capper's picks were board-verified. Only verified picks count toward rank.`

When Issue 8’s verified-only future state lands for _new_ picks, shares converge to 100% and the &lt;100% path becomes legacy-only.

---

# STEP 4 — Auto-grading architecture (LOCKED — Claude)

## Production diagnosis (evidence-backed)

| Fact                   | Evidence                                                                                                                                      |
| ---------------------- | --------------------------------------------------------------------------------------------------------------------------------------------- |
| UI promises auto-grade | Pick cards: “Grades Automatically”                                                                                                            |
| Many picks stuck       | Public `/picks`: `awaiting-grade` / Pending for multi-day-old events                                                                          |
| Library exists         | `src/lib/results/auto-grade.ts`, `match.ts`, `provider.ts`                                                                                    |
| Trigger today          | **Admin-only** `runAutoGradeAction` + `AutoGradeButton` on `/admin/grading`                                                                   |
| Scheduler              | **`vercel.json` has no `crons`** — only `buildCommand`                                                                                        |
| Matcher gaps           | `resolveOutcome` handles **moneyline + totals only**; **no spreads**; fragile string matching; no `eventId` join                              |
| Results fetch          | `oddsApiResultsProvider` hits `sports/upcoming/scores?daysFrom=3` — wrong shape for completed-sport scoping; not per-sport with pending plays |
| Parlays                | `autoGradePending` filters `parlayId: null` — **parlays not auto-graded**                                                                     |
| Idempotency            | Updates by `outcome: PENDING` but no unique grade-event guard under concurrency                                                               |

**Verdict:** Auto-grading is **not broken as an idea** — it is **unscheduled and incomplete**. That is a **P0 trust blocker**.

## Target design

### A. Cron

Add Vercel Cron (or equivalent) invoking a **secured** route:

- Path: `GET/POST /api/cron/grade`
- Auth: `Authorization: Bearer ${CRON_SECRET}` (Vercel cron header)
- Schedule: Vercel Hobby → daily `0 8 * * *`; sub-daily cadence via GitHub Actions `grade-cron.yml` (`*/30`) calling Bearer `CRON_SECRET`
- Body work: `autoGradePending` improved (below)
- Logging: `{ graded, skipped, failed, provider, durationMs, sports[] }` to console + optional `GradeJobRun` table

**Do not** put `prisma migrate deploy` back into `buildCommand`.

### B. Results provider (fix)

1. Enumerate distinct `sport` values among pending plays with `eventId` / `eventStartsAt` in the past.
2. For each sport with pending volume, call The Odds API **scores** endpoint for that sport key (`/v4/sports/{sport}/scores/?daysFrom=1..3`).
3. Prefer join on **`eventId`** (Odds API event id stored at submit). Fall back to normalized team+start only if `eventId` missing (legacy).
4. Ignore incomplete games.
5. Separate **results credits** from **odds board credits** in logging (`purpose: results`).

### C. Settlement rules

| Market                   | Rule                                                                                                                                                                                                                             |
| ------------------------ | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Moneyline (2-way)        | Winner by final score; tie → Push (NHL OT rules later if needed)                                                                                                                                                                 |
| Moneyline (3-way soccer) | **Do not enable** until draw/home/away keys exist — gate soccer ML                                                                                                                                                               |
| Spread                   | Compare (home−away) vs line; exact → Push                                                                                                                                                                                        |
| Total                    | Sum vs line; exact → Push                                                                                                                                                                                                        |
| Player props             | Defer until stats provider; leave Pending                                                                                                                                                                                        |
| Push                     | `profitUnits = 0`; counts in graded sample                                                                                                                                                                                       |
| Void                     | Exclude from W-L and units (document in audit reason)                                                                                                                                                                            |
| Parlay                   | Grade legs first; any Loss → parlay Loss; all Won → Won at combined odds; Void leg → recalculate remaining odds or Void per published rule (LOCK: **void leg removes leg and recalculates**; if &lt;2 legs remain → Void parlay) |

### D. Lifecycle derivation

```
if outcome in Won|Lost|Push|Void → Result chip
else if now < eventStartsAt → Pending
else if event completed=false → Live
else → Awaiting Grade
```

### E. Idempotency

- Update only where `outcome = PENDING` (or `gradedAt IS NULL`).
- Insert `gradingAudit` in same transaction.
- Concurrent cron: safe no-op if row already graded.
- Never re-grade a settled play without admin override path.

### F. Public honesty

If last successful cron &gt; 90 minutes ago OR error rate high → swap “Grades automatically” → “Grading delayed”.

### Acceptance (PR-G)

- [ ] Cron registered and visible in Vercel
- [ ] July 13–15 backlog of completed ML/totals grades within one run
- [ ] Spreads grade correctly on fixture tests
- [ ] Re-run grades 0 additional rows
- [ ] Parlay path grades or explicitly skips with log (no silent ignore forever)
- [ ] Awaiting Grade shows between final and grade
- [ ] Unit tests for match.ts spreads + push + void-leg parlay math
- [ ] No migrate-in-build regression

---

# STEP 5 — Odds API credit strategy (LOCKED — Claude)

## Budget

- Monthly cap: **20,000** credits
- Soft warn: **70%** · Hard alert: **90%** · Circuit-breaker: **95%**
- Circuit behavior: serve **cached/stale odds** labeled `Odds as of {h:mm} ET` — never blank the board silently, never unbounded fetch

## Purpose enum (required on every call log)

| Purpose   | When                 | Policy                                                                                     |
| --------- | -------------------- | ------------------------------------------------------------------------------------------ |
| `board`   | GamePicker sport/day | Cache TTL 60s if first event &lt;2h else 5–15m; sport-day scoped; preferred books when set |
| `verify`  | Submit / odds guard  | Always fresh; **single event** markets bundle; never full sport dump                       |
| `results` | Cron grade           | Scores only; sports with pending plays only; max daysFrom=3                                |
| `clv`     | Closing snapshot     | Only events with ≥1 open play; T−60 and T−0 (or T−15); batch per sport                     |

## Math sketch (keep under 20k)

Assume ~40 active picked events/day, 8 sports warm, verify-on-expand:

| Bucket        | Est. credits/day | Notes                                                |
| ------------- | ---------------- | ---------------------------------------------------- |
| Board warm    | 80–200           | Cached; prefer bookmakers= filter                    |
| Verify        | 40–80            | 1 bundled call / picked event                        |
| Results cron  | 48–96            | 48 half-hour ticks × sports-with-pending (often 1–2) |
| CLV snapshots | 20–60            | Only open plays                                      |
| **Total**     | **~200–400/day** | ~6k–12k/mo headroom for soccer + spikes              |

## Instrumentation (PR-J)

Extend existing `logOddsUsage` into persisted daily rows:

`OddsUsageDaily { date, purpose, sport, calls, credits, cacheHits, remaining }`

No client-triggered uncached polling. Audit `unified-pick-entry` / GamePicker for intervals — remove if present.

### Acceptance (PR-J)

- [ ] Every Odds API response logged with purpose
- [ ] Circuit-breaker unit-tested
- [ ] Doc comment in `odds-api.ts` cites this budget table
- [ ] Projected month with soccer+CLV still ≤20k in PR description

---

# STEP 6 — CLV contract (LOCKED)

## Definition

For each graded verified play:

1. `capturedOddsAmerican` = odds locked at submit (already stored / shown).
2. `closingOddsAmerican` = last snapshot for the **same book** as `play.book` at/before `eventStartsAt`. If that book missing, store `closingOddsAmerican = null` and CLV = unavailable (`—`).
3. Convert both to implied probability (standard American→implied, no vig removal on single-book CLV v1 — document as **raw implied delta**).
4. `clvPts = impliedClose − impliedCaptured` for the bettor side (positive = beat the close).
5. Persist `clvPts` at grade time; **do not recompute** on read.

**Not in v1:** consensus close, multi-book best-close, CLV$ bankroll sizing.

## Product surfaces

- Capper profile: “Closing Line” card — avg CLV pts, % beats close, n — gated by same provisional sample floor as ROI signals.
- Leaderboard: optional Rank By → **CLV** (verified + sample floor only).
- No homepage CLV hero until n is meaningful.

## Explainer (FINAL — GPT)

**Short (tooltip, ≤12 words):**  
`How your price compared to the market’s closing price.`

**Long (≤120 words):**  
Closing Line Value (CLV) measures whether the odds on your pick were better or worse than the same book’s price at event start. A positive CLV means you captured a better number than the close; a negative CLV means the close was better. CLV is a pricing metric used by serious handicappers to evaluate process — it is not a prediction of future wins, and it does not guarantee profit. SCL only shows CLV on board-verified picks with a recorded closing price. If a close is unavailable, we show an em dash rather than an estimate.

**Banned near CLV:** lock, guarantee, easy money, beat the book every time, print money.

---

# STEP 7 — League Action labels (LOCKED — GPT)

**Module title:** League Action Report  
**Subtitle:** Verified board activity from public cappers — last 14 days

### Tabs / segments

| Key     | Label        | Empty state                                      |
| ------- | ------------ | ------------------------------------------------ |
| leagues | Top Leagues  | No verified league activity in the last 14 days. |
| singles | Singles      | No verified singles in the last 14 days.         |
| parlays | Parlays      | No verified parlays in the last 14 days.         |
| props   | Player Props | No verified player props in the last 14 days.    |
| sides   | Sides        | No verified sides in the last 14 days.           |
| totals  | Totals       | No verified totals in the last 14 days.          |

Footnote (keep eligibility honesty):  
`Counts include ranked and building-a-record cappers. Test accounts are excluded.`

Metrics per row: **Picks** · **Cappers** (optional later: Units).

---

# STEP 8 — Yesterday ticker (LOCKED — GPT)

**Title:** Yesterday’s Graded Wins  
**Item format:** `@{handle} · {selection} · +{units}U`  
**Empty:** **Hide the module entirely** (no fake placeholders).  
**Compliance:** Past-tense only. No “tail these,” no hot-streak hype.  
**A11y:** region `aria-label="Yesterday's graded wins"`; marquee paused on hover/focus; under `prefers-reduced-motion` render a static list (max 8). Duplicate scrolling nodes `aria-hidden="true"`.

**Dependency:** PR-G must produce real wins first.

---

# STEP 9 — Pick analysis (LOCKED — GPT)

| Element         | Copy                                         |
| --------------- | -------------------------------------------- |
| Field label     | Analysis                                     |
| Placeholder     | Optional. Why this number — keep it factual. |
| Toggle (public) | Show on my public pick card                  |
| Lock notice     | Analysis locks when the pick grades.         |
| Parlay label    | Parlay analysis                              |
| Per-leg (v2)    | Leg note (optional)                          |

**Limits:** 1–1000 characters; plain text; no URLs in v1.  
**Moderation reject list (case-insensitive):** lock, locks, guaranteed, guarantee, easy money, printed, steam alert (as hype), can’t lose, free money.  
**Immutability:** server rejects updates when `gradedAt != null`.

---

# STEP 10 — Stake chips, 0U policy, SEO (LOCKED)

## Chips

`UNIT_QUICK_CHIPS = [0.5, 1, 2, 3, 4, 5]`  
All chips identical visually (no escalating “hot” styles).  
`UNIT_MIN = 0.25`, `UNIT_MAX = 5` unchanged.  
Tooltip (optional): `Stake in units — max 5U.`

## 0U policy

- Server: reject `units < 0.25` on createPlay / createPlays / createParlay.
- Existing 0U public picks: **exclude from leaderboard aggregates and public feed** (treat as invalid); keep in capper dashboard with badge `Invalid stake` until voided by admin.  
  _(Owner may later void en masse — Cursor implements exclude-first.)_

## SEO templates (FINAL)

| Route               | Title                            | Meta description                                                                                                    |
| ------------------- | -------------------------------- | ------------------------------------------------------------------------------------------------------------------- |
| `/`                 | SCL — Sports Capper Leaderboard  | Compare board-verified capper records by units, ROI, and sample size. No hype — inspectable performance.            |
| `/leaderboard`      | Leaderboard · SCL                | Ranked sports handicappers by units, ROI, and win rate. Filter by sport, window, and sample size.                   |
| `/picks`            | Today’s Picks · SCL              | Recent board-verified picks with sportsbook source attribution and grading status.                                  |
| `/cappers/[handle]` | @{handle} · Capper Profile · SCL | Tracked record, recent plays, and storefront links for @{handle}. Past results do not guarantee future performance. |

Keyword patterns (internal linking targets — educational, not hype):  
verified sports handicappers · capper leaderboard ROI · board-verified picks · closing line value explained · responsible sports betting tracking · inspectable capper record · sportsbook-sourced odds tracking · graded pick history

---

# STEP 11 — Merge-readiness ledger (Claude gate)

| PR               | Gate questions                              | Merge when                                                 |
| ---------------- | ------------------------------------------- | ---------------------------------------------------------- |
| PR-0 Hygiene     | Test accounts hidden? Min stake enforced?   | Public queries exclude `isTestAccount`; &lt;0.25U rejected |
| PR-G Grading     | Cron live? Backlog cleared? Idempotent?     | SLA + tests green; honesty copy if delayed                 |
| PR-B Bulk verify | Authed script pass?                         | Only fix failures; no rewrite                              |
| PR-A Copy/UX     | Strings match this doc? 4U/5U? Badge rules? | Visual QA 375/1280 dark+light                              |
| PR-J Credits     | Logging + breaker?                          | Budget table in PR body                                    |
| PR-C Analysis    | Lock + moderation?                          | Server immutability tested                                 |
| PR-D Logos       | Fixed box + alt + fallback?                 | No CLS; trademark size restrained                          |
| PR-E Action/ROI  | Empties honest? No overflow?                | Tabs match Step 7                                          |
| PR-F CLV         | Same-book close? Explainer present?         | Null closes show —                                         |
| PR-H Soccer      | Keys validated? 3-way gated?                | No soccer ML until draw settlement                         |
| PR-I Ticker      | Real wins only? Reduced motion?             | Hidden when empty                                          |

### Trust invariants (hard-fail)

1. No winnings promises / lock-guaranteed language.
2. Verified ≠ Won in UI, tokens, or aria.
3. No fake cappers/activity on public surfaces (QA accounts excluded).
4. Unavailable data → `—` / honest empty — never fabricated.
5. Third-party storefront disclosure intact.
6. Board-verified entry remains the only new pick path.
7. No `prisma migrate deploy` in Vercel `buildCommand`.

### Sign-off verdict rubric

- **APPROVE** — invariants held; acceptance boxes checked; no credit cliff.
- **APPROVE WITH NITS** — copy typos / spacing only.
- **REQUEST CHANGES** — any trust invariant miss, grading incorrectness, or unbounded odds fetch.

---

## Sportsbook logo note (for PR-D)

Nominative attribution only. Self-host SVGs under `public/marks/books/{key}.svg`. Fixed `size-5`/`size-6` box; monogram fallback from `bookShort`. Alt = full book label. Never imply SCL partnership.

## Soccer league registry (for PR-H — keys to validate live before hardcode)

| Display    | Odds API key (validate)      |
| ---------- | ---------------------------- |
| EPL        | `soccer_epl`                 |
| La Liga    | `soccer_spain_la_liga`       |
| Serie A    | `soccer_italy_serie_a`       |
| Bundesliga | `soccer_germany_bundesliga`  |
| Ligue 1    | `soccer_france_ligue_one`    |
| MLS        | `soccer_usa_mls`             |
| UCL        | `soccer_uefa_champs_league`  |
| Europa     | `soccer_uefa_europa_league`  |
| Liga MX    | `soccer_mexico_ligamx`       |
| NWSL       | verify catalog before enable |

Parent sport remains `SOCCER`. Off-season → honest empty with season hint.

---

## What Cursor should do next

1. Implement **PR-G** against Step 4 (highest trust ROI).
2. Parallel **PR-0** + **PR-A** against Steps 1–3 and 10.
3. **PR-J** before any CLV/soccer expansion.
4. Do not start PR-I until graded wins exist.

**Commit author email for SCL PRs:** `chase4sichi@gmail.com`  
**Never push `main` directly.**
