import "server-only";

import type { VerificationTier } from "@prisma/client";
import { unstable_cache } from "next/cache";

import { prisma } from "@/lib/prisma";
import {
  platformTrackedPicks,
  rankLeagueAction,
  rankLeagueActionCategories,
  type LeagueActionCategoryItem,
  type LeagueActionItem,
} from "@/lib/league-action";
import { UNIT_MIN } from "@/lib/constants";
import { prismaExcludeTestHandlesLive } from "@/lib/public-eligibility-prisma";

const DEFAULT_WINDOW_DAYS = 14;
const DEFAULT_TAKE = 6;

const VERIFIED_TIERS: VerificationTier[] = ["VERIFIED", "AUTO_VERIFIED"];

async function publicPlayFilter() {
  const excludeTest = await prismaExcludeTestHandlesLive();
  return {
    units: { gte: UNIT_MIN },
    verificationTier: { in: VERIFIED_TIERS },
    capper: {
      user: {
        accountStatus: "ACTIVE" as const,
        username: { not: null },
        ...excludeTest,
      },
    },
  };
}

export type LeagueActionReportResult = {
  leagues: LeagueActionItem[];
  categories: LeagueActionCategoryItem[];
  /** Shape singles + parlays ΓÇö never double-counts market buckets. */
  trackedPicks: number;
  windowDays: number;
  failed: boolean;
};

async function loadLeagueActionReport({
  windowDays,
  take,
}: {
  windowDays: number;
  take: number;
}): Promise<LeagueActionReportResult> {
  const since = new Date(Date.now() - windowDays * 24 * 60 * 60 * 1000);

  try {
    const playFilter = await publicPlayFilter();
    const excludeTest = await prismaExcludeTestHandlesLive();
    const [plays, parlays] = await Promise.all([
      prisma.play.findMany({
        where: {
          createdAt: { gte: since },
          ...playFilter,
        },
        select: {
          sport: true,
          league: true,
          capperId: true,
          market: true,
          parlayId: true,
          outcome: true,
          units: true,
          profitUnits: true,
          createdAt: true,
          eventStartsAt: true,
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
              ...excludeTest,
            },
          },
          legs: {
            every: {
              verificationTier: { in: VERIFIED_TIERS },
            },
          },
        },
        select: {
          capperId: true,
          outcome: true,
          units: true,
          profitUnits: true,
          createdAt: true,
          legs: {
            select: { eventStartsAt: true },
            orderBy: { eventStartsAt: "asc" },
          },
        },
      }),
    ]);

    const playRows = plays.map((p) => ({
      sport: p.sport,
      league: p.league,
      capperId: p.capperId,
      market: p.market,
      parlayId: p.parlayId,
      outcome: p.outcome,
      units: Number(p.units),
      profitUnits: p.profitUnits == null ? null : Number(p.profitUnits),
      createdAt: p.createdAt,
      eventStartsAt: p.eventStartsAt,
    }));

    const parlayRows = parlays.map((p) => {
      const starts = p.legs
        .map((l) => l.eventStartsAt)
        .filter((d): d is Date => d != null);
      const earliest =
        starts.length > 0
          ? starts.reduce((a, b) => (a.getTime() <= b.getTime() ? a : b))
          : null;
      return {
        capperId: p.capperId,
        outcome: p.outcome,
        units: Number(p.units),
        profitUnits: p.profitUnits == null ? null : Number(p.profitUnits),
        createdAt: p.createdAt,
        eventStartsAt: earliest,
      };
    });

    // League ranking uses straight plays only (parlay legs excluded) so volume
    // matches shape singles, not flattened legs.
    const leaguePlays = playRows.filter((p) => p.parlayId == null);
    const categories = rankLeagueActionCategories(playRows, parlayRows);

    return {
      leagues: rankLeagueAction(leaguePlays, take),
      categories,
      trackedPicks: platformTrackedPicks(categories),
      windowDays,
      failed: false,
    };
  } catch (error) {
    console.error("[getLeagueActionReport] database unavailable:", error);
    return {
      leagues: [],
      categories: [],
      trackedPicks: 0,
      windowDays,
      failed: true,
    };
  }
}

const getCachedLeagueActionReport = unstable_cache(
  async (cacheKey: string) => {
    const { windowDays, take } = JSON.parse(cacheKey) as {
      windowDays: number;
      take: number;
    };
    return loadLeagueActionReport({ windowDays, take });
  },
  ["league-action-report"],
  { revalidate: 60, tags: ["leaderboard", "league-action"] },
);

export async function getLeagueActionReport({
  windowDays = DEFAULT_WINDOW_DAYS,
  take = DEFAULT_TAKE,
}: {
  windowDays?: number;
  take?: number;
} = {}): Promise<LeagueActionReportResult> {
  return getCachedLeagueActionReport(JSON.stringify({ windowDays, take }));
}
