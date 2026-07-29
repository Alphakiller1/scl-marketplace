# Spec — Auto-grade player props & inning markets (stats feed)

**Goal:** eliminate the one class of plays that can't auto-grade today, so they stop routing to the manual backup queue.

## The gap

`src/lib/results/match.ts → isDeferredProp()` defers **player props**, **inning / First-Five (F5)**, and **innings totals** — `resolveOutcome()` returns `null` for them (`skip-reason.ts` tags `props_deferred`). Reason: the current results providers (The Odds API scores + ESPN **scoreboard**) return **final game scores only** — not player stat lines or partial-game/inning scores. A final score can't settle "Star Over 27.5 Pts" or "First 5 Over 4.5". These plays therefore stay `PENDING` until an admin force-grades them (the backup restored in #296).

## What auto-grading these needs

A per-event **box score** source that yields:

- **Player stat lines** — pts / reb / ast / 3PM / PRA (NBA), plus equivalents per sport — to settle player props.
- **Line/period scores** — inning-by-inning (MLB) and quarter/half (for F5-style partial markets).

## Recommended approach — extend the existing ESPN provider (free, already integrated)

ESPN already backs the scoreboard path (`src/lib/results/espn-scores.ts`, `espn-scoreboard-map.ts`). ESPN's **event summary** endpoint (`site.api.espn.com/apis/site/v2/sports/{sport}/{league}/summary?event={eventId}`) returns **boxscore.players** (per-player stat lines) and **linescores** (innings/periods) for the same `eventId` we already bind at pick submission (`Play.eventId`). So this is an extension of the current, free ESPN integration — not a new vendor.

**Premium alternative:** a paid stats API (SportsDataIO, Sportradar, api-sports.io) for higher reliability, historical depth, and cleaner player-id matching — worth it if props become a large share of volume or ESPN coverage proves flaky. The architecture below is provider-agnostic; ESPN is just the first implementation.

## Architecture

Add a **prop/period resolver** alongside the existing game resolver, wired into the same pipeline:

1. **`src/lib/results/stats-provider.ts` (new)** — `getEventBoxScore(sport, league, eventId)` → `{ players: {name, team, stats:{pts,reb,ast,…}}[], periods: {home:number[], away:number[]} }`. Implement against the ESPN summary endpoint; cache per `eventId` for a run.
2. **`src/lib/results/prop-resolve.ts` (new)** — `resolvePropOutcome(play, boxScore)` → `Outcome | null`. Parses the play into `{ player?, statKey?, side (Over/Under), line }` (props) or `{ team?, period (F5/inning), total, side }` (period markets), compares against the box score, returns WIN/LOSS/PUSH. Returns `null` only when the needed stat truly isn't present.
3. **`match.ts`** — keep `isDeferredProp` as the _router_ (identifies prop/period markets), but instead of always returning `null`, hand those plays to `resolvePropOutcome` with a fetched box score.
4. **`auto-grade.ts` (`autoGradePending`)** — for each pending play whose event is final: if a standard market → existing resolver; if a prop/period market → fetch box score (once per event) → `resolvePropOutcome`. Grade on a non-null outcome; if `null`, fall through to the existing skip/stuck path (→ manual backup).
5. **`skip-reason.ts`** — add `stats_unavailable` so an event that's final but has no usable box score is classified distinctly from `props_deferred` (which then only means "no resolver at all", i.e. retired once this ships).

## Selection parsing (the hard, test-worthy part)

The seed and real entries use strings like `"Bucks Star Over 11.34 Pts"`, `"PHI/PIT u4.5 First Five"`. Parsing needs:

- **Player props:** extract player name (fuzzy-match to `boxScore.players` — normalize accents/casing; this is where a paid provider's stable player IDs help), stat key (`Pts/Reb/Ast/3PM/PRA`), `Over/Under`, and the numeric line.
- **Period markets:** extract team(s) or matchup, the period (First Five = innings 1–5; F5/first-half), and the total + side.
- Build this as a **pure, unit-tested** function (mirror `espn-scores.test.ts` / `auto-grade.test.ts`), because ambiguous selection strings are the main failure mode. Prefer resolving from **structured fields** (`Play.side`, `Play.line`, `Play.market`) over free-text `selection` wherever they're populated at submit.

## Grading rules

- **Over/Under prop:** compare `stat` vs `line` → WIN if beyond in the play's direction, LOSS if not, PUSH on exact equality.
- **Period total (F5/innings):** sum the relevant `periods` slice for both teams → compare to `line` → WIN/LOSS/PUSH by side.
- **DNP / not found:** if a propped player didn't play (no stat line) → **VOID** (deterministic, no human) — a common book rule and safe for auto.

## Fallback (unchanged safety net)

When the box score is unavailable or unparseable, the play falls through to the **manual backup** (#296) and, if you later add an auto-void deadline, gets voided after N days. So this feature _shrinks_ the backup queue; it never blocks settlement.

## Submission-side lever (optional, complementary)

At pick entry, prefer capturing **structured** prop fields (player, stat, line, side) rather than free text, so grading resolves from data, not string-parsing. Extends the existing board-verified event binding.

## Phasing

1. **P1 — MLB F5 / inning totals:** simplest (line scores, no player-name matching). Ship `stats-provider` + period path first.
2. **P2 — NBA player props:** highest volume, needs the player-name matcher + stat map.
3. **P3 — remaining sports' props** (NFL/NHL/NCAA) once the matcher is proven.

## Effort & risk

- **Effort:** medium. The pipeline hooks are small; the weight is the ESPN summary client, the selection parser, and its tests.
- **Risk:** player-name matching against ESPN box scores (fuzzy) is the fragile part — mitigated by VOID-on-not-found and the manual backup. A paid provider with stable player IDs removes most of this risk if reliability matters.

## Files

New: `src/lib/results/stats-provider.ts`, `src/lib/results/prop-resolve.ts` (+ tests). Touch: `match.ts`, `auto-grade.ts`, `skip-reason.ts`, `provider.ts`. Env: `STATS_PROVIDER` / any paid API key in `.env.example`.

_Net: props and inning markets auto-grade like everything else; the manual override (#296) reverts to a true rare backup._
