import "server-only";

import type { Outcome, VerificationTier } from "@prisma/client";

import { UNIT_MIN } from "@/lib/constants";
import { prisma } from "@/lib/prisma";
import { prismaExcludeTestHandlesLive } from "@/lib/public-eligibility-prisma";
import { hasClvColumns } from "@/lib/results/schema-features";

const VERIFIED_TIERS: VerificationTier[] = ["VERIFIED", "AUTO_VERIFIED"];
const WINDOW_MS = 7 * 86_400_000;
const PER_KIND = 12;
const MAX_ITEMS = 28;

export type LiveTickerKind = "win" | "clv" | "posted";

export type LiveTickerItem = {
  id: string;
  kind: LiveTickerKind;
  handle: string;
  sport: string;
  /** Sort / freshness — gradedAt, closingCapturedAt, or createdAt. */
  at: string;
  /** WIN only — honest P/L when stored. */
  profitUnits?: number | null;
  /** Positive CLV only. */
  clvPts?: number;
};

export type LiveActivityTickerPayload = {
  items: LiveTickerItem[];
  failed: boolean;
};

async function publicCapperFilter() {
  const excludeTest = await prismaExcludeTestHandlesLive();
  return {
    user: {
      accountStatus: "ACTIVE" as const,
      username: { not: null },
      ...excludeTest,
    },
  };
}

/**
 * Homepage live marquee — real board-verified events only:
 * recent wins, positive CLV snapshots, newly posted picks (sport + handle).
 * Never fabricates; empty → hide the module.
 */
export async function getLiveActivityTicker(): Promise<LiveActivityTickerPayload> {
  try {
    const since = new Date(Date.now() - WINDOW_MS);
    const clvReady = await hasClvColumns();
    const capperFilter = await publicCapperFilter();

    const baseWhere = {
      parlayId: null,
      units: { gte: UNIT_MIN },
      verificationTier: { in: VERIFIED_TIERS },
      capper: capperFilter,
    };

    const selectCapper = {
      capper: { select: { user: { select: { username: true } } } },
    } as const;

    const [wins, posted, clvRows] = await Promise.all([
      prisma.play.findMany({
        where: {
          ...baseWhere,
          outcome: "WIN" satisfies Outcome,
          gradedAt: { gte: since },
        },
        select: {
          id: true,
          sport: true,
          profitUnits: true,
          gradedAt: true,
          ...selectCapper,
        },
        orderBy: { gradedAt: "desc" },
        take: PER_KIND,
      }),
      prisma.play.findMany({
        where: {
          ...baseWhere,
          outcome: "PENDING" satisfies Outcome,
          createdAt: { gte: since },
        },
        select: {
          id: true,
          sport: true,
          createdAt: true,
          ...selectCapper,
        },
        orderBy: { createdAt: "desc" },
        take: PER_KIND,
      }),
      clvReady
        ? prisma.play.findMany({
            where: {
              ...baseWhere,
              clvPts: { gt: 0 },
              closingCapturedAt: { gte: since },
            },
            select: {
              id: true,
              sport: true,
              clvPts: true,
              closingCapturedAt: true,
              ...selectCapper,
            },
            orderBy: { closingCapturedAt: "desc" },
            take: PER_KIND,
          })
        : Promise.resolve([]),
    ]);

    const items: LiveTickerItem[] = [];

    for (const row of wins) {
      const handle = row.capper.user.username;
      if (!handle || !row.gradedAt) continue;
      items.push({
        id: `win-${row.id}`,
        kind: "win",
        handle,
        sport: row.sport,
        at: row.gradedAt.toISOString(),
        profitUnits: row.profitUnits == null ? null : Number(row.profitUnits),
      });
    }

    for (const row of clvRows) {
      const handle = row.capper.user.username;
      const clvPts =
        "clvPts" in row && row.clvPts != null ? Number(row.clvPts) : null;
      const captured =
        "closingCapturedAt" in row ? row.closingCapturedAt : null;
      if (
        !handle ||
        clvPts == null ||
        !Number.isFinite(clvPts) ||
        clvPts <= 0
      ) {
        continue;
      }
      if (!(captured instanceof Date)) continue;
      items.push({
        id: `clv-${row.id}`,
        kind: "clv",
        handle,
        sport: row.sport,
        at: captured.toISOString(),
        clvPts,
      });
    }

    for (const row of posted) {
      const handle = row.capper.user.username;
      if (!handle) continue;
      items.push({
        id: `posted-${row.id}`,
        kind: "posted",
        handle,
        sport: row.sport,
        at: row.createdAt.toISOString(),
      });
    }

    // Keep recent wins at the front of the marquee so a burst of pending picks
    // cannot hide the owner-requested winning-wager feed. Within each activity
    // type, preserve newest-first ordering.
    const kindPriority: Record<LiveTickerKind, number> = {
      win: 0,
      clv: 1,
      posted: 2,
    };
    items.sort(
      (a, b) =>
        kindPriority[a.kind] - kindPriority[b.kind] ||
        new Date(b.at).getTime() - new Date(a.at).getTime(),
    );

    return { items: items.slice(0, MAX_ITEMS), failed: false };
  } catch (err) {
    console.error("[getLiveActivityTicker]", err);
    return { items: [], failed: true };
  }
}
