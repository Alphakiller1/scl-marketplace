import type { Outcome } from "@prisma/client";

import { LEADERBOARD_SORTS, SPORT_KEYS } from "@/lib/constants";
import type { CapperSummary } from "@/lib/mock";
import { hasSignal } from "@/lib/sample";

/** Compact Rank-mode time scopes (year kept for URL back-compat only). */
export const LEADERBOARD_WINDOWS = [
  { key: "1d", label: "1D", longLabel: "Past 24 Hours" },
  { key: "7d", label: "7D", longLabel: "Past 7 Days" },
  { key: "14d", label: "14D", longLabel: "Past 14 Days" },
  { key: "30d", label: "30D", longLabel: "Past 30 Days" },
  { key: "90d", label: "90D", longLabel: "Past 90 Days" },
  { key: "all", label: "All", longLabel: "All Time" },
  { key: "year", label: "Year", longLabel: "This Year" },
] as const;

/** Windows shown in the compact scope bar (excludes year). */
export const LEADERBOARD_SCOPE_WINDOWS = LEADERBOARD_WINDOWS.filter(
  (w) => w.key !== "year",
);

export const LEADERBOARD_MIN_PICKS = [0, 10, 25, 50] as const;

export const LEADERBOARD_LIMITS = [10, 20, 50] as const;
export type LeaderboardLimit = (typeof LEADERBOARD_LIMITS)[number];
export const DEFAULT_LEADERBOARD_LIMIT: LeaderboardLimit = 10;

export type LeaderboardWindow = (typeof LEADERBOARD_WINDOWS)[number]["key"];
export type LeaderboardSort = (typeof LEADERBOARD_SORTS)[number]["key"];
export type LeaderboardSortDirection = "desc" | "asc";

export type LeaderboardFilters = {
  sport: string;
  window: LeaderboardWindow;
  sort: LeaderboardSort;
  direction?: LeaderboardSortDirection;
  minPicks: number;
  verifiedOnly: boolean;
  search: string;
  limit: LeaderboardLimit;
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
  const requestedLimit = Number(first(params.limit));

  return {
    sport:
      requestedSport && SPORT_KEYS.includes(requestedSport as never)
        ? requestedSport
        : "ALL",
    window:
      requestedWindow !== "year" &&
      LEADERBOARD_SCOPE_WINDOWS.some((item) => item.key === requestedWindow)
        ? (requestedWindow as LeaderboardWindow)
        : "all",
    sort: LEADERBOARD_SORTS.some((item) => item.key === requestedSort)
      ? (requestedSort as LeaderboardSort)
      : "units",
    direction: first(params.dir) === "asc" ? "asc" : "desc",
    minPicks: LEADERBOARD_MIN_PICKS.includes(requestedMinPicks as never)
      ? requestedMinPicks
      : 0,
    // Defaults to every public record. "Verified only" stays available and
    // still means exactly what it says (email-verified accounts), but it can't
    // be the default: cappers carried over from the previous platform are
    // unclaimed until they take ownership of their handle, so defaulting to it
    // showed an empty board rather than the roster.
    verifiedOnly: first(params.record) === "verified",
    search: (first(params.q) ?? "").trim().slice(0, 40),
    limit: LEADERBOARD_LIMITS.includes(requestedLimit as never)
      ? (requestedLimit as LeaderboardLimit)
      : DEFAULT_LEADERBOARD_LIMIT,
  };
}

