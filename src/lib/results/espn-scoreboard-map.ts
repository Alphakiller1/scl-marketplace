import type { SettledGame } from "@/lib/results/settled-game";

type EspnCompetitor = {
  homeAway?: string;
  score?: string | number;
  winner?: boolean;
  order?: number;
  linescores?: { value?: string | number; displayValue?: string | number }[];
  team?: { displayName?: string; name?: string; shortDisplayName?: string };
  athlete?: { displayName?: string; fullName?: string; shortName?: string };
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
    id?: string;
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

function competitorName(
  competitor: EspnCompetitor | undefined,
): string | undefined {
  const raw =
    competitor?.team?.displayName ??
    competitor?.team?.name ??
    competitor?.athlete?.displayName ??
    competitor?.athlete?.fullName ??
    competitor?.athlete?.shortName;
  const name = raw?.trim();
  return name ? name : undefined;
}

function competitorScore(
  competitor: EspnCompetitor | undefined,
): number | null {
  if (!competitor) return null;
  if (competitor.score != null && String(competitor.score).trim() !== "") {
    const scored = Number(competitor.score);
    if (Number.isFinite(scored)) return scored;
  }
  if (competitor.winner === true) return 1;
  if (competitor.winner === false) return 0;
  return null;
}

function pickHomeAway(teams: EspnCompetitor[]): {
  home?: EspnCompetitor;
  away?: EspnCompetitor;
} {
  const home = teams.find((team) => team.homeAway === "home");
  const away = teams.find((team) => team.homeAway === "away");
  if (home && away && home !== away) return { home, away };

  const byOrderHome = teams.find((team) => team.order === 2);
  const byOrderAway = teams.find((team) => team.order === 1);
  if (byOrderHome && byOrderAway && byOrderHome !== byOrderAway) {
    return { home: byOrderHome, away: byOrderAway };
  }

  if (teams.length >= 2) return { home: teams[1], away: teams[0] };
  return {};
}

function competitionCompleted(
  event: EspnEvent,
  comp: NonNullable<EspnEvent["competitions"]>[number] | undefined,
): boolean {
  if (
    comp?.status?.type?.completed === true ||
    comp?.status?.type?.name === "STATUS_FINAL"
  ) {
    return true;
  }
  // MLB/NBA scoreboards often stamp FINAL only on the event. MMA cards stamp
  // it per fight — never inherit the card-level flag onto a live bout.
  if (comp?.status != null) return false;
  return (
    event.status?.type?.completed === true ||
    event.status?.type?.name === "STATUS_FINAL"
  );
}

export function mapEspnScoreboard(
  sclSport: string,
  payload: { events?: EspnEvent[] },
): SettledGame[] {
  const out: SettledGame[] = [];
  for (const event of payload.events ?? []) {
    const competitions =
      event.competitions && event.competitions.length > 0
        ? event.competitions
        : [undefined];
    for (const comp of competitions) {
      if (!competitionCompleted(event, comp)) continue;

      const teams = comp?.competitors ?? [];
      const { home, away } = pickHomeAway(teams);
      const homeName = competitorName(home);
      const awayName = competitorName(away);
      if (!homeName || !awayName) continue;

      // A no-contest / no winner is 0-0 from the winner flags. That would PUSH
      // every moneyline. Skip rather than invent a result.
      const decided =
        home?.winner === true ||
        away?.winner === true ||
        (home?.score != null && String(home.score).trim() !== "") ||
        (away?.score != null && String(away.score).trim() !== "");
      const homeScore = competitorScore(home);
      const awayScore = competitorScore(away);
      if (!decided || homeScore == null || awayScore == null) continue;

      const providerId = comp?.id ?? event.id;
      const rawDate = comp?.date ?? event.date;
      const startsAt = rawDate ? new Date(rawDate) : undefined;

      out.push({
        sport: sclSport,
        home: canonicalizeEspnTeamName(homeName),
        away: canonicalizeEspnTeamName(awayName),
        homeScore,
        awayScore,
        completed: true,
        eventId: providerId ? `espn:${providerId}` : undefined,
        // The bare id box-score grading needs, kept where the merge can carry it
        // onto the Odds API copy of the same fixture.
        espnEventId: providerId ? String(providerId) : undefined,
        startsAt:
          startsAt && !Number.isNaN(startsAt.getTime()) ? startsAt : undefined,
        homePeriods: periodValues(home),
        awayPeriods: periodValues(away),
      });
    }
  }
  return out;
}
