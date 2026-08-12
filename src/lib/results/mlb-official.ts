import type { ResultsProvider } from "@/lib/results/provider";
import type { SettledGame } from "@/lib/results/settled-game";

type MlbSchedulePayload = {
  dates?: Array<{
    games?: Array<{
      gamePk?: number;
      gameDate?: string;
      status?: { abstractGameState?: string; detailedState?: string };
      teams?: {
        home?: { score?: number; team?: { name?: string } };
        away?: { score?: number; team?: { name?: string } };
      };
      linescore?: {
        innings?: Array<{
          home?: { runs?: number };
          away?: { runs?: number };
        }>;
      };
    }>;
  }>;
};

export function mapMlbOfficialSchedule(
  payload: MlbSchedulePayload,
): SettledGame[] {
  const settled: SettledGame[] = [];
  for (const date of payload.dates ?? []) {
    for (const game of date.games ?? []) {
      const final =
        game.status?.abstractGameState === "Final" ||
        /final|completed/i.test(game.status?.detailedState ?? "");
      const home = game.teams?.home;
      const away = game.teams?.away;
      if (
        !final ||
        game.gamePk == null ||
        !game.gameDate ||
        !home?.team?.name ||
        !away?.team?.name ||
        typeof home.score !== "number" ||
        typeof away.score !== "number"
      ) {
        continue;
      }
      const startsAt = new Date(game.gameDate);
      if (Number.isNaN(startsAt.getTime())) continue;
      const innings = game.linescore?.innings ?? [];
      const homePeriods = innings
        .map((inning) => inning.home?.runs)
        .filter((runs): runs is number => typeof runs === "number");
      const awayPeriods = innings
        .map((inning) => inning.away?.runs)
        .filter((runs): runs is number => typeof runs === "number");
      settled.push({
        sport: "MLB",
        home: home.team.name,
        away: away.team.name,
        homeScore: home.score,
        awayScore: away.score,
        completed: true,
        eventId: `mlb:${game.gamePk}`,
        mlbGamePk: String(game.gamePk),
        startsAt,
        ...(homePeriods.length ? { homePeriods } : {}),
        ...(awayPeriods.length ? { awayPeriods } : {}),
      });
    }
  }
  return settled;
}

function isoDay(date: Date): string {
  return date.toISOString().slice(0, 10);
}

/** Independent Plan C for MLB finals and per-inning scores. */
export function mlbOfficialResultsProvider(now = new Date()): ResultsProvider {
  return {
    name: "mlb-official",
    async fetchSettled() {
      return this.fetchSettledForSports(["MLB"]);
    },
    async fetchSettledForSports(sports: string[]) {
      if (!sports.includes("MLB")) return [];
      const start = new Date(now.getTime() - 14 * 24 * 60 * 60 * 1_000);
      const url =
        "https://statsapi.mlb.com/api/v1/schedule" +
        `?sportId=1&startDate=${isoDay(start)}&endDate=${isoDay(now)}` +
        "&hydrate=linescore";
      try {
        const response = await fetch(url, {
          cache: "no-store",
          headers: { Accept: "application/json" },
        });
        if (!response.ok) {
          console.error("[results] MLB official schedule failed", {
            status: response.status,
          });
          return [];
        }
        return mapMlbOfficialSchedule(
          (await response.json()) as MlbSchedulePayload,
        );
      } catch (error) {
        console.error("[results] MLB official schedule error", {
          reason: error instanceof Error ? error.message : String(error),
        });
        return [];
      }
    },
  };
}
