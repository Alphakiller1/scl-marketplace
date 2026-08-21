import "server-only";

import {
  mapEspnScoreboard,
  yyyymmddUtc,
} from "@/lib/results/espn-scoreboard-map";
import { espnSoccerLeagueSlug } from "@/lib/results/espn-soccer-leagues";
import type { SettledGame } from "@/lib/results/settled-game";

/** Days of ESPN scoreboard history to pull when Odds API lookback is exhausted. */
export const ESPN_HISTORICAL_SCOREBOARD_DAYS = 14;

export {
  canonicalizeEspnTeamName,
  mapEspnScoreboard,
  yyyymmddUtc,
} from "@/lib/results/espn-scoreboard-map";

/** SCL sport → ESPN site API path segment. */
const ESPN_SPORT_PATH: Record<string, { sport: string; league: string }> = {
  NFL: { sport: "football", league: "nfl" },
  NBA: { sport: "basketball", league: "nba" },
  NCAAF: { sport: "football", league: "college-football" },
  NCAAB: { sport: "basketball", league: "mens-college-basketball" },
  MLB: { sport: "baseball", league: "mlb" },
  NHL: { sport: "hockey", league: "nhl" },
  WNBA: { sport: "basketball", league: "wnba" },
  CFL: { sport: "football", league: "cfl" },
};

async function fetchEspnScoreboardDay(
  sclSport: string,
  yyyymmdd: string,
  soccerLeague?: string,
): Promise<SettledGame[]> {
  const soccerSlug =
    sclSport === "SOCCER" ? espnSoccerLeagueSlug(soccerLeague) : null;
  const path = soccerSlug
    ? { sport: "soccer", league: soccerSlug }
    : ESPN_SPORT_PATH[sclSport];
  if (!path) return [];

  const url =
    `https://site.api.espn.com/apis/site/v2/sports/${path.sport}/${path.league}/scoreboard` +
    `?dates=${yyyymmdd}`;
  try {
    const res = await fetch(url, {
      cache: "no-store",
      headers: { Accept: "application/json" },
    });
    if (!res.ok) {
      console.error(
        `[results] espn scoreboard ${sclSport} ${yyyymmdd} HTTP ${res.status}`,
      );
      return [];
    }
    const json = (await res.json()) as { events?: unknown[] };
    return mapEspnScoreboard(
      sclSport,
      json as Parameters<typeof mapEspnScoreboard>[1],
    );
  } catch (err) {
    console.error(`[results] espn scoreboard ${sclSport} ${yyyymmdd}:`, err);
    return [];
  }
}

/**
 * Historical final scores via ESPN public scoreboard (no Odds API credits).
 * Covers the cliff beyond The Odds API `daysFrom` max of 3.
 */
export function espnHistoricalResultsProvider(
  days = ESPN_HISTORICAL_SCOREBOARD_DAYS,
  now = new Date(),
): {
  name: string;
  fetchSettled(): Promise<SettledGame[]>;
  fetchSettledForSports(
    sports: string[],
    scope?: { soccerLeagues?: readonly string[] },
  ): Promise<SettledGame[]>;
} {
  const dates: string[] = [];
  for (let i = 0; i < days; i++) {
    const d = new Date(now.getTime() - i * 24 * 60 * 60 * 1000);
    dates.push(yyyymmddUtc(d));
  }

  return {
    name: "espn-scoreboard",
    async fetchSettled() {
      return this.fetchSettledForSports(Object.keys(ESPN_SPORT_PATH));
    },
    async fetchSettledForSports(
      sports: string[],
      scope?: { soccerLeagues?: readonly string[] },
    ) {
      const distinct = [...new Set(sports)];
      const standardSports = distinct.filter((s) => ESPN_SPORT_PATH[s]);
      const soccerLeagues = [
        ...new Set(scope?.soccerLeagues?.filter(Boolean) ?? []),
      ].filter((league) => espnSoccerLeagueSlug(league));
      const requests = [
        ...standardSports.flatMap((sport) =>
          dates.map((day) => fetchEspnScoreboardDay(sport, day)),
        ),
        ...(distinct.includes("SOCCER")
          ? soccerLeagues.flatMap((league) =>
              dates.map((day) => fetchEspnScoreboardDay("SOCCER", day, league)),
            )
          : []),
      ];
      if (requests.length === 0) return [];

      const batches = await Promise.all(requests);
      return batches.flat();
    },
  };
}