/** Build a leaderboard href preserving current filters with overrides. */
export function leaderboardHref(
  filters: LeaderboardFilters,
  overrides: Partial<{
    sport: string;
    window: string;
    sort: string;
    direction: LeaderboardSortDirection;
    minPicks: number;
    verifiedOnly: boolean;
    search: string;
    limit: number;
  }> = {},
  basePath = "/leaderboard",
): string {
  const next = { ...filters, ...overrides };
  const params = new URLSearchParams();
  if (next.sport !== "ALL") params.set("sport", next.sport);
  if (next.window !== "all") params.set("window", next.window);
  if (next.sort !== "units") params.set("sort", next.sort);
  if (next.direction === "asc") params.set("dir", "asc");
  if (next.minPicks !== 0) params.set("minPicks", String(next.minPicks));
  // Mirrors the parse above: all records is the default, so only the narrower
  // "verified" choice needs to survive in the URL.
  if (next.verifiedOnly) params.set("record", "verified");
  if (next.search) params.set("q", next.search);
  if (next.limit !== DEFAULT_LEADERBOARD_LIMIT) {
    params.set("limit", String(next.limit));
  }
  const qs = params.toString();
  return qs ? `${basePath}?${qs}` : basePath;
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

function primarySortValue(
  capper: CapperSummary,
  sort: LeaderboardSort,
): number {
  switch (sort) {
    case "roi":
      return capper.roi;
    case "winPct":
      return capper.winPct;
    case "clv":
      return capper.avgClv ?? Number.NEGATIVE_INFINITY;
    case "sample":
      return capper.settledPicks ?? 0;
    case "form":
      return capper.streak;
    case "units":
    default:
      return capper.units;
  }
}

export function sortLeaderboard(
  cappers: CapperSummary[],
  sort: LeaderboardSort,
  direction: LeaderboardSortDirection = "desc",
): CapperSummary[] {
  const ranked = [...cappers];
  ranked.sort((a, b) => {
    const primary =
      direction === "asc"
        ? primarySortValue(a, sort) - primarySortValue(b, sort)
        : primarySortValue(b, sort) - primarySortValue(a, sort);
    return (
      primary ||
      (b.settledPicks ?? 0) - (a.settledPicks ?? 0) ||
      a.name.localeCompare(b.name)
    );
  });
  return ranked;
}

/**
 * Eligible for a public rank number: at least one graded pick in scope, and
 * at/above the selected minimum sample. Zero-sample and below-minimum cappers
 * stay visible as unranked ("Building a record") instead of faking a place.
 */
export function isLeaderboardEligible(
  capper: CapperSummary,
  filters: LeaderboardFilters,
): boolean {
  const settledPicks = capper.settledPicks ?? 0;
  const base = settledPicks > 0 && settledPicks >= filters.minPicks;
  if (!base) return false;
  // CLV rank: need signal-sized sample and at least one stored close.
  if (filters.sort === "clv") {
    return hasSignal(settledPicks) && capper.avgClv != null;
  }
  return true;
}

/**
 * Same gate as {@link partitionLeaderboard} / {@link isLeaderboardEligible}.
 * Prefer `rank` from a partitioned CapperSummary when present so feed cards
 * agree with the leaderboard band; otherwise fall back to settled-sample math.
 */
export function isBuildingARecord(
  input: {
    rank?: number | null;
    settledPicks?: number | null;
    units?: number | null;
    roi?: number | null;
  },
  minPicks: number = 0,
): boolean {
  if (typeof input.rank === "number") return input.rank <= 0;
  // Unknown sample → don't claim "building" (mock cards without partition data).
  if (input.settledPicks == null) return false;
  const settledPicks = input.settledPicks;
  if (!(settledPicks > 0 && settledPicks >= minPicks)) return true;
  return false;
}

/** @deprecated Prefer `isLeaderboardEligible` — kept for callers that still
 * gate on sample presence rather than ranked/unranked split. */
export function hasLeaderboardSample(
  capper: CapperSummary,
  filters: LeaderboardFilters,
): boolean {
  return isLeaderboardEligible(capper, filters);
}

export type LeaderboardPartition = {
  ranked: CapperSummary[];
  unranked: CapperSummary[];
};

/**
 * Split cappers into ranked (sample-eligible, numbered) and unranked (zero
 * graded / below minimum — `rank` cleared to 0, no competition place).
 */
export function partitionLeaderboard(
  cappers: CapperSummary[],
  filters: LeaderboardFilters,
): LeaderboardPartition {
  const eligible: CapperSummary[] = [];
  const building: CapperSummary[] = [];

  for (const capper of cappers) {
    if (isLeaderboardEligible(capper, filters)) eligible.push(capper);
    else building.push(capper);
  }

  const ranked = sortLeaderboard(
    eligible,
    filters.sort,
    filters.direction ?? "desc",
  );
  ranked.forEach((capper, index) => {
    capper.rank = index + 1;
  });

  const unranked = sortLeaderboard(
    building,
    filters.sort,
    filters.direction ?? "desc",
  );
  unranked.forEach((capper) => {
    capper.rank = 0;
  });

  return { ranked, unranked };
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
  ranked: CapperSummary[],
  unranked: CapperSummary[] = [],
): LeaderboardSummary {
  const scoped = ranked.concat(unranked);
  const totals = scoped.reduce(
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
    rankedCappers: ranked.length,
    verifiedCappers: totals.verifiedCappers,
    trackedPicks: totals.trackedPicks,
    winPct: decisions ? (totals.wins / decisions) * 100 : 0,
    netUnits: totals.netUnits,
    roi: totals.stakedUnits ? (totals.netUnits / totals.stakedUnits) * 100 : 0,
    profitableCappers: totals.profitableCappers,
  };
}
