import type { Outcome } from "@prisma/client";

import { LEADERBOARD_SORTS, SPORT_KEYS } from "@/lib/constants";
import type { CapperSummary } from "@/lib/mock";

export const LEADERBOARD_WINDOWS = [
  { key: "all", label: "All Time" },
  { key: "7d", label: "Past 7 Days" },
  { key: "30d", label: "Past 30 Days" },
  { key: "90d", label: "Past 90 Days" },
  { key: "year", label: "This Year" },
] as const;

export const LEADERBOARD_MIN_PICKS = [0, 10, 25, 50] as const;

export type LeaderboardWindow = (typeof LEADERBOARD_WINDOWS)[number]["key"];
export type LeaderboardSort = (typeof LEADERBOARD_SORTS)[number]["key"];

export type LeaderboardFilters = {
  sport: string;
  window: LeaderboardWindow;
  sort: LeaderboardSort;
  minPicks: number;
  verifiedOnly: boolean;
  search: string;
};

type SearchParams = Record<string, string | string[] | undefined>;

const first = (value: string | string[] | undefined) =>
  Array.isArray(value) ? value[0] : value;

export function parseLeaderboardFilters(
  params: SearchParams,
): LeaderboardFilters {
  const requestedSport = first(params.sport)?.toUpperCase();
  const requestedWindow = first(params.window);
  const requestedSort = first(params.sort);
  const requestedMinPicks = Number(first(params.minPicks));

  return {
    sport:
      requestedSport && SPORT_KEYS.includes(requestedSport as never)
        ? requestedSport
        : "ALL",
    window: LEADERBOARD_WINDOWS.some((item) => item.key === requestedWindow)
      ? (requestedWindow as LeaderboardWindow)
      : "all",
    sort: LEADERBOARD_SORTS.some((item) => item.key === requestedSort)
      ? (requestedSort as LeaderboardSort)
      : "units",
    minPicks: LEADERBOARD_MIN_PICKS.includes(requestedMinPicks as never)
      ? requestedMinPicks
      : 0,
    verifiedOnly: first(params.record) !== "all",
    search: (first(params.q) ?? "").trim().slice(0, 40),
  };
}

export function leaderboardWindowStart(
  window: LeaderboardWindow,
  now = new Date(),
): Date | null {
  if (window === "all") return null;
  if (window === "year") {
    return new Date(Date.UTC(now.getUTCFullYear(), 0, 1));
  }

  const days = Number(window.replace("d", ""));
  return new Date(now.getTime() - days * 24 * 60 * 60 * 1000);
}

export function buildPerformanceTrend(
  plays: { outcome: Outcome; profitUnits: number | null }[],
  maxPoints = 12,
): number[] {
  const cumulative = [0];
  let total = 0;

  for (const play of plays) {
    if (
      play.outcome !== "WIN" &&
      play.outcome !== "LOSS" &&
      play.outcome !== "PUSH"
    ) {
      continue;
    }
    total += play.profitUnits ?? 0;
    cumulative.push(Number(total.toFixed(2)));
  }

  if (cumulative.length <= maxPoints) return cumulative;

  const sampled = Array.from({ length: maxPoints }, (_, index) => {
    const sourceIndex = Math.round(
      (index / (maxPoints - 1)) * (cumulative.length - 1),
    );
    return cumulative[sourceIndex];
  });
  sampled[sampled.length - 1] = cumulative[cumulative.length - 1];
  return sampled;
}

export function sortLeaderboard(
  cappers: CapperSummary[],
  sort: LeaderboardSort,
): CapperSummary[] {
  const ranked = [...cappers];
  ranked.sort((a, b) => {
    const primary =
      sort === "roi"
        ? b.roi - a.roi
        : sort === "winPct"
          ? b.winPct - a.winPct
          : b.units - a.units;
    return (
      primary ||
      (b.settledPicks ?? 0) - (a.settledPicks ?? 0) ||
      a.name.localeCompare(b.name)
    );
  });
  return ranked;
}

export function hasLeaderboardSample(
  capper: CapperSummary,
  filters: LeaderboardFilters,
): boolean {
  const settledPicks = capper.settledPicks ?? 0;
  const isScoped = filters.sport !== "ALL" || filters.window !== "all";
  return (!isScoped || settledPicks > 0) && settledPicks >= filters.minPicks;
}

export type LeaderboardSummary = {
  rankedCappers: number;
  verifiedCappers: number;
  trackedPicks: number;
  winPct: number;
  netUnits: number;
  roi: number;
  profitableCappers: number;
};

export function summarizeLeaderboard(
  cappers: CapperSummary[],
): LeaderboardSummary {
  const totals = cappers.reduce(
    (summary, capper) => {
      summary.verifiedCappers += capper.verified ? 1 : 0;
      summary.trackedPicks += capper.settledPicks ?? 0;
      summary.wins += capper.record.w;
      summary.losses += capper.record.l;
      summary.netUnits += capper.units;
      summary.stakedUnits += capper.stakedUnits ?? 0;
      summary.profitableCappers += capper.units > 0 ? 1 : 0;
      return summary;
    },
    {
      verifiedCappers: 0,
      trackedPicks: 0,
      wins: 0,
      losses: 0,
      netUnits: 0,
      stakedUnits: 0,
      profitableCappers: 0,
    },
  );
  const decisions = totals.wins + totals.losses;

  return {
    rankedCappers: cappers.length,
    verifiedCappers: totals.verifiedCappers,
    trackedPicks: totals.trackedPicks,
    winPct: decisions ? (totals.wins / decisions) * 100 : 0,
    netUnits: totals.netUnits,
    roi: totals.stakedUnits ? (totals.netUnits / totals.stakedUnits) * 100 : 0,
    profitableCappers: totals.profitableCappers,
  };
}
