# Legacy Capper Data — Per-Sport & Bet-Type Record Organization

**Audience:** Claude / Cursor implementers  
**Repo:** `Alphakiller1/scl-marketplace`  
**Branch:** `feat/legacy-per-sport-bet-type-records` (create off `main`)  
**Priority:** P1 — trust + migration completeness  
**Depends on:** Legacy import pipeline (`docs/LEGACY_MIGRATION.md`) already landed; this prompt closes gaps in how imported data is **stored, aggregated, surfaced on profiles, and folded into leaderboards**.

---

## Goal

Ensure every **legacy capper's** carried-over history and imported picks are:

1. **Logged and stored per sport** (canonical `SPORT_KEY`, not free text).
2. **Organized by bet type** (shape + market taxonomy) wherever the source data supports it — honestly labelled when it does not.
3. **Visible on public profiles** in a scannable sport + bet-type breakdown that matches headline Evidence Brief totals.
4. **Folded correctly into leaderboards** (all-time + sport-filtered; never into trailing windows).

A visitor evaluating a legacy capper must be able to answer: *"What did they do in NFL vs NBA?"* and *"Are they a sides guy or a props specialist?"* — without double-counting, fabricated form/streak, or silent mismatches between profile and board rank.

---

## Read first (mandatory)

| Doc / file | Why |
| --- | --- |
| `AGENTS.md`, `docs/SCL_DATA_CONTRACT.md` | Stack, trust, derived-stats rules |
| `docs/LEGACY_MIGRATION.md` | Import order, `PRE_IMPORT` semantics, scope rules |
| `docs/SCL_PHASE_1_PRODUCT_SPEC.md` | Profile + leaderboard deliverables |
| `docs/SCL_COMPONENT_SYSTEM.md`, `docs/SCL_DESIGN_CONTRACT.md` | Build from `src/components/scl/*` |
| `prisma/schema.prisma` — `LegacyRecord`, `Play`, `CapperProfile` | Data model |
| `src/lib/schemas/legacy-records.schema.ts` | Import contract |
| `src/lib/schemas/legacy-import.schema.ts` | Capper + play import contract |
| `scripts/extract-legacy-mysql.py` | Source extraction (per-sport columns, market mapping) |
| `scripts/import-legacy-records.ts`, `scripts/import-legacy-cappers.ts` | Importers |
| `src/lib/queries/leaderboard.ts` | Baseline folding + sport filter |
| `src/lib/queries/capper.ts` | Profile query + `legacyBySport` |
| `src/lib/stats.ts` | `computeCapperStats`, `computeStatsBySport` |
| `src/lib/league-action.ts` | Bet-type taxonomy (`singles`, `parlays`, `props`, `sides`, `totals`, `futures`) |
| `src/components/scl/evidence-brief.tsx` | Profile evidence grid |
| `src/components/scl/legacy-sport-breakdown.tsx` | Existing per-sport legacy UI |

---

## Current state (do not re-invent — extend)

### Already shipped

| Area | Status |
| --- | --- |
| `LegacyRecord` model | `scope` + `sport` (`ALL` or `SPORT_KEY`); unique on `(capperId, scope, sport)` |
| Extractor per-sport columns | `STAT_SPORTS` prefixes in legacy stats tables → one row per sport + `ALL` |
| `PRE_IMPORT` baseline | Season total **minus** imported `Play` rows — prevents double-count |
| Leaderboard all-time baseline | `legacyRecords` filtered by `scope: PRE_IMPORT` and matching `sport` filter |
| Trailing windows (7d/30d/90d) | **No** legacy baseline (by design — frozen snapshot ≠ current form) |
| Profile `LegacySportBreakdown` | Shows per-sport `PRE_IMPORT` residuals in Evidence Brief |
| Imported plays | Each play carries `sport` + `market` (bet-type proxy via extractor `market_for()`) |
| Profile metadata | `CapperProfile.sports[]`, `betTypes[]`, `specialties[]` from legacy import |
| Stats helper | `computeStatsBySport()` groups live/imported plays by sport |

### Known gaps (this prompt closes them)

