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

type MlbBoxPlayer = {
  person?: { fullName?: string };
  stats?: {
    batting?: {
      gamesPlayed?: number;
      hits?: number;
      doubles?: number;
      triples?: number;
      homeRuns?: number;
      rbi?: number;
      runs?: number;
      totalBases?: number;
    };
    pitching?: {
      gamesPlayed?: number;
      strikeOuts?: number;
      outs?: number;
      earnedRuns?: number;
      /** Hits surrendered. Same field name as batting's, opposite meaning. */
      hits?: number;
    };
  };
};

type MlbBoxTeam = {
  team?: { name?: string };
  players?: Record<string, MlbBoxPlayer>;
};

/** Pure mapper for MLB's official game box score. */
export function mapMlbOfficialPlayerBox(data: unknown): PlayerBoxScore | null {
  const teams = (data as { teams?: { home?: MlbBoxTeam; away?: MlbBoxTeam } })
    ?.teams;
  const rows: PlayerStatLine[] = [];
  for (const team of [teams?.home, teams?.away]) {
    const teamName = team?.team?.name ?? "unknown";
    for (const player of Object.values(team?.players ?? {})) {
      const name = player.person?.fullName;
      if (!name) continue;
      const batting = player.stats?.batting;
      const pitching = player.stats?.pitching;
      const stats: Record<string, number> = {};
      if (typeof batting?.hits === "number") stats.hits = batting.hits;
      if (typeof batting?.homeRuns === "number") {
        stats.homeRuns = batting.homeRuns;
      }
      if (typeof batting?.rbi === "number") stats.rbis = batting.rbi;
      if (typeof batting?.runs === "number") stats.runs = batting.runs;
      if (typeof batting?.totalBases === "number") {
        stats.totalBases = batting.totalBases;
      } else if (
        typeof batting?.hits === "number" &&
        typeof batting?.doubles === "number" &&
        typeof batting?.triples === "number" &&
        typeof batting?.homeRuns === "number"
      ) {
        // 1B + 2×2B + 3×3B + 4×HR, simplified using H.
        stats.totalBases =
          batting.hits +
          batting.doubles +
          2 * batting.triples +
          3 * batting.homeRuns;
      }
      if (typeof pitching?.strikeOuts === "number") {
        stats.strikeouts = pitching.strikeOuts;
      }
      if (typeof pitching?.outs === "number") stats.outs = pitching.outs;
      if (typeof pitching?.earnedRuns === "number") {
        stats.earnedRuns = pitching.earnedRuns;
      }
      // Kept under a separate key from batting's `hits` above — a two-way player
      // has both, and collapsing them would settle one market on the other.
      if (typeof pitching?.hits === "number") {
        stats.hitsAllowed = pitching.hits;
      }
      rows.push({
        name,
        team: teamName,
        played:
          (batting?.gamesPlayed ?? 0) > 0 || (pitching?.gamesPlayed ?? 0) > 0,
        stats,
      });
    }
  }
  return rows.length ? { players: rows } : null;
}

/** Independent MLB Plan C for player-prop settlement. */
export async function fetchMlbOfficialPlayerBoxScore(
  gamePk: string,
  fetchImpl: typeof fetch = fetch,
): Promise<PlayerBoxScore | null> {
  if (!/^\d+$/.test(gamePk)) return null;
  try {
    const response = await fetchImpl(
      `https://statsapi.mlb.com/api/v1/game/${encodeURIComponent(gamePk)}/boxscore`,
      { cache: "no-store", headers: { Accept: "application/json" } },
    );
    if (!response.ok) return null;
    return mapMlbOfficialPlayerBox(await response.json());
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
  pitching: {
    K: "strikeouts",
    ER: "earnedRuns",
    H: "hitsAllowed",
    // The pitcher's own walk line. Under its own key for the same reason "H"
    // is: "BB" appears in BOTH groups meaning opposite things, and a hitter
    // graded on the walks his pitcher issued is a wrong number, confidently
    // written.
    BB: "walksAllowed",
  },
  batting: {
    H: "hits",
    "2B": "doubles",
    "3B": "triples",
    HR: "homeRuns",
    RBI: "rbis",
    R: "runs",
    SB: "stolenBases",
    TB: "totalBases",
    BB: "walks",
    K: "batterStrikeouts",
  },
  passing: {
    YDS: "passingYards",
  },
  rushing: {
    YDS: "rushingYards",
  },
  receiving: {
    REC: "receptions",
    YDS: "receivingYards",
  },
  // Basketball/football/hockey report one group; ESPN names it per sport.
  default: {
    PTS: "points",
    REB: "rebounds",
    AST: "assists",
    STL: "steals",
    BLK: "blocks",
    TO: "turnovers",
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

  for (const entry of byName.values()) {
    const { stats } = entry;
    if (
      stats.totalBases == null &&
      stats.hits != null &&
      stats.doubles != null &&
      stats.triples != null &&
      stats.homeRuns != null
    ) {
      stats.totalBases =
        stats.hits + stats.doubles + 2 * stats.triples + 3 * stats.homeRuns;
    }
    // A single has no column in any box score — it is what is left of the hits
    // once the extra-base hits are taken out. Derived here rather than in
    // DERIVED_STATS because that helper only sums, and every component is
    // required: a missing doubles column would otherwise report every hit as a
    // single and settle a losing "2+ singles" ticket as a win.
    if (
      stats.singles == null &&
      stats.hits != null &&
      stats.doubles != null &&
      stats.triples != null &&
      stats.homeRuns != null
    ) {
      const singles =
        stats.hits - stats.doubles - stats.triples - stats.homeRuns;
      if (singles >= 0) stats.singles = singles;
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
