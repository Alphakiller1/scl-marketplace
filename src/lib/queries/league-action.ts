import "server-only";

import { prisma } from "@/lib/prisma";
import { rankLeagueAction, type LeagueActionItem } from "@/lib/league-action";
import { PUBLIC_LISTED_CAPPER_USER_WHERE } from "@/lib/public-capper";

const DEFAULT_WINDOW_DAYS = 14;
const DEFAULT_TAKE = 6;

export type LeagueActionReportResult = {
  leagues: LeagueActionItem[];
  windowDays: number;
  failed: boolean;
  /** Volume uses public+listed cappers, including Building-a-Record places. */
  includesUnranked: boolean;
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
          user: PUBLIC_LISTED_CAPPER_USER_WHERE,
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
      includesUnranked: true,
      failed: false,
    };
  } catch (error) {
    console.error("[getLeagueActionReport] database unavailable:", error);
    return {
      leagues: [],
      windowDays,
      includesUnranked: true,
      failed: true,
    };
  }
}