| Gap | Risk |
| --- | --- |
| **No unified profile sport breakdown** combining legacy residuals + SCL/imported plays | Headline record says one thing; sport table shows only carried-over slice |
| **No bet-type performance breakdown on profile** | Product spec promises sport breakdown; bet-type specialty is invisible for legacy cappers |
| **Bet-type breakdown only from pick-level data** (~90 days + overlap) | Pre-import history has **no** bet-type aggregates in source — must not invent |
| **Discover / home surfaces** may use `sport: "ALL"` baseline only | Sport-filtered Discover lanes may not match sport-specific leaderboard |
| **Dashboard `PerformanceBySport`** ignores legacy baseline | Capper's private view disagrees with public profile |
| **Import validation** may allow sport keys outside `SPORTS` constants | Bad keys break filters silently |
| **No tests** asserting sport-filtered leaderboard = profile sport row for legacy cappers | Regression-prone |

---

## Trust rules (non-negotiable)

1. **Never fabricate** bet-type aggregates for history the legacy platform did not store. If only sport-level totals exist pre-import, bet-type rows must be labelled **"Imported picks only"** or scoped to the pick sample — not presented as full-career bet-type records.
2. **`PRE_IMPORT` only** affects **all-time** standings and **all-time** profile totals. Never fold into 7d/30d/90d leaderboard, Discover windowed lanes, form, streak, or performance trend.
3. **Legacy badge + carried count** must remain visible wherever carried-over totals affect headline record/units/ROI.
4. **Double-count guard:** baseline passed to `computeCapperStats` must always be `PRE_IMPORT` (plays already subtracted). Never pass `CURRENT_SEASON` alongside overlapping plays.
5. **Void/pending/QA-noted plays** follow existing public-eligibility rules — do not change exclusion semantics in this work.
6. **Parlay legs** are never positions of record; parlay rows are. Sport filter on parlays = any leg matches (existing rule — preserve).

---

## Data contract decisions

### Sport dimension

- Canonical keys from `src/lib/constants.ts` (`SPORT_KEYS` / `SPORTS`).
- Legacy extractor maps `GOLF → PGA`; importer must reject unknown sport strings at validation time.
- `LegacyRecord.sport = "ALL"` is the combined total sentinel (not SQL `NULL`).

### Bet-type dimension

Use the **existing League Action taxonomy** (`LeagueActionCategoryKey`) for profile breakdown UI — do not introduce a parallel enum:

| Key | Source mapping (plays) |
| --- | --- |
| `singles` | Straight plays, non-parlay, default shape |
| `parlays` | `parlayId != null` parent rows |
| `props` | `market` matches player-prop patterns (reuse `league-action.ts` classifiers) |
| `sides` | Spread / ML / run line markets |
| `totals` | Over/under / total markets |
| `futures` | Futures market label |

`CapperProfile.betTypes[]` (STRAIGHT, PROP, PARLAY, etc.) is **declared specialty metadata**, not performance — do not conflate with computed bet-type stats.

### Combined sport + bet-type stats function (new)

Add in `src/lib/stats.ts` (or `src/lib/legacy-stats.ts` if cleaner):

```ts
// Pseudocode — implement for real with existing types
computeStatsBySportAndBetType(
  plays: PlayForStats & { sport: string; market: string; parlayId?: string | null },
  parlays: ParlayForStats[],
  legacyBySport?: Map<string, StatsBaseline>, // PRE_IMPORT residuals only
): SportBetTypeBreakdown[]
```

Rules:

- Group SCL + imported plays by `(sport, betTypeCategory)`.
- For each sport, optionally fold `legacyBySport.get(sport)` into the **sport subtotal row only** (not per bet type — source lacks bet-type splits).
- Expose `sampleSource: "full" | "plays_only"` per row so UI can badge honestly.

---

## Implementation tasks

### Phase 1 — Data integrity & import (server)

