import "server-only";

import { oddsApiKey, toSclSport } from "@/lib/odds-api";

/**
 * Results providers feed the auto-grader. A provider returns completed games with
 * final scores; the auto-grader ("results are in") turns those into play outcomes.
 *
 * `MockResultsProvider` supplies demo settlements so the whole flow runs with no
 * external dependency. `oddsApiResultsProvider` is the real feed (The Odds API
 * scores endpoint) and activates automatically once `ODDS_API_KEY` is set —
 * `getResultsProvider()` picks it over the mock when the key is present.
 */
export type SettledGame = {
  sport: string; // canonical sport key (see src/lib/constants.ts)
  home: string;
  away: string;
  homeScore: number;
  awayScore: number;
  completed: boolean;
};

export interface ResultsProvider {
  readonly name: string;
  fetchSettled(): Promise<SettledGame[]>;
}

export class ResultsProviderUnavailable extends Error {}

/** Deterministic demo results so auto-grading is fully exercisable without a key. */
export class MockResultsProvider implements ResultsProvider {
  readonly name = "mock";
  constructor(private readonly games: SettledGame[] = DEMO_GAMES) {}
  async fetchSettled(): Promise<SettledGame[]> {
    return this.games.filter((g) => g.completed);
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

/** Real feed: The Odds API scores endpoint. Throws until ODDS_API_KEY is configured. */
export function oddsApiResultsProvider(): ResultsProvider {
  const apiKey = oddsApiKey();
  if (!apiKey) {
    throw new ResultsProviderUnavailable("ODDS_API_KEY is not configured");
  }
  return {
    name: "the-odds-api",
    async fetchSettled(): Promise<SettledGame[]> {
      // The Odds API returns per-sport scores; callers should scope by sport in a
      // follow-up. Kept minimal here — the matcher only needs final team scores.
      const url = `https://api.the-odds-api.com/v4/sports/upcoming/scores?daysFrom=3&apiKey=${apiKey}`;
      const res = await fetch(url, { cache: "no-store" });
      if (!res.ok)
        throw new ResultsProviderUnavailable(`scores fetch ${res.status}`);
      const events = (await res.json()) as OddsApiScore[];
      return events
        .filter(
          (e) =>
            e.completed &&
            Array.isArray(e.scores) &&
            e.scores.length === 2 &&
            toSclSport(e.sport_key) != null,
        )
        .map((e) => {
          const home = e.scores!.find((s) => s.name === e.home_team);
          const away = e.scores!.find((s) => s.name === e.away_team);
          return {
            sport: toSclSport(e.sport_key)!, // normalized to SCL keys to match plays
            home: e.home_team,
            away: e.away_team,
            homeScore: Number(home?.score ?? 0),
            awayScore: Number(away?.score ?? 0),
            completed: true,
          };
        });
    },
  };
}

type OddsApiScore = {
  sport_key: string;
  completed: boolean;
  home_team: string;
  away_team: string;
  scores?: { name: string; score: string }[];
};

/** Auto-select the live provider when a key exists; otherwise demo results. */
export function getResultsProvider(): ResultsProvider {
  return oddsApiKey() ? oddsApiResultsProvider() : new MockResultsProvider();
}
