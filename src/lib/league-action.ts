import { computeCapperStats } from "@/lib/stats";
import { hasSignal } from "@/lib/sample";

export type LeagueActionInput = {
  sport: string;
  league: string | null;
  capperId: string;
};

/** Shape (entity) + market (market string) bet-type keys for the platform report. */
export type LeagueActionCategoryKey =
  | "singles"
  | "parlays"
  | "props"
  | "sides"
  | "totals"
  | "futures";

export type LeagueActionCategoryGroup = "shape" | "market";

export type LeagueActionCategoryItem = {
  key: LeagueActionCategoryKey;
  group: LeagueActionCategoryGroup;
  label: string;
  /** Tracked picks in the window (pending + graded). */
  picks: number;
  cappers: number;
  /** Graded sample (W+L+P) — drives maturity + signal gate. */
  graded: number;
  /**
   * Performance in the window. Null when graded &lt; MIN_GRADED_FOR_SIGNAL
   * (honest em-dash — never fabricate a ramp from a tiny sample).
   */
  roi: number | null;
  units: number | null;
  /** Pre-game captures when eventStartsAt is known and createdAt &lt; start. */
  preGame: number | null;
  /** Live/in-play captures when eventStartsAt is known and createdAt ≥ start. */
  live: number | null;
};

export const LEAGUE_ACTION_CATEGORY_LABELS: Record<
  LeagueActionCategoryKey,
  string
> = {
  singles: "Singles",
  parlays: "Parlays",
  sides: "Sides",
  totals: "Totals",
  props: "Player Props",
  futures: "Futures",
};

export const LEAGUE_ACTION_CATEGORY_GROUP: Record<
  LeagueActionCategoryKey,
  LeagueActionCategoryGroup
> = {
  singles: "shape",
  parlays: "shape",
  sides: "market",
  totals: "market",
  props: "market",
  futures: "market",
};

/** Display order: Shape first, then Market. */
export const LEAGUE_ACTION_CATEGORY_ORDER: LeagueActionCategoryKey[] = [
  "singles",
  "parlays",
  "sides",
  "totals",
  "props",
  "futures",
];

/**
 * GPT-locked honest empties (14-day window copy).
 * Futures follows the same board-verified pattern (not in the GPT list; design has Futures).
 */
export const LEAGUE_ACTION_CATEGORY_EMPTY: Record<
  LeagueActionCategoryKey,
  string
> = {
  singles: "No Odds-Verified singles tracked in the last 14 days.",
  parlays: "No Odds-Verified parlays tracked in the last 14 days.",
  props: "No Odds-Verified player props tracked in the last 14 days.",
  sides: "No Odds-Verified sides tracked in the last 14 days.",
  totals: "No Odds-Verified totals tracked in the last 14 days.",
  futures: "No Odds-Verified futures tracked in the last 14 days.",
};

/** Matches leaderboard public-surface eligibility tone (ranked + building). */
export const PLATFORM_REPORT_ELIGIBILITY_FOOTNOTE =
  "Odds-Verified Picks From Publicly Listed Cappers, Including Ranked Cappers And Cappers Building A Record. Test Accounts Are Excluded. ROI And Units Appear Only After The Minimum Graded Sample Is Met.";

/** Homepage section subtitle (GPT-locked voice — no “most successful” hype). */
export function platformReportSubtitle(windowDays: number): string {
  return `Odds-Verified Bet Types From Publicly Listed Cappers — Last ${windowDays} Days.`;
}

/** Metric label for categories with tracked volume (singular-aware). */
export function platformReportSegmentLabel(n: number): string {
  return n === 1 ? "Active Segment" : "Active Segments";
}

/** Metric label for tracked leagues (singular-aware). */
export function platformReportLeagueLabel(n: number): string {
  return n === 1 ? "Tracked League" : "Tracked Leagues";
}

/** Singular-aware count phrase, e.g. "1 capper" / "3 cappers". */
export function countLabel(
  n: number,
  singular: string,
  plural: string,
): string {
  return `${n.toLocaleString()} ${n === 1 ? singular : plural}`;
}

