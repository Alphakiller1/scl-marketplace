import {
  PROFILE_PERF_WINDOWS,
  profilePerfWindowFilter,
  type ProfilePerfWindow,
} from "@/lib/profile-performance-windows";

/**
 * The chart shares the performance section's scopes.
 *
 * It used to carry its own 3M / 6M / 12M selector, which meant the graph and
 * the metric row beside it could describe different sets of picks at the same
 * time. One scope now drives both.
 */
export type ProfileChartWindow = ProfilePerfWindow;

export const PROFILE_CHART_WINDOWS = PROFILE_PERF_WINDOWS;

export type ProfileChartPoint = { n: number; units: number };
export type ProfileChartSeries = Record<
  ProfileChartWindow,
  { points: ProfileChartPoint[]; gradedCount: number }
>;

/**
 * `slateAt` places the position on a scope (event start where the pick is
 * bound to a game). Callers without it fall back to log time, which is what
 * the package charts do.
 */
type DatedProfit = {
  slateAt?: Date | null;
  createdAt: Date;
  outcome: string;
  profitUnits: number | null;
};

function slateOf(play: DatedProfit): Date {
  return play.slateAt ?? play.createdAt;
}

/**
 * Return settled, numeric profit units oldest-first for a profile chart scope.
 * `asOf` is injectable so the UI and tests never invent dates or points.
 */
export function profileProfitUnitsForWindow(
  plays: DatedProfit[],
  window: ProfileChartWindow,
  asOf: Date,
): number[] {
  const inWindow = profilePerfWindowFilter(window, asOf);
  return plays
    .filter(
      (play) =>
        play.outcome !== "PENDING" &&
        play.profitUnits != null &&
        Number.isFinite(play.profitUnits) &&
        inWindow(slateOf(play)),
    )
    .sort((a, b) => slateOf(a).getTime() - slateOf(b).getTime())
    .map((play) => play.profitUnits as number);
}

export type ProfileChartBaseline = {
  /** All-time legacy net: PRE_IMPORT plus prior complete years. */
  allUnits?: number;
  /** The old site's year-to-date net. */
  ytdUnits?: number;
  /** Plays at or before this instant are already inside `ytdUnits`. */
  legacySnapshotAt?: Date | null;
};

function round2(value: number): number {
  return Math.round((value + Number.EPSILON) * 100) / 100;
}

function openingBalance(value: number | undefined): number {
  return value != null && Number.isFinite(value) && value !== 0
    ? round2(value)
    : 0;
}

/**
 * Build bounded client payloads while retaining truthful counts and endpoints.
 *
 * A scope's final point has to equal the units the metric row reports for that
 * same scope, so the carried legacy balance opens the two scopes that hold it:
 * `all` from the all-time carry, `ytd` from the old site's year-to-date page.
 * Because that YTD aggregate already contains the imported pick rows, plays at
 * or before `legacySnapshotAt` are dropped from the YTD line rather than drawn
 * on top of it.
 *
 * Every rolling scope stays SCL-receipt-only: folding a frozen export into a
 * trailing window would invent form the source never had.
 */
export function buildProfileChartSeries(
  plays: DatedProfit[],
  asOf: Date,
  maxPoints = 120,
  baseline: ProfileChartBaseline = {},
): ProfileChartSeries {
  const allOpening = openingBalance(baseline.allUnits);
  const ytdOpening = openingBalance(baseline.ytdUnits);
  const snapshot = baseline.legacySnapshotAt ?? null;

  return Object.fromEntries(
    PROFILE_CHART_WINDOWS.map(({ key }) => {
      const scoped =
        key === "ytd" && ytdOpening !== 0 && snapshot
          ? plays.filter(
              (play) => play.createdAt.getTime() > snapshot.getTime(),
            )
          : plays;

      const profits = profileProfitUnitsForWindow(scoped, key, asOf);
      let running = key === "all" ? allOpening : key === "ytd" ? ytdOpening : 0;
      const points = profits.map((profit, index) => {
        running += profit;
        return { n: index + 1, units: round2(running) };
      });

      return [
        key,
        {
          points: downsampleCumulative(points, maxPoints),
          // gradedCount stays receipt-derived — baseline results have no picks.
          gradedCount: profits.length,
        },
      ];
    }),
  ) as ProfileChartSeries;
}

function downsampleCumulative(
  points: ProfileChartPoint[],
  maxPoints: number,
): ProfileChartPoint[] {
  if (points.length <= maxPoints || maxPoints < 2) return points;
  const indexes = new Set<number>([0, points.length - 1]);
  const step = (points.length - 1) / (maxPoints - 1);
  for (let index = 1; index < maxPoints - 1; index += 1) {
    indexes.add(Math.round(index * step));
  }
  return [...indexes].sort((a, b) => a - b).map((index) => points[index]!);
}