- [ ] **Validate sport keys** in `legacy-records.schema.ts` and `legacy-import.schema.ts` against `SPORT_KEYS`; fail import with actionable Zod message on unknown sport.
- [ ] **Audit extractor output** (`extract-legacy-mysql.py`): confirm every capper with legacy stats gets both `ALL` and per-sport `PRE_IMPORT` rows where source had data; log cappers missing per-sport rows when profile `sports[]` claims them.
- [ ] **Import script summary**: extend `import-legacy-records.ts` exit report with per-sport row counts and cappers missing `ALL` baseline.
- [ ] **Query helper** `getLegacyBaselineBySport(capperId)` in `src/lib/queries/legacy-records.ts` — returns `Map<sport, StatsBaseline>` for `PRE_IMPORT` scope.

### Phase 2 — Aggregation lib (server)

- [ ] Implement `computeStatsBySport()` **with optional per-sport baseline map** (extend existing function — do not duplicate ROI math).
- [ ] Implement bet-type grouping reusing classifiers from `src/lib/league-action.ts` (extract shared `categorizePlayMarket(market, parlayId)` if needed).
- [ ] Implement `mergeSportBreakdown(playDerived, legacyBySport)` producing unified rows for profile + leaderboard consistency.
- [ ] Unit tests in `src/lib/stats.test.ts` + new `src/lib/legacy-stats.test.ts`:
  - legacy baseline folds into sport subtotal, not bet-type rows
  - sport-filtered stats match leaderboard query for a fixture capper
  - no baseline applied when `window !== "all"`

### Phase 3 — Profile surfaces (UI)

- [ ] **`PerformanceBySportProfile`** (new SCL component or extend `LegacySportBreakdown`):
  - Section title: **"Performance by sport"**
  - Rows = merged play + legacy per sport (record, win%, ROI, units, sample)
  - Sort controls (units default) — match `LegacySportBreakdown` UX
  - When legacy rows present: sub-label *"Includes carried-over results from the previous platform"*
- [ ] **`PerformanceByBetType`** (new SCL component):
  - Section title: **"Performance by bet type"**
  - Scope toggle or subtitle: **"Based on imported & board-verified picks"** when legacy capper lacks bet-type aggregates
  - Use League Action category labels/order
  - Mobile card + desktop table (`hidden md:grid` / `md:hidden`) per component system
- [ ] Wire into `EvidenceBrief` below evidence record grid; pass merged data from `getPublicCapperByHandle`.
- [ ] When sport chart filter is active, bet-type breakdown filters to that sport (client-side filter OK).
- [ ] Preserve existing `LegacySportBreakdown` **or** replace with unified component — no duplicate tables showing the same numbers differently.

### Phase 4 — Leaderboards & Discover (server)

- [ ] **Verify** `src/lib/queries/leaderboard.ts` sport filter uses matching `PRE_IMPORT` sport row (already coded — add regression test).
- [ ] **Discover** (`src/lib/queries/discover.ts`, `src/lib/discover-lanes.ts`): when building sport-specialty lanes for legacy cappers, fold per-sport `PRE_IMPORT` baseline into lane stats (not just `ALL`).
- [ ] **Home / Top Cappers** (`RankBoardTable` data source): confirm sport-filtered hero board matches leaderboard query semantics.
- [ ] **Admin capper index** (`admin-cappers.ts`): sport breakdown column or detail should include legacy baseline for operator sanity.

### Phase 5 — Capper dashboard parity (optional but recommended)

- [ ] Dashboard `PerformanceBySport` should use same merge helper so capper sees what the public sees (private plays include non-public rows — keep dashboard on full play set but same baseline rules).

---

## Acceptance criteria

### Data / import

- [ ] Re-running `npm run db:import-legacy-records` on a valid export produces per-sport + `ALL` rows for every capper with legacy stats.
- [ ] Invalid sport key in JSON fails validation before any DB write.
- [ ] `npm run typecheck && npm run lint && npm run build` green.

### Profile

- [ ] Legacy capper with per-sport `PRE_IMPORT` rows shows **Performance by sport** where each sport row equals leaderboard sport-filtered all-time stats (± rounding).
- [ ] Headline Evidence Brief record/units/ROI equals **ALL** sport merged total (existing behavior preserved).
- [ ] **Performance by bet type** section renders for cappers with imported plays; empty state uses honest copy when no plays exist.
- [ ] Legacy badge visible when carried-over totals affect headline stats.
- [ ] Mobile 375px: no horizontal overflow; tap targets ≥ 40px.

