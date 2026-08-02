import "server-only";

import { cache } from "react";

import { getLeaderboardResult } from "@/lib/queries/leaderboard";

/** Data-derived profile accolades; never award labels without leaderboard evidence. */
export const getCapperAccolades = cache(async function getCapperAccolades(
  handle: string,
  topSport: string,
): Promise<string[]> {
  const [allTime, recent, recentSport] = await Promise.all([
    getLeaderboardResult({ window: "all" }),
    getLeaderboardResult({ window: "30d" }),
    getLeaderboardResult({ window: "30d", sport: topSport }),
  ]);

  const normalized = handle.toLowerCase();
  const awards = new Set<string>();
  const add = (
    board: Awaited<ReturnType<typeof getLeaderboardResult>>,
    prefix: string,
  ) => {
    const capper = board.cappers.find(
      (candidate) => candidate.handle.toLowerCase() === normalized,
    );
    if (!capper) return;
    for (const trophy of capper.trophies) {
      if (trophy === "Hot Streak") awards.add("Hot Streak");
      if (trophy === "Top Units") awards.add(`${prefix} Top Units`);
      if (trophy === "Top ROI") awards.add(`${prefix} Top ROI`);
    }
  };

  add(allTime, "All-Time");
  add(recent, "30-Day");
  add(recentSport, `${topSport} 30-Day`);
  return [...awards].slice(0, 6);
});
