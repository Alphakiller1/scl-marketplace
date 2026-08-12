import type { ResultsProvider } from "@/lib/results/provider";
import type { BoxScore } from "@/lib/results/prop-resolve";
import type { SettledGame } from "@/lib/results/settled-game";

type WnbaTeam = {
  teamCity?: string;
  teamName?: string;
  teamTricode?: string;
  score?: number;
  periods?: Array<{ score?: number }>;
};

type WnbaGame = {
  gameId?: string;
  gameStatus?: number;
  gameStatusText?: string;
  gameDateTimeUTC?: string;
  homeTeam?: WnbaTeam;
  awayTeam?: WnbaTeam;
};

type WnbaSchedulePayload = {
  leagueSchedule?: {
    gameDates?: Array<{ games?: WnbaGame[] }>;
  };
};

function teamName(team: WnbaTeam | undefined): string | null {
  const name = `${team?.teamCity ?? ""} ${team?.teamName ?? ""}`.trim();
  return name || null;
}

/** Pure mapper for the WNBA's own schedule response. Finals only. */
export function mapWnbaOfficialSchedule(
  payload: WnbaSchedulePayload,
  earliest: Date,
  latest: Date,
): SettledGame[] {
  const settled: SettledGame[] = [];
  for (const date of payload.leagueSchedule?.gameDates ?? []) {
    for (const game of date.games ?? []) {
      const final =
        game.gameStatus === 3 || /final/i.test(game.gameStatusText ?? "");
      const startsAt = game.gameDateTimeUTC
        ? new Date(game.gameDateTimeUTC)
        : null;
      const home = teamName(game.homeTeam);
      const away = teamName(game.awayTeam);
      if (
        !final ||
        !game.gameId ||
        !startsAt ||
        Number.isNaN(startsAt.getTime()) ||
        startsAt < earliest ||
        startsAt > latest ||
        !home ||
        !away ||
        typeof game.homeTeam?.score !== "number" ||
        typeof game.awayTeam?.score !== "number"
      ) {
        continue;
      }
      const awayCode = game.awayTeam.teamTricode?.trim().toLowerCase();
      const homeCode = game.homeTeam.teamTricode?.trim().toLowerCase();
      settled.push({
        sport: "WNBA",
        home,
        away,
        homeScore: game.homeTeam.score,
        awayScore: game.awayTeam.score,
        completed: true,
        eventId: `wnba:${game.gameId}`,
        wnbaGameId: game.gameId,
        startsAt,
        ...(awayCode && homeCode
          ? { wnbaGameSlug: `${awayCode}-vs-${homeCode}-${game.gameId}` }
          : {}),
      });
    }
  }
  return settled;
}

type WnbaNextPayload = {
  props?: {
    pageProps?: {
      game?: WnbaGame;
    };
  };
};

/** Pure mapper for the official WNBA game page's embedded box score. */
export function mapWnbaOfficialGamePage(
  payload: WnbaNextPayload,
): BoxScore | null {
  const game = payload.props?.pageProps?.game;
  if (
    !game ||
    (game.gameStatus !== 3 && !/final/i.test(game.gameStatusText ?? ""))
  ) {
    return null;
  }
  const homePeriods = (game.homeTeam?.periods ?? [])
    .map((period) => period.score)
    .filter((score): score is number => typeof score === "number");
  const awayPeriods = (game.awayTeam?.periods ?? [])
    .map((period) => period.score)
    .filter((score): score is number => typeof score === "number");
  return homePeriods.length >= 4 && awayPeriods.length >= 4
    ? { homePeriods, awayPeriods }
    : null;
}

/** Official WNBA quarter scores, read from the league's server-rendered game page. */
export async function fetchWnbaOfficialPeriodBoxScore(
  gameSlug: string,
): Promise<BoxScore | null> {
  try {
    const response = await fetch(
      `https://www.wnba.com/game/${encodeURIComponent(gameSlug)}/box-score`,
      {
        cache: "no-store",
        headers: { Accept: "text/html", "User-Agent": "SCL-Grader/1.0" },
      },
    );
    if (!response.ok) return null;
    const html = await response.text();
    const match = html.match(
      /<script id="__NEXT_DATA__" type="application\/json">([\s\S]*?)<\/script>/,
    );
    if (!match?.[1]) return null;
    return mapWnbaOfficialGamePage(JSON.parse(match[1]) as WnbaNextPayload);
  } catch (error) {
    console.error("[results] WNBA official box score error", {
      gameSlug,
      reason: error instanceof Error ? error.message : String(error),
    });
    return null;
  }
}

/** Independent official Plan C for WNBA final scores. */
export function wnbaOfficialResultsProvider(now = new Date()): ResultsProvider {
  return {
    name: "wnba-official",
    async fetchSettled() {
      return this.fetchSettledForSports(["WNBA"]);
    },
    async fetchSettledForSports(sports: string[]) {
      if (!sports.includes("WNBA")) return [];
      const earliest = new Date(now.getTime() - 14 * 24 * 60 * 60 * 1_000);
      try {
        const response = await fetch(
          `https://www.wnba.com/api/schedule?season=${now.getUTCFullYear()}&regionId=1`,
          {
            cache: "no-store",
            headers: {
              Accept: "application/json",
              "User-Agent": "SCL-Grader/1.0",
            },
          },
        );
        if (!response.ok) {
          console.error("[results] WNBA official schedule failed", {
            status: response.status,
          });
          return [];
        }
        return mapWnbaOfficialSchedule(
          (await response.json()) as WnbaSchedulePayload,
          earliest,
          now,
        );
      } catch (error) {
        console.error("[results] WNBA official schedule error", {
          reason: error instanceof Error ? error.message : String(error),
        });
        return [];
      }
    },
  };
}
