import type { BoxScore } from "@/lib/results/prop-resolve";
import {
  normalizeName,
  type AbsentPlayerStatus,
  type PlayerBoxScore,
  type PlayerStatLine,
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
      `https://site.web.api.espn.com/apis/site/v2/sports/${path}/summary?event=${encodeURIComponent(eventId)}`,
      {
        cache: "no-store",
        headers: { accept: "application/json" },
        signal: AbortSignal.timeout(10_000),
      },
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
      `https://site.web.api.espn.com/apis/site/v2/sports/${path}/summary?event=${encodeURIComponent(eventId)}`,
      {
        cache: "no-store",
        headers: { accept: "application/json" },
        signal: AbortSignal.timeout(10_000),
      },
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
  // Football splits its box score the way baseball does, and for the same
  // reason: "YDS" is the passer's, the runner's and the receiver's number in
  // three different groups, so it can only ever be read from a named one.
  passing: {
    YDS: "passingYards",
    // The passer's own TD column. Named apart from the receiver's because the
    // same touchdown appears on both lines and they are different markets.
    TD: "passingTds",
  },
  rushing: {
    YDS: "rushingYards",
    CAR: "rushAttempts",
    TD: "rushingTds",
  },
  receiving: {
    REC: "receptions",
    YDS: "receivingYards",
    TD: "receivingTds",
  },
  defensive: { TD: "defensiveTds" },
  interceptions: { TD: "interceptionReturnTds" },
  kickreturns: { TD: "kickReturnTds" },
  puntreturns: { TD: "puntReturnTds" },
  // "FG" is read below as made-of-attempts; "PTS" here is the kicker's scoring
  // and must not reach the basketball map, which would file it as a points
  // line for a player who never took a shot.
  kicking: {},
  // Fumbles labels its recoveries "REC". Falling through to the default map
  // would overwrite a receiver's catches with the number of fumbles he fell on.
  fumbles: {},
  // Basketball and hockey report one unnamed group.
  default: {
    PTS: "points",
    REB: "rebounds",
    AST: "assists",
    STL: "steals",
    BLK: "blocks",
    TO: "turnovers",
    SOG: "shotsOnGoal",
  },
};

/**
 * The group's own name, whatever ESPN calls the field.
 *
 * Baseball writes `type` ("batting"/"pitching"); football writes `name`
 * ("passing"/"rushing"/"receiving") and no `type` at all; basketball writes
 * neither. Reading only `type` sent every football group to the default map —
 * which is how a receiver's catches were being read out of the fumbles line.
 */
function statGroupKey(group: EspnStatGroup): string {
  return (group.type ?? group.name ?? "").trim().toLowerCase();
}

