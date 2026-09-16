import "server-only";
import { cache } from "react";

import { cachedQuery } from "@/lib/cached-query";
import { UNIT_MIN } from "@/lib/constants";
import { withTransientDatabaseRetry } from "@/lib/database-retry";
import { stakeFromStored } from "@/lib/extreme-stake";
import {
  computeHonors,
  featuredHonors,
  HONORS_LEGACY_YEAR,
  type HonorAward,
  type HonorCapper,
  type HonorLegacyTotal,
  type HonorPosition,
} from "@/lib/honors";
import {
  leaderboardSlateInstant,
  parlayLeaderboardSlateInstant,
} from "@/lib/leaderboard";
import { parlayReportingSport } from "@/lib/parlay-sport";
import { prisma } from "@/lib/prisma";
import { hasQaNoteMarker } from "@/lib/public-eligibility";
import { prismaExcludeTestHandlesLive } from "@/lib/public-eligibility-prisma";

const SETTLED = ["WIN", "LOSS", "PUSH"] as const;

/**
 * One read for every public capper's settled positions since the platform's
 * first year, plus the legacy year totals. Honors used to fire four full
 * leaderboard scans in parallel, which exhausted the 5-connection pool and
 * turned award pages into errors.
 */
async function loadHonors(): Promise<HonorAward[]> {
  const since = new Date(Date.UTC(HONORS_LEGACY_YEAR + 1, 0, 1) - 86_400_000);
  const excludeTest = await prismaExcludeTestHandlesLive();
  const profiles = await withTransientDatabaseRetry(
    () =>
      prisma.capperProfile.findMany({
        where: {
          user: {
            username: { not: null },
            accountStatus: "ACTIVE",
            ...excludeTest,
          },
        },
        select: {
          id: true,
          avatarUrl: true,
          user: { select: { username: true, displayName: true } },
          plays: {
            where: {
              parlayId: null,
              units: { gte: UNIT_MIN },
              outcome: { in: [...SETTLED] },
              OR: [
                { eventStartsAt: { gte: since } },
                { eventStartsAt: null, createdAt: { gte: since } },
              ],
            },
            select: {
              sport: true,
              outcome: true,
              units: true,
              profitUnits: true,
              eventStartsAt: true,
              createdAt: true,
              notes: true,
            },
          },
          parlays: {
            where: {
              units: { gte: UNIT_MIN },
              outcome: { in: [...SETTLED] },
              createdAt: { gte: since },
            },
            select: {
              outcome: true,
              units: true,
              profitUnits: true,
              createdAt: true,
              legs: {
                select: { sport: true, eventStartsAt: true },
                take: 12,
                orderBy: { id: "asc" },
              },
            },
          },
          legacyRecords: {
            where: { scope: { in: ["YEAR_2025", "PRE_IMPORT"] } },
            select: {
              scope: true,
              sport: true,
              wins: true,
              losses: true,
              pushes: true,
              unitsRisked: true,
              unitsNet: true,
            },
          },
        },
      }),
    { label: "honors read" },
  );

  const cappers: HonorCapper[] = [];
  const positions: HonorPosition[] = [];
  const legacy: HonorLegacyTotal[] = [];
  for (const profile of profiles) {
    const handle = profile.user.username!.replace(/^@/, "");
    cappers.push({
      id: profile.id,
      name: profile.user.displayName || handle,
      handle,
      avatarUrl: profile.avatarUrl ?? undefined,
    });
    for (const play of profile.plays) {
      if (hasQaNoteMarker(play.notes)) continue;
      const stake = stakeFromStored(play.units, play.profitUnits);
      positions.push({
        capperId: profile.id,
        sport: play.sport,
        at: leaderboardSlateInstant(play),
        outcome: play.outcome,
        ...stake,
      });
    }
    for (const parlay of profile.parlays) {
      const stake = stakeFromStored(parlay.units, parlay.profitUnits);
      positions.push({
        capperId: profile.id,
        sport: parlayReportingSport(parlay.legs),
        at: parlayLeaderboardSlateInstant(parlay),
        outcome: parlay.outcome,
        ...stake,
      });
    }
    for (const row of profile.legacyRecords) {
      legacy.push({
        capperId: profile.id,
        scope: row.scope as HonorLegacyTotal["scope"],
        sport: row.sport,
        wins: row.wins,
        losses: row.losses,
        pushes: row.pushes,
        unitsRisked: Number(row.unitsRisked),
        unitsNet: Number(row.unitsNet),
      });
    }
  }
  return computeHonors({ cappers, positions, legacy });
}

const getCachedHonors = cachedQuery(loadHonors, ["scl-honors-v3"], {
  revalidate: 3600,
  tags: ["leaderboard", "honors"],
});

/** Every completed-period award. Empty (never thrown) when the DB is down. */
export const getAllHonors = cache(async function getAllHonors(): Promise<
  HonorAward[]
> {
  try {
    return await getCachedHonors();
  } catch (error) {
    console.error("[honors] awards unavailable", error);
    return [];
  }
});

/** The latest completed period in each column. */
export const getFeaturedHonors = cache(async function getFeaturedHonors() {
  return featuredHonors(await getAllHonors());
});

export const getHonorAwardById = cache(async function getHonorAwardById(
  id: string,
): Promise<HonorAward | null> {
  return (await getAllHonors()).find((award) => award.id === id) ?? null;
});
