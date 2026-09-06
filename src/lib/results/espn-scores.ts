import "server-only";

import {
  mapEspnScoreboard,
  yyyymmddUtc,
} from "@/lib/results/espn-scoreboard-map";
import { espnSoccerLeagueSlug } from "@/lib/results/espn-soccer-leagues";
import { mapEspnTennisScoreboard } from "@/lib/results/espn-tennis-map";
import type { ResultsQueryScope } from "@/lib/results/provider";
import {
  mergeSettledGames,
  type SettledGame,
} from "@/lib/results/settled-game";

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
  // ESPN's CFL calendar is stale (dated fetches empty). Cron scores CFL via
  // Odds API; this path is kept so a live card still maps if ESPN ever updates.
  CFL: { sport: "football", league: "cfl" },
  MMA: { sport: "mma", league: "ufc" },
};

/** Current ATP / WTA tournament cards — matches live under groupings. */
const ESPN_TENNIS_TOURS = ["atp", "wta"] as const;

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

async function fetchEspnTennisTour(
  tour: "atp" | "wta",
  day?: string,
): Promise<SettledGame[]> {
  const url =
    `https://site.api.espn.com/apis/site/v2/sports/tennis/${tour}/scoreboard` +
    (day ? `?dates=${day}` : "");
  try {
    const res = await fetch(url, {
      cache: "no-store",
      headers: { Accept: "application/json" },
      signal: AbortSignal.timeout(10_000),
    });
    if (!res.ok) {
      console.error(`[results] espn tennis ${tour} HTTP ${res.status}`);
      return [];
    }
    const json = (await res.json()) as Parameters<
      typeof mapEspnTennisScoreboard
    >[0];
    return mapEspnTennisScoreboard(json, tour);
  } catch (err) {
    console.error(`[results] espn tennis ${tour}:`, err);
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
    scope?: ResultsQueryScope,
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
    async fetchSettledForSports(sports: string[], scope?: ResultsQueryScope) {
      const distinct = [...new Set(sports)];
      const standardSports = distinct.filter((s) => ESPN_SPORT_PATH[s]);
      const soccerLeagues = [
        ...new Set(scope?.soccerLeagues?.filter(Boolean) ?? []),
      ].filter((league) => espnSoccerLeagueSlug(league));
      // Current cards disappear when a tournament rolls over. Ask for the
      // pending fixtures' dates too, even beyond the default lookback. Dated
      // tennis cards contain the full tournament, including rescheduled rounds.
      const tennisDates = [...new Set(scope?.tennisEventDates ?? dates)].filter(
        (day) => /^\d{8}$/.test(day) && day <= yyyymmddUtc(now),
      );
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
      const batches = await Promise.all(requests);
      if (distinct.includes("TENNIS")) {
        const tennisRequests = [undefined, ...tennisDates].flatMap((day) =>
          ESPN_TENNIS_TOURS.map((tour) => ({ tour, day })),
        );
        const deadline = Date.now() + 60_000;
        // Bound fan-out and individual request duration during backlog recovery.
        for (let i = 0; i < tennisRequests.length; i += 4) {
          if (Date.now() >= deadline) {
            console.warn("[results] tennis history time budget reached", {
              remainingRequests: tennisRequests.length - i,
            });
            break;
          }
          batches.push(
            ...(await Promise.all(
              tennisRequests
                .slice(i, i + 4)
                .map(({ tour, day }) => fetchEspnTennisTour(tour, day)),
            )),
          );
        }
      }
      // ESPN scoreboards overlap, so flattening produces duplicates.
      //
      // At a combined event the ATP and WTA cards each carry the ENTIRE draw,
      // so every US Open match came back twice. Two copies of one match are not
      // two candidates: `findGame` takes a sole match and returns null on
      // ambiguity, so six completed moneylines went unmatched while both feeds
      // carried the result — then aged out permanently. Draw format is corrected
      // by the tennis mapper before deduplication; merging alone cannot fix it.
      return batches.reduce<SettledGame[]>(
        (merged, batch) => mergeSettledGames(merged, batch),
        [],
      );
    },
  };
}
