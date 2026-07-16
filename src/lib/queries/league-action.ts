import "server-only";

import type { VerificationTier } from "@prisma/client";

import { prisma } from "@/lib/prisma";
import {
  rankLeagueAction,
  rankLeagueActionCategories,
  type LeagueActionCategoryItem,
  type LeagueActionItem,
} from "@/lib/league-action";
import { UNIT_MIN } from "@/lib/constants";
import { prismaExcludeTestHandles } from "@/lib/public-eligibility";

const DEFAULT_WINDOW_DAYS = 14;
const DEFAULT_TAKE = 6;

const VERIFIED_TIERS: VerificationTier[] = ["VERIFIED", "AUTO_VERIFIED"];

const PUBLIC_PLAY_FILTER = {
  units: { gte: UNIT_MIN },
  verificationTier: { in: VERIFIED_TIERS },
  capper: {
    user: {
      accountStatus: "ACTIVE" as const,
      username: { not: null },
      ...prismaExcludeTestHandles(),
    },
  },
};

export type LeagueActionReportResult = {
  leagues: LeagueActionItem[];
  categories: LeagueActionCategoryItem[];
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
    const [plays, parlays] = await Promise.all([
      prisma.play.findMany({
        where: {
          createdAt: { gte: since },
          ...PUBLIC_PLAY_FILTER,
        },
        select: {
          sport: true,
          league: true,
          capperId: true,
          market: true,
          parlayId: true,
        },
        orderBy: { createdAt: "desc" },
      }),
      prisma.parlay.findMany({
        where: {
          createdAt: { gte: since },
          units: { gte: UNIT_MIN },
          capper: {
            user: {
              accountStatus: "ACTIVE",
              username: { not: null },
              ...prismaExcludeTestHandles(),
            },
          },
          legs: {
            every: {
              verificationTier: { in: VERIFIED_TIERS },
            },
          },
        },
        select: { capperId: true },
      }),
    ]);

    return {
      leagues: rankLeagueAction(plays, take),
      categories: rankLeagueActionCategories(plays, parlays),
      windowDays,
      failed: false,
    };
  } catch (error) {
    console.error("[getLeagueActionReport] database unavailable:", error);
    return { leagues: [], categories: [], windowDays, failed: true };
  }
}
