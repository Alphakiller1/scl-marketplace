import type { SettledGame } from "@/lib/results/settled-game";

type EspnCompetitor = {
  homeAway?: string;
  score?: string | number;
  team?: { displayName?: string; name?: string; shortDisplayName?: string };
};

type EspnEvent = {
  id?: string;
  competitions?: Array<{
    competitors?: EspnCompetitor[];
    status?: { type?: { completed?: boolean; name?: string } };
  }>;
  status?: { type?: { completed?: boolean; name?: string } };
};

/**
 * Canonical team labels so All-Star / league ML picks join cleanly.
 * ESPN uses "American All-Stars"; SCL slips often say "American League".
 */
export function canonicalizeEspnTeamName(name: string): string {
  const n = name
    .toLowerCase()
    .replace(/[^a-z0-9 ]/g, " ")
    .trim();
  if (n.includes("american") && n.includes("all")) return "American League";
  if (n.includes("national") && n.includes("all")) return "National League";
  return name.trim();
}

export function yyyymmddUtc(d: Date): string {
  const y = d.getUTCFullYear();
  const m = String(d.getUTCMonth() + 1).padStart(2, "0");
  const day = String(d.getUTCDate()).padStart(2, "0");
  return `${y}${m}${day}`;
}

export function mapEspnScoreboard(
  sclSport: string,
  payload: { events?: EspnEvent[] },
): SettledGame[] {
  const out: SettledGame[] = [];
  for (const event of payload.events ?? []) {
    const comp = event.competitions?.[0];
    const completed =
      comp?.status?.type?.completed === true ||
      event.status?.type?.completed === true ||
      comp?.status?.type?.name === "STATUS_FINAL" ||
      event.status?.type?.name === "STATUS_FINAL";
    if (!completed) continue;

    const teams = comp?.competitors ?? [];
    const home = teams.find((t) => t.homeAway === "home");
    const away = teams.find((t) => t.homeAway === "away");
    const homeName = home?.team?.displayName ?? home?.team?.name;
    const awayName = away?.team?.displayName ?? away?.team?.name;
    if (!homeName || !awayName) continue;

    const homeScore = Number(home?.score);
    const awayScore = Number(away?.score);
    if (!Number.isFinite(homeScore) || !Number.isFinite(awayScore)) continue;

    out.push({
      sport: sclSport,
      home: canonicalizeEspnTeamName(homeName),
      away: canonicalizeEspnTeamName(awayName),
      homeScore,
      awayScore,
      completed: true,
      eventId: event.id ? `espn:${event.id}` : undefined,
    });
  }
  return out;
}
