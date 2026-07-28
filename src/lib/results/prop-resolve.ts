import type { Outcome } from "@prisma/client";

/**
 * Pure resolver for period-total markets (First-Five / first-N innings) — the
 * subset of `isDeferredProp` plays that can be settled from a box score's
 * period line-scores alone, with NO fragile player-name matching. Player props
 * still return null here (they need stable player IDs / a dedicated stats feed —
 * see docs/GRADING_PROPS_STATS_FEED_SPEC.md) and therefore keep deferring to the
 * manual backup, so this is strictly additive: an unconfident parse returns null
 * and behaviour is unchanged.
 *
 * No DB, no server-only — unit-testable.
 */

/** Per-period scores (index 0 = 1st inning/quarter), plus the players block for future prop support. */
export type BoxScore = {
  homePeriods: number[];
  awayPeriods: number[];
};

type OverUnder = "over" | "under";

/**
 * Parse a First-Five / first-N-innings total selection into { periods, side, line }.
 * Returns null when it is not confidently a period total (→ defer, never guess).
 * Examples: "PHI/PIT u4.5 First Five", "First 5 Innings Over 4.5", "F5 Under 5".
 */
export function parsePeriodTotal(
  selection: string,
): { periods: number; side: OverUnder; line: number } | null {
  const s = selection.toLowerCase();

  const firstN = s.match(/first[\s-]?(\d+)\s*innings?/);
  const periods = /first[\s-]?five|\bf5\b/.test(s)
    ? 5
    : firstN
      ? Number(firstN[1])
      : null;
  if (periods == null || periods < 1 || periods > 9) return null;

  // side + line: "o4.5" / "u 4.5" / "over 4.5" / "under 4.5"
  const m = s.match(/\b(o|u|over|under)\s*(\d+(?:\.\d+)?)/);
  if (!m) return null;
  const side: OverUnder = /^o/.test(m[1]) ? "over" : "under";
  const line = Number(m[2]);
  if (!Number.isFinite(line)) return null;

  return { periods, side, line };
}

/** Over/Under settlement: exact line → PUSH. */
export function overUnderOutcome(
  actual: number,
  line: number,
  side: OverUnder,
): Outcome {
  if (actual === line) return "PUSH";
  const wentOver = actual > line;
  return (side === "over" ? wentOver : !wentOver) ? "WIN" : "LOSS";
}

/**
 * Resolve a period-total play from the box score. Returns null (→ defer) when the
 * selection isn't a confident period total or the line-scores don't cover the
 * needed periods yet, so it never settles on incomplete data.
 */
export function resolvePeriodTotal(
  selection: string,
  box: BoxScore,
): Outcome | null {
  const parsed = parsePeriodTotal(selection);
  if (!parsed) return null;

  const { periods, side, line } = parsed;
  if (box.homePeriods.length < periods || box.awayPeriods.length < periods) {
    return null;
  }

  const sumFirst = (arr: number[]) => {
    let total = 0;
    for (let i = 0; i < periods; i++) {
      const v = arr[i];
      if (!Number.isFinite(v)) return null;
      total += v;
    }
    return total;
  };

  const home = sumFirst(box.homePeriods);
  const away = sumFirst(box.awayPeriods);
  if (home == null || away == null) return null;

  return overUnderOutcome(home + away, line, side);
}