### Leaderboard

- [ ] All-time + `sport=NFL` rank for a legacy capper uses `PRE_IMPORT` `sport=NFL` baseline + NFL plays only.
- [ ] 30-day window rank for same capper **excludes** all legacy baselines.
- [ ] Sort by units / ROI / win% / CLV all use the same merged stat input.

### Tests

- [ ] At least one integration-style test fixture: capper with known plays + `PRE_IMPORT` rows → assert leaderboard + merge helper agree.
- [ ] Bet-type categorization tests for representative markets (spread, total, prop, parlay).

---

## UI copy (locked tone — do not hype)

| Surface | Copy |
| --- | --- |
| Sport section footnote | *Includes carried-over results from the previous platform where noted.* |
| Bet-type scope note | *Bet-type breakdown reflects imported and board-verified picks. Earlier history is included in sport totals only.* |
| Empty bet-type | *Not enough categorized picks yet to show a bet-type breakdown.* |
| Legacy row badge | Existing `LegacyBadge` / `Legacy` chip — do not rename |

---

## Files likely touched

```
prisma/schema.prisma                          # only if bet-type aggregate storage needed (prefer computed)
src/lib/schemas/legacy-records.schema.ts
src/lib/schemas/legacy-import.schema.ts
src/lib/stats.ts
src/lib/legacy-stats.ts                     # new
src/lib/legacy-sport-records.ts
src/lib/queries/legacy-records.ts             # new
src/lib/queries/capper.ts
src/lib/queries/leaderboard.ts
src/lib/queries/discover.ts
src/lib/discover-lanes.ts
src/lib/league-action.ts                      # extract shared market classifier
scripts/import-legacy-records.ts
scripts/extract-legacy-mysql.py               # validation/reporting only unless source gap found
src/components/scl/performance-by-sport-profile.tsx   # new
src/components/scl/performance-by-bet-type.tsx        # new
src/components/scl/evidence-brief.tsx
src/components/scl/legacy-sport-breakdown.tsx         # merge or deprecate
src/lib/stats.test.ts
src/lib/legacy-stats.test.ts                  # new
src/lib/queries/leaderboard.test.ts           # extend
docs/LEGACY_MIGRATION.md                      # document bet-type honesty + profile sections
```

---

## Out of scope

- Fabricating per-bet-type `LegacyRecord` rows from sport totals.
- Seeding form / streak / performance trend from legacy aggregates.
- Applying legacy baseline to CLV sort (CLV remains play-derived).
- Production re-import execution (owner ops — document steps only).
- Ghost/demo capper seed changes.

---

## QA checklist (manual)

1. Pick a legacy capper with multi-sport `PRE_IMPORT` rows (local seed or import).
2. Open `/cappers/[handle]` — sport breakdown sums to headline totals; bet-type section labelled honestly.
3. Open `/leaderboards?sport=NBA&window=all` — capper rank matches NBA row on profile.
4. Switch to `window=30d` — legacy baseline drops; rank may change; badge policy unchanged.
5. Open Discover sport specialty lane — legacy capper appears with correct sport ROI/units.
6. Zoom 375px + 200% browser zoom — tables scroll inside shell, no page clip.

---

## PR description template

```
## Summary
Organize legacy capper records per sport and bet type across profiles and leaderboards.

## Trust
- PRE_IMPORT baseline only on all-time + matching sport filter
- Bet-type breakdown scoped to pick-level data; sport totals include carried-over history
- Legacy badge preserved wherever baseline affects headline stats

## Test plan
- [ ] stats + leaderboard unit tests
- [ ] manual profile vs leaderboard sport filter check
- [ ] typecheck / lint / build
```

---

## Success definition

Done when a legacy capper's **public profile** and **sport-filtered all-time leaderboard position** tell the same story per sport, bet-type performance is visible and honestly scoped, and no surface double-counts or invents history the legacy platform never stored.
