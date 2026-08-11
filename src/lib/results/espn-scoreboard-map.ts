import type { SettledGame } from "@/lib/results/settled-game";

type EspnCompetitor = {
  homeAway?: string;
  score?: string | number;
  linescores?: { value?: string | number; displayValue?: string | number }[];
  team?: { displayName?: string; name?: string; shortDisplayName?: string };
};

function periodValues(
  competitor: EspnCompetitor | undefined,
): number[] | undefined {
  if (!competitor?.linescores?.length) return undefined;
  const values: number[] = [];
  for (const line of competitor.linescores) {
    const raw = line.value ?? line.displayValue;
    if (raw == null || String(raw).trim() === "") break;
    const value = Number(raw);
    if (!Number.isFinite(value)) break;
    values.push(value);
  }
  return values.length > 0 ? values : undefined;
}

type EspnEvent = {
  id?: string;
  /** ISO scheduled start. Date-scopes the name-matching fallback. */
  date?: string;
  competitions?: Array<{
    competitors?: EspnCompetitor[];
    date?: string;
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

    const rawDate = event.date ?? comp?.date;
    const startsAt = rawDate ? new Date(rawDate) : undefined;

    out.push({
      sport: sclSport,
      home: canonicalizeEspnTeamName(homeName),
      away: canonicalizeEspnTeamName(awayName),
      homeScore,
      awayScore,
      completed: true,
      eventId: event.id ? `espn:${event.id}` : undefined,
      // The bare id box-score grading needs, kept where the merge can carry it
      // onto the Odds API copy of the same fixture.
      espnEventId: event.id ? String(event.id) : undefined,
      startsAt:
        startsAt && !Number.isNaN(startsAt.getTime()) ? startsAt : undefined,
      homePeriods: periodValues(home),
      awayPeriods: periodValues(away),
    });
  }
  return out;
}
