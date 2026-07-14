export type LeagueActionInput = {
  sport: string;
  league: string | null;
  capperId: string;
};

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
