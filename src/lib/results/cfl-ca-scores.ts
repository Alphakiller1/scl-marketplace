import type { ResultsProvider } from "@/lib/results/provider";
import { mapCflScheduleHtml } from "@/lib/results/cfl-ca-map";
import type { SettledGame } from "@/lib/results/settled-game";

async function fetchCflSchedule(year: number): Promise<SettledGame[]> {
  const url = `https://www.cfl.ca/schedule/${year}/`;
  try {
    const response = await fetch(url, {
      cache: "no-store",
      headers: {
        Accept: "text/html",
        "User-Agent": "SCL-grader/1.0 (+https://sportscappersleaderboard.com)",
      },
    });
    if (!response.ok) {
      console.error(
        `[results] cfl.ca schedule ${year} HTTP ${response.status}`,
      );
      return [];
    }
    return mapCflScheduleHtml(await response.text());
  } catch (error) {
    console.error(`[results] cfl.ca schedule ${year}:`, error);
    return [];
  }
}

/**
 * Free CFL finals from the league schedule page.
 *
 * ESPN's CFL scoreboard is a stale 2022 Grey Cup; Odds API scores only cover
 * three days. This page lists every completed game for the season.
 */
export function cflCaResultsProvider(now = new Date()): ResultsProvider {
  const year = now.getUTCFullYear();
  const years = now.getUTCMonth() === 0 ? [year, year - 1] : [year];
  return {
    name: "cfl-ca",
    async fetchSettled() {
      return this.fetchSettledForSports(["CFL"]);
    },
    async fetchSettledForSports(sports: string[]) {
      if (!sports.some((sport) => sport.toUpperCase() === "CFL")) return [];
      const batches = await Promise.all(years.map((y) => fetchCflSchedule(y)));
      return batches.flat();
    },
  };
}