export type LeagueActionPlayRow = LeagueActionInput & {
  market: string;
  parlayId: string | null;
  outcome: string;
  units: number;
  profitUnits: number | null;
  createdAt: Date | string;
  eventStartsAt?: Date | string | null;
};

export type LeagueActionParlayRow = {
  capperId: string;
  outcome: string;
  units: number;
  profitUnits: number | null;
  createdAt: Date | string;
  /** Earliest leg start when known — enables live/pre-game split. */
  eventStartsAt?: Date | string | null;
};

function normMarket(market: string): string {
  return market.toLowerCase();
}

/** Market family for a straight play (parlay legs are not market-typed here). */
export function classifyMarketCategory(
  market: string,
): Exclude<LeagueActionCategoryKey, "singles" | "parlays"> | null {
  const m = normMarket(market);
  if (m.includes("future") || m.includes("outright") || m.includes("futures")) {
    return "futures";
  }
  if (m.includes("prop")) return "props";
  if (m.includes("total") || /\b(over|under)\b/.test(m) || m.includes("o/u")) {
    return "totals";
  }
  if (
    m.includes("spread") ||
    m.includes("moneyline") ||
    m.includes("run line") ||
    m.includes("puck line") ||
    m === "ml" ||
    m.includes("h2h")
  ) {
    return "sides";
  }
  return null;
}

/**
 * @deprecated Prefer {@link classifyMarketCategory} + shape rules.
 * Kept for callers that still want a single flat key (parlay legs → null).
 */
export function classifyPlayCategory(
  row: Pick<LeagueActionPlayRow, "market" | "parlayId">,
): LeagueActionCategoryKey | null {
  if (row.parlayId) return null;
  return classifyMarketCategory(row.market) ?? "singles";
}

type BucketAcc = {
  picks: number;
  capperIds: Set<string>;
  rows: { outcome: string; units: number; profitUnits: number | null }[];
  preGame: number;
  live: number;
  timingKnown: number;
};

function emptyBucket(): BucketAcc {
  return {
    picks: 0,
    capperIds: new Set(),
    rows: [],
    preGame: 0,
    live: 0,
    timingKnown: 0,
  };
}

function timingSplit(
  createdAt: Date | string,
  eventStartsAt: Date | string | null | undefined,
): "preGame" | "live" | null {
  if (eventStartsAt == null) return null;
  const start = new Date(eventStartsAt);
  const created = new Date(createdAt);
  if (Number.isNaN(start.getTime()) || Number.isNaN(created.getTime())) {
    return null;
  }
  return created.getTime() < start.getTime() ? "preGame" : "live";
}

function addToBucket(
  bucket: BucketAcc,
  row: {
    capperId: string;
    outcome: string;
    units: number;
    profitUnits: number | null;
    createdAt: Date | string;
    eventStartsAt?: Date | string | null;
  },
) {
  bucket.picks += 1;
  bucket.capperIds.add(row.capperId);
  bucket.rows.push({
    outcome: row.outcome,
    units: row.units,
    profitUnits: row.profitUnits,
  });
  const timing = timingSplit(row.createdAt, row.eventStartsAt);
  if (timing === "preGame") {
    bucket.preGame += 1;
    bucket.timingKnown += 1;
  } else if (timing === "live") {
    bucket.live += 1;
    bucket.timingKnown += 1;
  }
}

function finalizeBucket(
  key: LeagueActionCategoryKey,
  bucket: BucketAcc,
): LeagueActionCategoryItem {
  const stats = computeCapperStats(
    bucket.rows.map((r) => ({
      outcome: r.outcome as never,
      units: r.units,
      profitUnits: r.profitUnits,
    })),
  );
  const graded = stats.settled;
  const signal = hasSignal(graded);
  return {
    key,
    group: LEAGUE_ACTION_CATEGORY_GROUP[key],
    label: LEAGUE_ACTION_CATEGORY_LABELS[key],
    picks: bucket.picks,
    cappers: bucket.capperIds.size,
    graded,
    roi: signal ? stats.roi : null,
    units: signal ? stats.units : null,
    preGame: bucket.timingKnown > 0 ? bucket.preGame : null,
    live: bucket.timingKnown > 0 ? bucket.live : null,
  };
}

