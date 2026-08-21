import "server-only";

import { SPORT_KEYS } from "@/lib/constants";
import {
  logOddsUsage,
  oddsApiKey,
  resolveOddsApiSport,
  toOddsApiSport,
  toSclSport,
} from "@/lib/odds-api";
import { espnHistoricalResultsProvider } from "@/lib/results/espn-scores";
import { cflCaResultsProvider } from "@/lib/results/cfl-ca-scores";
import { mlbOfficialResultsProvider } from "@/lib/results/mlb-official";
import { sportsPuffResultsProvider } from "@/lib/results/sportspuff-scores";
import { wnbaOfficialResultsProvider } from "@/lib/results/wnba-official";
import {
  fetchWithOddsKeyRollover,
  isProviderRefusal,
} from "@/lib/odds-key-rollover";
import { RESULTS_LOOKBACK_DAYS } from "@/lib/results/lookback";
import {
  mergeSettledGames,
  type SettledGame,
} from "@/lib/results/settled-game";

export type { SettledGame };
export { mergeSettledGames };
export { RESULTS_LOOKBACK_DAYS };

/** League context needed when one SCL sport fans out across provider leagues. */
export type ResultsQueryScope = {
  soccerLeagues?: readonly string[];
  /**
   * Tennis tour keys (ATP_CINCINNATI_OPEN, …) carried by the pending plays.
   *
   * Tennis has no single sport key — one per tournament, same as soccer — so
   * without the tour tags there is nothing to ask the scores endpoint for.
   * Omitting this is why every tennis pick ever logged went ungraded: the
   * grader fell through to `toOddsApiSport("TENNIS")`, which is undefined, and
   * silently requested nothing.
   */
  tennisTours?: readonly string[];
};

/**
 * Results providers feed the auto-grader. A provider returns completed games with
 * final scores; the auto-grader ("results are in") turns those into play outcomes.
 *
 * `MockResultsProvider` supplies demo settlements so the whole flow runs with no
 * external dependency. `oddsApiResultsProvider` is the real feed (The Odds API
 * scores endpoint) and activates automatically once `ODDS_API_KEY` is set —
 * `getResultsProvider()` picks it over the mock when the key is present.
 */

export interface ResultsProvider {
  readonly name: string;
  fetchSettled(): Promise<SettledGame[]>;
  fetchSettledForSports(
    sports: string[],
    scope?: ResultsQueryScope,
  ): Promise<SettledGame[]>;
}

export class ResultsProviderUnavailable extends Error {}

/** Deterministic demo results so auto-grading is fully exercisable without a key. */
export class MockResultsProvider implements ResultsProvider {
  readonly name = "mock";
  constructor(private readonly games: SettledGame[] = DEMO_GAMES) {}

  async fetchSettled(): Promise<SettledGame[]> {
    return this.games.filter((g) => g.completed);
  }

  async fetchSettledForSports(sports: string[]): Promise<SettledGame[]> {
    const wanted = new Set(sports);
    return this.games.filter((g) => g.completed && wanted.has(g.sport));
  }
}

// SCL sport keys (NBA/MLB/…) so demo results match real plays.
const DEMO_GAMES: SettledGame[] = [
  {
    sport: "NBA",
    home: "Boston Celtics",
    away: "Los Angeles Lakers",
    homeScore: 118,
    awayScore: 104,
    completed: true,
    eventId: "evt-nba-celtics-lakers",
  },
  {
    sport: "NBA",
    home: "Denver Nuggets",
    away: "Miami Heat",
    homeScore: 99,
    awayScore: 111,
    completed: true,
  },
  {
    sport: "MLB",
    home: "New York Yankees",
    away: "Boston Red Sox",
    homeScore: 3,
    awayScore: 7,
    completed: true,
  },
  {
    sport: "NFL",
    home: "Kansas City Chiefs",
    away: "Buffalo Bills",
    homeScore: 24,
    awayScore: 27,
    completed: true,
  },
];

function mapOddsApiScores(
  events: OddsApiScore[],
  fallbackSport?: string,
): SettledGame[] {
  return events
    .filter(
      (e) =>
        e.completed &&
        Array.isArray(e.scores) &&
        e.scores.length === 2 &&
        (toSclSport(e.sport_key) ?? fallbackSport) != null,
    )
    .map((e) => {
      const home = e.scores!.find((s) => s.name === e.home_team);
      const away = e.scores!.find((s) => s.name === e.away_team);
      const startsAt = e.commence_time ? new Date(e.commence_time) : undefined;
      return {
        sport: toSclSport(e.sport_key) ?? fallbackSport!,
        home: e.home_team,
        away: e.away_team,
        homeScore: Number(home?.score ?? 0),
        awayScore: Number(away?.score ?? 0),
        completed: true,
        eventId: e.id,
        startsAt:
          startsAt && !Number.isNaN(startsAt.getTime()) ? startsAt : undefined,
      };
    });
}

