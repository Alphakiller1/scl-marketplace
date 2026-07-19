export type ProfileChartWindow = "3m" | "6m" | "12m" | "all";

export type ProfileChartPoint = { n: number; units: number };
export type ProfileChartSeries = Record<
  ProfileChartWindow,
  { points: ProfileChartPoint[]; gradedCount: number }
>;

export const PROFILE_CHART_WINDOWS: ReadonlyArray<{
  value: ProfileChartWindow;
  label: string;
  months: number | null;
}> = [
  { value: "3m", label: "3M", months: 3 },
  { value: "6m", label: "6M", months: 6 },
  { value: "12m", label: "12M", months: 12 },
  { value: "all", label: "All", months: null },
];

type DatedProfit = {
  createdAt: Date;
  outcome: string;
  profitUnits: number | null;
};

/**
 * Return settled, numeric profit units oldest-first for a profile chart scope.
 * `asOf` is injectable so the UI and tests never invent dates or points.
 */
export function profileProfitUnitsForWindow(
  plays: DatedProfit[],
  window: ProfileChartWindow,
  asOf: Date,
): number[] {
  const months = PROFILE_CHART_WINDOWS.find(
    (candidate) => candidate.value === window,
  )?.months;
  const cutoff = months == null ? null : subtractUtcMonths(asOf, months);

  return [...plays]
    .filter(
      (play) =>
        play.outcome !== "PENDING" &&
        play.profitUnits != null &&
        Number.isFinite(play.profitUnits) &&
        (cutoff == null || play.createdAt.getTime() >= cutoff.getTime()) &&
        play.createdAt.getTime() <= asOf.getTime(),
    )
    .sort((a, b) => a.createdAt.getTime() - b.createdAt.getTime())
    .map((play) => play.profitUnits as number);
}

/** Build bounded client payloads while retaining truthful counts and endpoints. */
export function buildProfileChartSeries(
  plays: DatedProfit[],
  asOf: Date,
  maxPoints = 120,
): ProfileChartSeries {
  return Object.fromEntries(
    PROFILE_CHART_WINDOWS.map(({ value }) => {
      const profits = profileProfitUnitsForWindow(plays, value, asOf);
      let running = 0;
      const points = profits.map((profit, index) => {
        running += profit;
        return {
          n: index + 1,
          units: Math.round((running + Number.EPSILON) * 100) / 100,
        };
      });
      return [
        value,
        {
          points: downsampleCumulative(points, maxPoints),
          gradedCount: points.length,
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

function subtractUtcMonths(date: Date, months: number): Date {
  const copy = new Date(date.getTime());
  const day = copy.getUTCDate();
  copy.setUTCDate(1);
  copy.setUTCMonth(copy.getUTCMonth() - months);
  const lastDay = new Date(
    Date.UTC(copy.getUTCFullYear(), copy.getUTCMonth() + 1, 0),
  ).getUTCDate();
  copy.setUTCDate(Math.min(day, lastDay));
  return copy;
}
