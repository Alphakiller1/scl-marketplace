import "server-only";
import { cache } from "react";

import { awardMonthLabel, makeHonorAward, type HonorAward } from "@/lib/honors";
import { sortLeaderboard } from "@/lib/leaderboard";
import { prisma } from "@/lib/prisma";
import { getLeaderboardResult } from "@/lib/queries/leaderboard";

type StoredHonor = Awaited<ReturnType<typeof prisma.honorAwardGrant.findFirst>>;

function fromStoredHonor(row: NonNullable<StoredHonor>): HonorAward {
  return {
    id: row.id,
    name: row.name,
    abbreviation: row.abbreviation,
    icon: row.icon,
    period: row.period as HonorAward["period"],
    sport: row.sport,
    metric: row.metric as HonorAward["metric"],
    minimumPicks: row.minimumPicks,
    visibleFrom: row.visibleFrom,
    visibleUntil: row.visibleUntil,
    winner: {
      id: row.capperId,
      name: row.winnerName,
      handle: row.winnerHandle,
      avatarUrl: row.winnerAvatarUrl ?? undefined,
      record: { w: row.wins, l: row.losses, p: row.pushes },
      units: Number(row.units),
      roi: Number(row.roi),
    },
  };
}

export const getCurrentHonors = cache(async function getCurrentHonors(
  now = new Date(),
): Promise<HonorAward[]> {
  const [monthly, seasonal, annual, crossSport] = await Promise.all([
    getLeaderboardResult({ window: "month", minPicks: 10 }),
    getLeaderboardResult({ window: "90d", minPicks: 25 }),
    getLeaderboardResult({ window: "year", minPicks: 50 }),
    getLeaderboardResult({
      window: "month",
      sport: "CROSS_SPORTS",
      minPicks: 10,
    }),
  ]);
  const month = awardMonthLabel(now);
  const rows: HonorAward[] = [];
  const add = (
    board: typeof monthly,
    period: "monthly" | "seasonal" | "annual",
    metric: "units" | "roi",
    name: string,
    minimumPicks: number,
    sport = "All Sports",
    icon = "🏆",
  ) => {
    const winner = sortLeaderboard(board.cappers, metric)[0];
    if (!winner) return;
    rows.push(
      makeHonorAward(
        {
          name,
          abbreviation: `${period === "monthly" ? month : period === "seasonal" ? "SEASON" : String(now.getUTCFullYear())} (${metric === "units" ? "$" : "ROI"})`,
          icon,
          period,
          sport,
          metric,
          minimumPicks,
          winner,
        },
        now,
      ),
    );
  };
  add(monthly, "monthly", "units", "Monthly Units Champion", 10);
  add(monthly, "monthly", "roi", "Monthly ROI Champion", 10);
  add(seasonal, "seasonal", "units", "Seasonal Units Champion", 25);
  add(seasonal, "seasonal", "roi", "Seasonal ROI Champion", 25);
  add(annual, "annual", "units", "Annual Units Champion", 50);
  add(annual, "annual", "roi", "Annual ROI Champion", 50);
  add(
    crossSport,
    "monthly",
    "units",
    "Cross Sport Parlay Allstar",
    10,
    "Cross-Sports",
    "🔗",
  );
  const cross = rows.at(-1);
  if (cross?.name === "Cross Sport Parlay Allstar")
    cross.abbreviation = `🔗 ${month} ($)`;
  return rows;
});

export const getCapperHonorHistory = cache(async function getCapperHonorHistory(
  capperId: string,
): Promise<HonorAward[]> {
  try {
    const rows = await prisma.honorAwardGrant.findMany({
      where: { capperId },
      orderBy: [{ visibleFrom: "desc" }, { name: "asc" }],
    });
    return rows.map(fromStoredHonor);
  } catch (error) {
    console.warn("[honors] award history unavailable", error);
    return [];
  }
});

export const getHonorAwardById = cache(async function getHonorAwardById(
  id: string,
): Promise<HonorAward | null> {
  const current = (await getCurrentHonors()).find((award) => award.id === id);
  if (current) return current;
  try {
    const stored = await prisma.honorAwardGrant.findUnique({ where: { id } });
    return stored ? fromStoredHonor(stored) : null;
  } catch (error) {
    console.warn("[honors] award lookup unavailable", error);
    return null;
  }
});