/** Real feed: The Odds API per-sport scores endpoint. */
export function oddsApiResultsProvider(): ResultsProvider {
  const apiKey = oddsApiKey();
  if (!apiKey) {
    throw new ResultsProviderUnavailable("ODDS_API_KEY is not configured");
  }

  const fetchSportScores = async (
    sclSport: string,
    league?: string,
  ): Promise<SettledGame[]> => {
    const apiSport = resolveOddsApiSport(sclSport, league);
    if (!apiSport) return [];

    try {
      const { response: res } = await fetchWithOddsKeyRollover(
        (key) =>
          `https://api.the-odds-api.com/v4/sports/${apiSport}/scores/` +
          `?daysFrom=${RESULTS_LOOKBACK_DAYS}&apiKey=${key}`,
        { cache: "no-store" },
      );
      // No response at all means rollover exhausted the key list without one
      // being accepted.
      if (!res) {
        throw new ResultsProviderUnavailable(
          `No Odds API key could fetch ${sclSport} scores — every configured ` +
            `key was refused. Grading cannot proceed.`,
        );
      }
      logOddsUsage(res, `scores ${sclSport}`, "results");
      if (!res.ok) {
        // An account-level refusal will hit every remaining sport identically,
        // and returning [] for each one is what made a spent key read as
        // "nothing finished today" — plays sat ungraded for days with no
        // failure anywhere. Throw instead: the cron records it on GradeJobRun
        // and the run shows FAILED in /admin/grading.
        if (isProviderRefusal(res.status)) {
          throw new ResultsProviderUnavailable(
            `The Odds API refused every configured key (HTTP ${res.status}) ` +
              `fetching ${sclSport} scores. Quota is spent or the keys are ` +
              `invalid — no play can be graded until this is resolved.`,
          );
        }
        // Anything else belongs to this sport alone (a 404 for a league that is
        // out of season, a transient 5xx). Skip it; grade the rest of the slate.
        console.error(
          `[results] scores fetch ${sclSport} failed: HTTP ${res.status}`,
        );
        return [];
      }
      const events = (await res.json()) as OddsApiScore[];
      // Fall back to the SCL sport we asked for. Per-tournament keys
      // (soccer_epl, tennis_atp_cincinnati_open) have no reverse mapping, so a
      // named fallback is the only way their events survive the filter.
      // `toSclSport` still wins where it resolves, so single-key sports are
      // unaffected.
      return mapOddsApiScores(events, sclSport);
    } catch (err) {
      // A refused account is deliberate control flow, not a fetch failure —
      // swallowing it here would restore the exact silence this guards against.
      if (err instanceof ResultsProviderUnavailable) throw err;
      console.error(`[results] scores fetch ${sclSport} error:`, err);
      return [];
    }
  };

  return {
    name: "the-odds-api",
    async fetchSettled(): Promise<SettledGame[]> {
      const sports = SPORT_KEYS.filter((s) => toOddsApiSport(s));
      return this.fetchSettledForSports(sports);
    },
    async fetchSettledForSports(
      sports: string[],
      scope?: ResultsQueryScope,
    ): Promise<SettledGame[]> {
      const distinct = [...new Set(sports)];
      const soccerLeagues = [
        ...new Set(scope?.soccerLeagues?.filter(Boolean) ?? []),
      ];
      const tennisTours = [
        ...new Set(scope?.tennisTours?.filter(Boolean) ?? []),
      ];
      const requests = distinct.flatMap((sport) => {
        if (sport === "SOCCER") {
          return soccerLeagues.map((league) =>
            fetchSportScores("SOCCER", league),
          );
        }
        // Same shape as soccer, and for the same reason: one key per event.
        if (sport === "TENNIS") {
          return tennisTours.map((tour) => fetchSportScores("TENNIS", tour));
        }
        return toOddsApiSport(sport) ? [fetchSportScores(sport)] : [];
      });
      if (requests.length === 0) return [];

      const batches = await Promise.all(requests);
      return batches.flat();
    },
  };
}

type OddsApiScore = {
  id?: string;
  sport_key: string;
  completed: boolean;
  home_team: string;
  away_team: string;
  /** ISO kickoff/first-pitch. Date-scopes the name-matching fallback. */
  commence_time?: string;
  scores?: { name: string; score: string }[];
};

/**
 * Run both halves without letting one refused provider take the other down.
 *
 * The Odds API half throws `ResultsProviderUnavailable` when the account is
 * refused, but the ESPN and official-league backstops do not use that key and
 * can still settle plays. A plain `Promise.all` would reject the pair on the
 * first throw and strand results the backstops were ready to supply — trading
 * a silent failure for a total one. So a single refusal is logged loudly and
 * the surviving side is used; only losing BOTH sides is fatal.
 */