/**
 * Bet-Type Breakdown: Shape (Singles / Parlays) and Market (Sides / Totals /
 * Props / Futures). Singles and market buckets count Play rows with
 * `parlayId == null` only — parlays are counted as Parlay entities, never
 * flattened via legs.
 */
export function rankLeagueActionCategories(
  plays: LeagueActionPlayRow[],
  parlays: LeagueActionParlayRow[],
): LeagueActionCategoryItem[] {
  const buckets = new Map<LeagueActionCategoryKey, BucketAcc>();
  for (const key of LEAGUE_ACTION_CATEGORY_ORDER) {
    buckets.set(key, emptyBucket());
  }

  for (const row of plays) {
    // Parlay legs are components of a Parlay position — never count in shape/market.
    if (row.parlayId) continue;

    addToBucket(buckets.get("singles")!, row);

    const market = classifyMarketCategory(row.market);
    if (market) addToBucket(buckets.get(market)!, row);
  }

  for (const row of parlays) {
    addToBucket(buckets.get("parlays")!, row);
  }

  return LEAGUE_ACTION_CATEGORY_ORDER.map((key) =>
    finalizeBucket(key, buckets.get(key)!),
  );
}

/** Shape rows only (Singles + Parlays). */
export function shapeCategories(
  categories: LeagueActionCategoryItem[],
): LeagueActionCategoryItem[] {
  return categories.filter((c) => c.group === "shape");
}

/** Market rows only (Sides / Totals / Props / Futures). */
export function marketCategories(
  categories: LeagueActionCategoryItem[],
): LeagueActionCategoryItem[] {
  return categories.filter((c) => c.group === "market");
}

/**
 * Tracked volume without double-counting: shape singles + parlays.
 * Market buckets are a different slice of the same singles set.
 */
export function platformTrackedPicks(
  categories: LeagueActionCategoryItem[],
): number {
  return shapeCategories(categories).reduce((sum, c) => sum + c.picks, 0);
}

export type LeagueActionItem = {
  key: string;
  sport: string;
  league: string;
  pickCount: number;
  activeCappers: number;
};

function leagueName(row: Pick<LeagueActionInput, "sport" | "league">): string {
  return row.league?.trim() || row.sport.trim() || "Unknown";
}

export function leagueInitials(name: string): string {
  const words = name
    .replace(/[^a-zA-Z0-9 ]+/g, " ")
    .split(/\s+/)
    .filter(Boolean);

  if (!words.length) return "SCL";
  if (words.length === 1) return words[0].slice(0, 4).toUpperCase();

  return words
    .slice(0, 3)
    .map((word) => word[0])
    .join("")
    .toUpperCase();
}

export function rankLeagueAction(
  rows: LeagueActionInput[],
  take = 6,
): LeagueActionItem[] {
  const groups = new Map<
    string,
    {
      sport: string;
      league: string;
      pickCount: number;
      capperIds: Set<string>;
    }
  >();

  for (const row of rows) {
    const sport = row.sport.trim() || "Unknown";
    const league = leagueName(row);
    const key = `${sport}:${league}`.toUpperCase();
    const current = groups.get(key) ?? {
      sport,
      league,
      pickCount: 0,
      capperIds: new Set<string>(),
    };

    current.pickCount += 1;
    current.capperIds.add(row.capperId);
    groups.set(key, current);
  }

  return [...groups.entries()]
    .map(([key, group]) => ({
      key,
      sport: group.sport,
      league: group.league,
      pickCount: group.pickCount,
      activeCappers: group.capperIds.size,
    }))
    .sort(
      (a, b) =>
        b.pickCount - a.pickCount ||
        b.activeCappers - a.activeCappers ||
        a.league.localeCompare(b.league),
    )
    .slice(0, take);
}
