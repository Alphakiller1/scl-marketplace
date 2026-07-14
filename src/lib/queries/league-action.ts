import "server-only";

import { prisma } from "@/lib/prisma";
import { rankLeagueAction, type LeagueActionItem } from "@/lib/league-action";

const DEFAULT_WINDOW_DAYS = 14;
const DEFAULT_TAKE = 6;

export type LeagueActionReportResult = {
  leagues: LeagueActionItem[];
  windowDays: number;
  failed: boolean;
};

export async function getLeagueActionReport({
  windowDays = DEFAULT_WINDOW_DAYS,
  take = DEFAULT_TAKE,
}: {
  windowDays?: number;
  take?: number;
} = {}): Promise<LeagueActionReportResult> {
  const since = new Date(Date.now() - windowDays * 24 * 60 * 60 * 1000);

  try {
    const plays = await prisma.play.findMany({
      where: {
        createdAt: { gte: since },
        capper: {
          user: {
            accountStatus: "ACTIVE",
            username: { not: null },
          },
        },
      },
      select: {
        sport: true,
        league: true,
        capperId: true,
      },
      orderBy: { createdAt: "desc" },
    });

    return {
      leagues: rankLeagueAction(plays, take),
      windowDays,
      failed: false,
    };
  } catch (error) {
    console.error("[getLeagueActionReport] database unavailable:", error);
    return { leagues: [], windowDays, failed: true };
  }
}