async function settleBothSides(
  primary: ResultsProvider,
  secondary: ResultsProvider,
  run: (provider: ResultsProvider) => Promise<SettledGame[]>,
): Promise<{ a: SettledGame[]; b: SettledGame[] }> {
  const [ra, rb] = await Promise.allSettled([run(primary), run(secondary)]);

  for (const [result, provider] of [
    [ra, primary],
    [rb, secondary],
  ] as const) {
    if (result.status === "rejected") {
      console.error(
        `[results] provider "${provider.name}" is UNAVAILABLE — its results ` +
          `are missing from this grading run:`,
        result.reason,
      );
    }
  }

  if (ra.status === "rejected" && rb.status === "rejected") {
    throw ra.reason;
  }

  return {
    a: ra.status === "fulfilled" ? ra.value : [],
    b: rb.status === "fulfilled" ? rb.value : [],
  };
}

/** Merge primary + secondary settled games; prefer primary eventId on collision. */
export function compositeResultsProvider(
  primary: ResultsProvider,
  secondary: ResultsProvider,
): ResultsProvider {
  return {
    name: `${primary.name}+${secondary.name}`,
    async fetchSettled() {
      const { a, b } = await settleBothSides(primary, secondary, (p) =>
        p.fetchSettled(),
      );
      return mergeSettledGames(a, b);
    },
    async fetchSettledForSports(sports: string[], scope?: ResultsQueryScope) {
      const { a, b } = await settleBothSides(primary, secondary, (p) =>
        p.fetchSettledForSports(sports, scope),
      );
      const merged = mergeSettledGames(a, b);
      console.info("[results] provider batch", {
        sports,
        primary: primary.name,
        primaryCount: a.length,
        secondary: secondary.name,
        secondaryCount: b.length,
        mergedCount: merged.length,
      });
      return merged;
    },
  };
}

/**
 * Sports whose free scoreboards cannot cover the whole board. Grading uses the
 * Odds API **scores** endpoint only — never pricing / expanded boards.
 *
 * ESPN maps UFC cards (14d) but not PFL/Bellator. Tennis has no ESPN path.
 * ESPN's CFL calendar is stale; Odds API covers 3 days and CFL.ca covers the
 * season. Dropping this layer (PR #550) left every UFC moneyline PENDING forever.
 */
export const ODDS_SCORES_ONLY_SPORTS = ["MMA", "TENNIS", "CFL"] as const;

/** Restrict a results provider to a fixed sport allowlist. */
export function scoresProviderForSports(
  inner: ResultsProvider,
  sports: readonly string[],
): ResultsProvider {
  const allowed = new Set(sports.map((sport) => sport.toUpperCase()));
  return {
    name: `${inner.name}:${[...allowed].join("+")}`,
    async fetchSettled() {
      return inner.fetchSettledForSports([...allowed]);
    },
    async fetchSettledForSports(
      requested: string[],
      scope?: ResultsQueryScope,
    ) {
      const filtered = requested.filter((sport) =>
        allowed.has(sport.toUpperCase()),
      );
      if (filtered.length === 0) return [];
      return inner.fetchSettledForSports(filtered, scope);
    },
  };
}

function independentScoreBackstops(): ResultsProvider {
  const espn = espnHistoricalResultsProvider();
  const officialPlanC = compositeResultsProvider(
    mlbOfficialResultsProvider(),
    wnbaOfficialResultsProvider(),
  );
  const planC = compositeResultsProvider(
    officialPlanC,
    sportsPuffResultsProvider(),
  );
  const withCfl = compositeResultsProvider(planC, cflCaResultsProvider());
  return compositeResultsProvider(espn, withCfl);
}

/**
 * ESPN + official league feeds for mainstream sports, plus Odds API scores for
 * MMA/TENNIS/CFL where no working free backstop exists.
 *
 * Grading must stay up when the odds board burns quota on **pricing** fetches.
 * Closing-line capture and CLV backfill run on `/api/cron/odds-refresh` instead.
 */
export function getGradingResultsProvider(): ResultsProvider {
  const backstops = independentScoreBackstops();
  try {
    if (oddsApiKey()) {
      return compositeResultsProvider(
        backstops,
        scoresProviderForSports(
          oddsApiResultsProvider(),
          ODDS_SCORES_ONLY_SPORTS,
        ),
      );
    }
  } catch {
    /* fall through to free backstops when no key is configured */
  }
  return backstops;
}

/**
 * Full Odds API scores (every pending sport, ≤3d) + ESPN/official backstops
 * (≤14d). Admin "Grade completed" uses this to force-settle completed events the
 * credit-saving cron stack may have missed. Cron stays on
 * {@link getGradingResultsProvider} so pricing-path credits are never spent.
 */
export function getResultsProvider(): ResultsProvider {
  const backstops = independentScoreBackstops();
  try {
    if (oddsApiKey()) {
      return compositeResultsProvider(oddsApiResultsProvider(), backstops);
    }
  } catch {
    /* fall through */
  }
  return backstops;
}
