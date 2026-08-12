import type {
  ResultsProvider,
  ResultsQueryScope,
} from "@/lib/results/provider";
import type { SettledGame } from "@/lib/results/settled-game";

const SPORTSPUFF_SLUG: Record<string, string> = {
  MLB: "mlb",
  NBA: "nba",
  WNBA: "wnba",
  NFL: "nfl",
  NHL: "nhl",
};

type SportsPuffScore = {
  game_id?: string | number;
  game_time?: string;
  home_team?: string;
  visitor_team?: string;
  home_score?: number;
  visitor_score?: number;
  is_final?: boolean;
};

export function mapSportsPuffScores(
  sport: string,
  payload: { scores?: SportsPuffScore[] },
): SettledGame[] {
  return (payload.scores ?? []).flatMap((game) => {
    if (
      game.is_final !== true ||
      game.game_id == null ||
      !game.game_time ||
      !game.home_team ||
      !game.visitor_team ||
      typeof game.home_score !== "number" ||
      typeof game.visitor_score !== "number"
    ) {
      return [];
    }
    const startsAt = new Date(game.game_time);
    if (Number.isNaN(startsAt.getTime())) return [];
    return [
      {
        sport,
        home: game.home_team,
        away: game.visitor_team,
        homeScore: game.home_score,
        awayScore: game.visitor_score,
        completed: true,
        eventId: `sportspuff:${game.game_id}`,
        startsAt,
      },
    ];
  });
}

function etDay(date: Date): string {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "America/New_York",
  }).format(date);
}

/** Independent broad-sport Plan C for final scores. */
export function sportsPuffResultsProvider(now = new Date()): ResultsProvider {
  const dates = Array.from({ length: 4 }, (_, index) =>
    etDay(new Date(now.getTime() - index * 24 * 60 * 60 * 1_000)),
  );
  return {
    name: "sportspuff",
    async fetchSettled() {
      return this.fetchSettledForSports(Object.keys(SPORTSPUFF_SLUG));
    },
    async fetchSettledForSports(sports: string[], scope?: ResultsQueryScope) {
      const requests: Array<Promise<SettledGame[]>> = [];
      for (const sport of [...new Set(sports)]) {
        let slug = SPORTSPUFF_SLUG[sport];
        if (
          sport === "SOCCER" &&
          scope?.soccerLeagues?.some(
            (league) => league.trim().toUpperCase() === "MLS",
          )
        ) {
          slug = "mls";
        }
        if (!slug) continue;
        for (const day of dates) {
          requests.push(
            fetch(`https://api.sportspuff.net/v1/scores/${slug}/${day}?tz=et`, {
              cache: "no-store",
              headers: { Accept: "application/json" },
            })
              .then(async (response) => {
                if (!response.ok) return [];
                return mapSportsPuffScores(
                  sport,
                  (await response.json()) as { scores?: SportsPuffScore[] },
                );
              })
              .catch((error) => {
                console.warn("[results] SportsPuff backstop failed", {
                  sport,
                  day,
                  reason:
                    error instanceof Error ? error.message : String(error),
                });
                return [];
              }),
          );
        }
      }
      return (await Promise.all(requests)).flat();
    },
  };
}
