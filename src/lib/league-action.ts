export type LeagueActionInput = {
  sport: string;
  league: string | null;
  capperId: string;
};

export type LeagueActionCategoryKey =
  | "singles"
  | "parlays"
  | "props"
  | "sides"
  | "totals";

export type LeagueActionCategoryItem = {
  key: LeagueActionCategoryKey;
  label: string;
  picks: number;
  cappers: number;
};

export const LEAGUE_ACTION_CATEGORY_LABELS: Record<
  LeagueActionCategoryKey,
  string
> = {
  singles: "Singles",
  parlays: "Parlays",
  props: "Player Props",
  sides: "Sides",
  totals: "Totals",
};

export const LEAGUE_ACTION_CATEGORY_EMPTY: Record<
  LeagueActionCategoryKey,
  string
> = {
  singles: "No verified singles in the last 14 days.",
  parlays: "No verified parlays in the last 14 days.",
  props: "No verified player props in the last 14 days.",
  sides: "No verified sides in the last 14 days.",
  totals: "No verified totals in the last 14 days.",
};

export type LeagueActionPlayRow = LeagueActionInput & {
  market: string;
  parlayId: string | null;
};

export type LeagueActionParlayRow = {
  capperId: string;
};

function normMarket(market: string): string {
  return market.toLowerCase();
}

export function classifyPlayCategory(
  row: Pick<LeagueActionPlayRow, "market" | "parlayId">,
): LeagueActionCategoryKey | null {
  if (row.parlayId) return null;
  const m = normMarket(row.market);
  if (m.includes("prop")) return "props";
  if (m.includes("total") || /\b(over|under)\b/.test(m) || m.includes("o/u")) {
    return "totals";
  }
  if (
    m.includes("spread") ||
    m.includes("moneyline") ||
    m.includes("run line") ||
    m === "ml" ||
    m.includes(" h2h")
  ) {
    return "sides";
  }
  return "singles";
}

export function rankLeagueActionCategories(
  plays: LeagueActionPlayRow[],
  parlays: LeagueActionParlayRow[],
): LeagueActionCategoryItem[] {
  const buckets = new Map<
    LeagueActionCategoryKey,
    { picks: number; capperIds: Set<string> }
  >();

  for (const key of Object.keys(
    LEAGUE_ACTION_CATEGORY_LABELS,
  ) as LeagueActionCategoryKey[]) {
    buckets.set(key, { picks: 0, capperIds: new Set() });
  }

  for (const row of plays) {
    const cat = classifyPlayCategory(row);
    if (!cat) continue;
    const bucket = buckets.get(cat)!;
    bucket.picks += 1;
    bucket.capperIds.add(row.capperId);
  }

  const parlayBucket = buckets.get("parlays")!;
  for (const row of parlays) {
    parlayBucket.picks += 1;
    parlayBucket.capperIds.add(row.capperId);
  }

  return (
    Object.keys(LEAGUE_ACTION_CATEGORY_LABELS) as LeagueActionCategoryKey[]
  ).map((key) => {
    const bucket = buckets.get(key)!;
    return {
      key,
      label: LEAGUE_ACTION_CATEGORY_LABELS[key],
      picks: bucket.picks,
      cappers: bucket.capperIds.size,
    };
  });
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
