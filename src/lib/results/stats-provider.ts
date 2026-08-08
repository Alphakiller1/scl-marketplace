import type { BoxScore } from "@/lib/results/prop-resolve";
import type {
  PlayerBoxScore,
  PlayerStatLine,
} from "@/lib/results/player-props";

/**
 * Fetches per-period line-scores from ESPN's public event-summary endpoint —
 * the same free ESPN family already used for scoreboards. Used to auto-grade
 * First-Five / first-N-innings totals (MLB), which the game-final providers
 * can't settle. Returns null on any error or missing data so the caller defers
 * (never settles on incomplete data). See docs/GRADING_PROPS_STATS_FEED_SPEC.md.
 */

/**
 * SCL sport → ESPN summary path.
 *
 * Line-scores are only mapped for baseball today, but player props exist across
 * the board, so every sport SCL grades is listed here.
 */
const ESPN_SUMMARY_PATH: Record<string, string> = {
  MLB: "baseball/mlb",
  WNBA: "basketball/wnba",
  NBA: "basketball/nba",
  NCAAB: "basketball/mens-college-basketball",
  NFL: "football/nfl",
  NCAAF: "football/college-football",
  CFL: "football/cfl",
  NHL: "hockey/nhl",
};

type EspnCompetitor = {
  homeAway?: string;
  /**
   * The SUMMARY endpoint writes each period as `displayValue` and carries no
   * `value` at all (`{ displayValue: "4", hits: 4, errors: 0 }`), unlike the
   * scoreboard endpoint. Reading only `value` produced NaN for every inning, so
   * the mapper returned null and no first-N-innings play could ever settle.
   */
  linescores?: { value?: number | string; displayValue?: number | string }[];
};

export async function fetchPeriodBoxScore(
  sport: string,
  eventId: string,
  fetchImpl: typeof fetch = fetch,
): Promise<BoxScore | null> {
  const path = ESPN_SUMMARY_PATH[sport.toUpperCase()];
  if (!path || !eventId) return null;

  try {
    const res = await fetchImpl(
      `https://site.api.espn.com/apis/site/v2/sports/${path}/summary?event=${encodeURIComponent(eventId)}`,
      { headers: { accept: "application/json" } },
    );
    if (!res.ok) return null;
    const data: unknown = await res.json();
    return mapSummaryToBoxScore(data);
  } catch {
    return null;
  }
}

/** Fetch one event's player stat lines. Null on any error, so the caller defers. */
export async function fetchPlayerBoxScore(
  sport: string,
  eventId: string,
  fetchImpl: typeof fetch = fetch,
): Promise<PlayerBoxScore | null> {
  const path = ESPN_SUMMARY_PATH[sport.toUpperCase()];
  if (!path || !eventId) return null;

  try {
    const res = await fetchImpl(
      `https://site.api.espn.com/apis/site/v2/sports/${path}/summary?event=${encodeURIComponent(eventId)}`,
      { headers: { accept: "application/json" } },
    );
    if (!res.ok) return null;
    const data: unknown = await res.json();
    return mapSummaryToPlayerBox(data);
  } catch {
    return null;
  }
}

/**
 * Canonical stat keys per ESPN stat group.
 *
 * Grouping matters: baseball's batting and pitching lines both carry "H" and
 * "K" meaning opposite things, so a pitcher's strikeouts must only ever be read
 * from the pitching group. Keys here are the ones `player-props.ts` looks up.
 */
const STATS_BY_GROUP: Record<string, Record<string, string>> = {
  pitching: { K: "strikeouts", ER: "earnedRuns" },
  batting: { H: "hits", HR: "homeRuns", RBI: "rbis" },
  // Basketball/football/hockey report one group; ESPN names it per sport.
  default: {
    PTS: "points",
    REB: "rebounds",
    AST: "assists",
    SOG: "shotsOnGoal",
    REC: "receptions",
  },
};

type EspnAthleteRow = {
  athlete?: { displayName?: string };
  stats?: (string | number | null)[];
};
type EspnStatGroup = {
  type?: string;
  labels?: string[];
  athletes?: EspnAthleteRow[];
};
type EspnPlayerTeam = {
  team?: { displayName?: string; abbreviation?: string };
  statistics?: EspnStatGroup[];
};

