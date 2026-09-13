import "server-only";
import { cache } from "react";

import { prisma } from "@/lib/prisma";
import { hasQaNoteMarker } from "@/lib/public-eligibility";
import { prismaExcludeTestHandlesLive } from "@/lib/public-eligibility-prisma";
import { computeCapperStats, type CapperStats } from "@/lib/stats";

export type SupermaxLeaderboardRow = CapperStats & {
  capperId: string;
  handle: string;
  avatarUrl?: string;
};

export const getSupermaxLeaderboard = cache(
  async (): Promise<SupermaxLeaderboardRow[]> => {
    try {
      const excludeTest = await prismaExcludeTestHandlesLive();
      const profiles = await prisma.capperProfile.findMany({
        where: {
          user: {
            username: { not: null },
            accountStatus: "ACTIVE",
            ...excludeTest,
          },
          plays: { some: { isSupermax: true, parlayId: null } },
        },
        select: {
          id: true,
          avatarUrl: true,
          user: { select: { username: true } },
          plays: {
            where: { isSupermax: true, parlayId: null },
            select: {
              outcome: true,
              units: true,
              profitUnits: true,
              notes: true,
            },
          },
        },
      });
      return profiles
        .flatMap((profile) => {
          if (!profile.user.username) return [];
          const eligiblePlays = profile.plays.filter(
            (play) => !hasQaNoteMarker(play.notes),
          );
          if (eligiblePlays.length === 0) return [];
          const stats = computeCapperStats(
            eligiblePlays.map((play) => ({
              outcome: play.outcome,
              units: Number(play.units),
              profitUnits:
                play.profitUnits == null ? null : Number(play.profitUnits),
            })),
          );
          return [
            {
              capperId: profile.id,
              handle: profile.user.username,
              avatarUrl: profile.avatarUrl ?? undefined,
              ...stats,
            },
          ];
        })
        .sort((a, b) => b.units - a.units || b.roi - a.roi);
    } catch (error) {
      console.error("[supermax] leaderboard unavailable", error);
      return [];
    }
  },
);

export async function getCapperSupermaxStats(
  capperId: string,
): Promise<CapperStats> {
  const rows = await prisma.play.findMany({
    where: { capperId, parlayId: null, isSupermax: true },
    select: { outcome: true, units: true, profitUnits: true, notes: true },
  });
  return computeCapperStats(
    rows
      .filter((row) => !hasQaNoteMarker(row.notes))
      .map((row) => ({
        outcome: row.outcome,
        units: Number(row.units),
        profitUnits: row.profitUnits == null ? null : Number(row.profitUnits),
      })),
  );
}