type EspnAthleteRow = {
  athlete?: { displayName?: string; id?: string | number };
  stats?: (string | number | null)[];
};
type EspnStatGroup = {
  type?: string;
  /** Football's group label; baseball uses `type` and basketball neither. */
  name?: string;
  labels?: string[];
  athletes?: EspnAthleteRow[];
};
type EspnPlayerTeam = {
  team?: { displayName?: string; abbreviation?: string; id?: string | number };
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

/** "2-5" or "2/5" (made of attempted) → 2. */
function madeOfAttempts(value: string): number | null {
  const m = /^(\d+)[-/](\d+)$/.exec(value.trim());
  return m ? Number(m[1]) : null;
}

/** "18/24" (completions of attempts) → 24. */
function attemptsOfMade(value: string): number | null {
  const m = /^(\d+)[-/](\d+)$/.exec(value.trim());
  return m ? Number(m[2]) : null;
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
      const groupKey = statGroupKey(group);
      const map = STATS_BY_GROUP[groupKey] ?? STATS_BY_GROUP.default;

      for (const row of group.athletes ?? []) {
        const name = row.athlete?.displayName;
        if (!name) continue;
        const raw = row.stats ?? [];
        // ESPN lists inactive players with an empty stat array — that is the
        // DNP signal, and the only thing that distinguishes it from a zero.
        const played = raw.some((v) => v != null && String(v).trim() !== "");

        const entry: PlayerStatLine = byName.get(name) ?? {
          name,
          team: teamName,
          played: false,
          stats: {},
          ...(row.athlete?.id != null
            ? { espnId: String(row.athlete.id) }
            : {}),
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
          // Football writes two numbers in one column. "C/ATT" is completions
          // over attempts and the market is on attempts, the second; "FG" is
          // made over attempted and the market is on made, the first.
          if (label === "C/ATT" && groupKey === "passing") {
            const attempts = attemptsOfMade(text);
            if (attempts != null) entry.stats.passAttempts = attempts;
            return;
          }
          if (label === "FG" && groupKey === "kicking") {
            const made = madeOfAttempts(text);
            if (made != null) entry.stats.fieldGoalsMade = made;
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
    // Anytime TD is a yes/no market and excludes a quarterback merely
    // throwing the score. ESPN can list the same return touchdown in both a
    // defensive group and its specific return group, so use the maximum rather
    // than summing categories; all the resolver needs is zero versus non-zero.
    const nonPassingTouchdowns = [
      stats.rushingTds,
      stats.receivingTds,
      stats.defensiveTds,
      stats.interceptionReturnTds,
      stats.kickReturnTds,
      stats.puntReturnTds,
    ].filter((value): value is number => typeof value === "number");
    if (nonPassingTouchdowns.length > 0) {
      stats.touchdownsScored = Math.max(...nonPassingTouchdowns);
    }
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

  if (byName.size === 0) return null;
  const espnTeamIds = teams
    .map((team) => team.team?.id)
    .filter((id): id is string | number => id != null)
    .map(String);
  return {
    players: [...byName.values()],
    ...(espnTeamIds.length === 2 ? { espnTeamIds } : {}),
  };
}

type EspnRosterEntry = {
  playerId?: number | string;
  didNotPlay?: boolean;
  /** The core roster writes the SURNAME here ("Dawkins"), not the full name. */
  displayName?: string;
  athlete?: { $ref?: string };
};

/**
 * Game-day status of a player absent from the NFL box score, or null to defer.
 *
 * Reads ESPN's per-game roster (sports.core.api), whose `didNotPlay` marks
 * inactives AND dressed players who never entered - measured 2026-09-27: LAC's
 * two backup QBs were flagged, while linemen and a receiver with no catch were
 * not. The roster names only the surname, so each surname candidate's athlete
 * record is fetched and the FULL name must match exactly one of them. A player
 * the box score does list is never considered here - that would turn a name
 * spelling mismatch into a zero stat line.
 */
export async function fetchNflParticipation(
  eventId: string,
  box: PlayerBoxScore,
  playerName: string,
  fetchImpl: typeof fetch = fetch,
): Promise<AbsentPlayerStatus | null> {
  const teamIds = box.espnTeamIds;
  if (!teamIds || teamIds.length !== 2) return null;
  const target = normalizeName(playerName);
  const surname = target.split(" ").slice(-1)[0];
  if (!surname) return null;
  const inBox = new Set(
    box.players.map((p) => p.espnId).filter((id): id is string => !!id),
  );
  const getJson = async (url: string): Promise<unknown> => {
    const res = await fetchImpl(url, {
      cache: "no-store",
      headers: { accept: "application/json" },
      signal: AbortSignal.timeout(10_000),
    });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    return res.json();
  };

  try {
    const event = encodeURIComponent(eventId);
    const rosters = (await Promise.all(
      teamIds.map((teamId) =>
        getJson(
          `https://sports.core.api.espn.com/v2/sports/football/leagues/nfl/events/${event}/competitions/${event}/competitors/${encodeURIComponent(teamId)}/roster?limit=200`,
        ),
      ),
    )) as { entries?: EspnRosterEntry[] }[];
    // Both clubs' rosters must be readable, or "not found" means nothing.
    if (rosters.some((r) => !Array.isArray(r.entries) || !r.entries.length)) {
      return null;
    }
    const candidates = rosters
      .flatMap((r) => r.entries ?? [])
      .filter(
        (entry) =>
          entry.playerId != null &&
          !inBox.has(String(entry.playerId)) &&
          normalizeName(entry.displayName ?? "")
            .split(" ")
            .slice(-1)[0] === surname &&
          Boolean(entry.athlete?.$ref),
      );
    const named = await Promise.all(
      candidates.map(async (entry) => {
        const ref = entry.athlete!.$ref!.replace(/^http:/, "https:");
        const athlete = (await getJson(ref)) as { fullName?: string };
        return { entry, fullName: normalizeName(athlete.fullName ?? "") };
      }),
    );
    const matches = named.filter((n) => n.fullName === target);
    if (matches.length !== 1) return null;
    const flag = matches[0]!.entry.didNotPlay;
    if (flag === true) return "did_not_play";
    if (flag === false) return "played_no_stats";
    return null;
  } catch {
    return null;
  }
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
