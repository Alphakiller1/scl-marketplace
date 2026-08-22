import { expectedFinalAt } from "@/lib/results/grading-window";
import { isAutoGradeBlocked } from "@/lib/results/match";

/**
 * Plays the grader has permanently given up on, and a human must settle.
 *
 * This is the gap that let a tennis games spread sit for five days. Two correct
 * decisions combined into a silent one:
 *
 *   1. `isAutoGradeBlocked` refuses tennis spreads/totals, because the scores
 *      feed returns two numbers without saying whether they count sets or
 *      games. Settling "-4.5 games" against a 2-0 SET score invents a result.
 *   2. `listOverduePendingPlays` then filters those out, so a market nobody can
 *      grade does not permanently mark the pipeline UNHEALTHY.
 *
 * Each is right. Together they mean the one alert for ungraded plays ignores
 * exactly the plays that can never grade themselves — so the play is invisible
 * until somebody happens to ask. The refusal needs an OWNER, not just an
 * exclusion.
 *
 * Pure — no network, no server-only, unit-testable.
 */

export type ManualGradingCandidate = {
  sport: string;
  market: string;
  eventStartsAt: Date | null | undefined;
};

/**
 * True when auto-grading will never settle this play AND its event is over.
 *
 * The expected-final check matters: before it, the play is simply live, and a
 * queue that lists in-progress games trains people to ignore it.
 */
export function needsManualGrading(
  play: ManualGradingCandidate,
  now: Date,
): boolean {
  if (!isAutoGradeBlocked(play)) return false;
  if (play.eventStartsAt == null) return false;
  return expectedFinalAt(play.sport, play.eventStartsAt) <= now;
}

/** Why a human has to settle it, for the admin queue and the cron summary. */
export function manualGradingReason(
  play: Pick<ManualGradingCandidate, "sport" | "market">,
): string {
  if (play.sport.trim().toUpperCase() === "TENNIS") {
    return `${play.market} needs the game score — the feed reports sets, not games`;
  }
  return `${play.market} is not auto-gradeable for ${play.sport}`;
}