/** "5.2" innings pitched → 17 outs. ESPN writes thirds after the decimal. */
export function inningsToOuts(ip: string): number | null {
  const m = /^(\d+)(?:\.(\d))?$/.exec(ip.trim());
  if (!m) return null;
  const thirds = Number(m[2] ?? 0);
  if (thirds > 2) return null;
  return Number(m[1]) * 3 + thirds;
}

/** "2-5" (made-attempted) → 2. */
function madeOfAttempts(value: string): number | null {
  const m = /^(\d+)-(\d+)$/.exec(value.trim());
  return m ? Number(m[1]) : null;
}

/** Pure mapper (unit-testable) — ESPN summary JSON → player stat lines. */
export function mapSummaryToPlayerBox(data: unknown): PlayerBoxScore | null {
  const teams = (data as { boxscore?: { players?: EspnPlayerTeam[] } })
    ?.boxscore?.players;
  if (!Array.isArray(teams) || teams.length === 0) return null;

  const byName = new Map<string, PlayerStatLine>();

  for (const team of teams) {
    const teamName =
      team.team?.displayName ?? team.team?.abbreviation ?? "unknown";
    for (const group of team.statistics ?? []) {
      const labels = group.labels ?? [];
      const map = STATS_BY_GROUP[group.type ?? ""] ?? STATS_BY_GROUP.default;

      for (const row of group.athletes ?? []) {
        const name = row.athlete?.displayName;
        if (!name) continue;
        const raw = row.stats ?? [];
        // ESPN lists inactive players with an empty stat array — that is the
        // DNP signal, and the only thing that distinguishes it from a zero.
        const played = raw.some((v) => v != null && String(v).trim() !== "");

        const entry = byName.get(name) ?? {
          name,
          team: teamName,
          played: false,
          stats: {},
        };
        entry.played = entry.played || played;

        labels.forEach((label, i) => {
          const value = raw[i];
          if (value == null) return;
          const text = String(value).trim();
          if (text === "" || text === "--") return;

          if (label === "IP" && group.type === "pitching") {
            const outs = inningsToOuts(text);
            if (outs != null) entry.stats.outs = outs;
            return;
          }
          if (label === "3PT") {
            const made = madeOfAttempts(text);
            if (made != null) entry.stats.threes = made;
            return;
          }
          const key = map[label];
          if (!key) return;
          const n = Number(text);
          if (Number.isFinite(n)) entry.stats[key] = n;
        });

        byName.set(name, entry);
      }
    }
  }

  return byName.size > 0 ? { players: [...byName.values()] } : null;
}

/** Pure mapper (unit-testable) — ESPN summary JSON → per-period line-scores. */
export function mapSummaryToBoxScore(data: unknown): BoxScore | null {
  const competitors = (
    data as {
      header?: { competitions?: { competitors?: EspnCompetitor[] }[] };
    }
  )?.header?.competitions?.[0]?.competitors;
  if (!Array.isArray(competitors) || competitors.length < 2) return null;

  const home = competitors.find((c) => c.homeAway === "home");
  const away = competitors.find((c) => c.homeAway === "away");
  if (!home || !away) return null;

  const periods = (c: EspnCompetitor): number[] | null => {
    const ls = c.linescores;
    if (!Array.isArray(ls) || ls.length === 0) return null;

    // Keep the readable PREFIX rather than demanding every period parse. A home
    // team that never batted in the 9th shows "X", and an unplayed period shows
    // "-"; discarding the whole line for that would throw away the first
    // innings a period market is actually settled from. `periodScores` refuses
    // anything the prefix does not cover, so a short line still defers.
    const out: number[] = [];
    for (const entry of ls) {
      const raw = entry?.value ?? entry?.displayValue;
      if (raw == null || String(raw).trim() === "") break;
      const n = Number(raw);
      if (!Number.isFinite(n)) break;
      out.push(n);
    }
    return out.length > 0 ? out : null;
  };

  const homePeriods = periods(home);
  const awayPeriods = periods(away);
  if (!homePeriods || !awayPeriods) return null;

  return { homePeriods, awayPeriods };
}
