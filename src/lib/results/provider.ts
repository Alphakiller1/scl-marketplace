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

    const url =
      `https://api.the-odds-api.com/v4/sports/${apiSport}/scores/` +
      `?daysFrom=${RESULTS_LOOKBACK_DAYS}&apiKey=${apiKey}`;
    try {
      const res = await fetch(url, { cache: "no-store" });
      logOddsUsage(res, `scores ${sclSport}`, "results");
      if (!res.ok) {
        console.error(
          `[results] scores fetch ${sclSport} failed: HTTP ${res.status}`,
        );
        return [];
      }
      const events = (await res.json()) as OddsApiScore[];
      return mapOddsApiScores(
        events,
        sclSport === "SOCCER" ? "SOCCER" : undefined,
      );
    } catch (err) {
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
      const requests = distinct.flatMap((sport) => {
        if (sport === "SOCCER") {
          return soccerLeagues.map((league) =>
            fetchSportScores("SOCCER", league),
          );
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

/** Merge primary + secondary settled games; prefer primary eventId on collision. */
export function compositeResultsProvider(
  primary: ResultsProvider,
  secondary: ResultsProvider,
): ResultsProvider {
  return {
    name: `${primary.name}+${secondary.name}`,
    async fetchSettled() {
      const [a, b] = await Promise.all([
        primary.fetchSettled(),
        secondary.fetchSettled(),
      ]);
      return mergeSettledGames(a, b);
    },
    async fetchSettledForSports(sports: string[], scope?: ResultsQueryScope) {
      const [a, b] = await Promise.all([
        primary.fetchSettledForSports(sports, scope),
        secondary.fetchSettledForSports(sports, scope),
      ]);
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
 * Odds API (≤3d) + ESPN scoreboard history (≤14d) so aged-out plays can still
 * settle without paid Odds API historical credits.
 */
export function getResultsProvider(): ResultsProvider {
  const espn = espnHistoricalResultsProvider();
  try {
    if (oddsApiKey()) {
      return compositeResultsProvider(oddsApiResultsProvider(), espn);
    }
  } catch {
    /* fall through */
  }
  return espn;
}
