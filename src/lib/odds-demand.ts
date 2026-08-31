export const LEAGUE_PICK_DEMAND_WINDOW_DAYS = 30;

export type LeaguePickDemandInput = {
  sport: string;
  league: string | null;
  capperId: string;
  pickCount: number;
  lastPickAt: Date;
};

export type LeaguePickDemand = {
  key: string;
  sport: string;
  league: string;
  activeCappers: number;
  picks: number;
  lastPickAt: string;
};

function displayValue(value: string | null | undefined, fallback: string) {
  return value?.trim() || fallback;
}

/**
 * Converts one database group per capper/league into an owner-facing demand
 * ranking. A capper counts once per league even when they submit many picks.
 */
export function summarizeLeaguePickDemand(
  rows: readonly LeaguePickDemandInput[],
): LeaguePickDemand[] {
  const groups = new Map<
    string,
    {
      sport: string;
      league: string;
      capperIds: Set<string>;
      picks: number;
      lastPickAt: Date;
    }
  >();

  for (const row of rows) {
    const sport = displayValue(row.sport, "Unknown");
    const league = displayValue(row.league, sport);
    const key = `${sport}:${league}`.toUpperCase();
    const current = groups.get(key) ?? {
      sport,
      league,
      capperIds: new Set<string>(),
      picks: 0,
      lastPickAt: row.lastPickAt,
    };
    current.capperIds.add(row.capperId);
    current.picks += Math.max(0, row.pickCount);
    if (row.lastPickAt > current.lastPickAt)
      current.lastPickAt = row.lastPickAt;
    groups.set(key, current);
  }

  return [...groups.entries()]
    .map(([key, group]) => ({
      key,
      sport: group.sport,
      league: group.league,
      activeCappers: group.capperIds.size,
      picks: group.picks,
      lastPickAt: group.lastPickAt.toISOString(),
    }))
    .sort(
      (a, b) =>
        b.activeCappers - a.activeCappers ||
        b.picks - a.picks ||
        a.league.localeCompare(b.league),
    );
}
