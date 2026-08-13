import "server-only";

import type { Outcome } from "@prisma/client";

import { prisma } from "@/lib/prisma";
import { UNIT_MIN } from "@/lib/constants";
import { etDayBounds } from "@/lib/et-day";
import { hasQaNoteMarker } from "@/lib/public-eligibility";
import { prismaExcludeTestHandlesLive } from "@/lib/public-eligibility-prisma";
import type { PlayView } from "@/lib/queries/plays";
import {
  hasClvColumns,
  hasNotesPublicColumn,
} from "@/lib/results/schema-features";
import {
  BOARD_VERIFIED_TIERS,
  type VerificationTier,
} from "@/lib/verification";

export type TodaysMove = {
  handle: string;
  /** Net units from plays graded today ET (real, not fabricated). */
  unitsDelta: number;
  gradedCount: number;
  /** Capper's public rank place when ranked; 0 = building. */
  rank: number;
  rankDelta: number;
  roi: number;
  settledPicks: number;
};

export type FeaturedGradedPlay = PlayView & {
  handle: string;
};

const GRADED: Outcome[] = ["WIN", "LOSS", "PUSH"];

/**
 * Cappers with at least one play graded today (ET).
 * Units delta = sum of today's graded profitUnits — honest empty when none.
 */
export async function getTodaysGradedMoves(
  limit = 8,
): Promise<{ moves: TodaysMove[]; failed: boolean }> {
  try {
    const { start, end } = etDayBounds(0);
    const excludeTest = await prismaExcludeTestHandlesLive();
    const plays = await prisma.play.findMany({
      where: {
        parlayId: null,
        outcome: { in: GRADED },
        units: { gte: UNIT_MIN },
        gradedAt: { gte: start, lt: end },
        capper: {
          user: {
            accountStatus: "ACTIVE",
            username: { not: null },
            ...excludeTest,
          },
        },
      },
      select: {
        profitUnits: true,
        capper: {
          select: {
            user: { select: { username: true } },
          },
        },
      },
    });

    const byHandle = new Map<
      string,
      { unitsDelta: number; gradedCount: number }
    >();
    for (const p of plays) {
      const handle = p.capper.user.username;
      if (!handle) continue;
      const prev = byHandle.get(handle) ?? { unitsDelta: 0, gradedCount: 0 };
      prev.unitsDelta += Number(p.profitUnits ?? 0);
      prev.gradedCount += 1;
      byHandle.set(handle, prev);
    }

    const handles = [...byHandle.keys()];
    if (!handles.length) return { moves: [], failed: false };

    // Attach current leaderboard-facing stats where available (no invented Δ).
    const profiles = await prisma.capperProfile.findMany({
      where: {
        user: { username: { in: handles } },
      },
      select: {
        user: { select: { username: true } },
        plays: {
          where: {
            parlayId: null,
            outcome: { in: GRADED },
            units: { gte: UNIT_MIN },
          },
          select: {
            outcome: true,
            profitUnits: true,
            units: true,
          },
        },
      },
    });

    const statsByHandle = new Map<
      string,
      { roi: number; settledPicks: number; units: number }
    >();
    for (const profile of profiles) {
      const handle = profile.user.username;
      if (!handle) continue;
      let staked = 0;
      let profit = 0;
      let settled = 0;
      for (const pl of profile.plays) {
        settled += 1;
        staked += Number(pl.units);
        profit += Number(pl.profitUnits ?? 0);
      }
      statsByHandle.set(handle, {
        settledPicks: settled,
        units: profit,
        roi: staked > 0 ? (profit / staked) * 100 : 0,
      });
    }

    const moves: TodaysMove[] = [...byHandle.entries()]
      .map(([handle, agg]) => {
        const stats = statsByHandle.get(handle);
        return {
          handle,
          unitsDelta: Number(agg.unitsDelta.toFixed(2)),
          gradedCount: agg.gradedCount,
          rank: 0,
          rankDelta: 0,
          roi: stats?.roi ?? 0,
          settledPicks: stats?.settledPicks ?? agg.gradedCount,
        };
      })
      .sort((a, b) => Math.abs(b.unitsDelta) - Math.abs(a.unitsDelta))
      .slice(0, limit);

    return { moves, failed: false };
  } catch (err) {
    console.error("[getTodaysGradedMoves]", err);
    return { moves: [], failed: true };
  }
}

/** Most recent graded straight play for Featured Proof Receipt — null when none. */
export async function getFeaturedGradedPlay(): Promise<{
  play: FeaturedGradedPlay | null;
  failed: boolean;
}> {
  try {
    const clvReady = await hasClvColumns();
    const notesPublicReady = await hasNotesPublicColumn();
    const excludeTest = await prismaExcludeTestHandlesLive();
    const rows = await prisma.play.findMany({
      where: {
        parlayId: null,
        outcome: { in: GRADED },
        units: { gte: UNIT_MIN },
        gradedAt: { not: null },
        verificationTier: { in: [...BOARD_VERIFIED_TIERS] },
        capper: {
          user: {
            accountStatus: "ACTIVE",
            username: { not: null },
            ...excludeTest,
          },
        },
      },
      orderBy: { gradedAt: "desc" },
      // Over-fetch so a QA-noted play can't claim the Featured slot.
      take: 8,
      select: {
        id: true,
        sport: true,
        league: true,
        market: true,
        selection: true,
        oddsAmerican: true,
        units: true,
        outcome: true,
        profitUnits: true,
        createdAt: true,
        verificationTier: true,
        side: true,
        eventLabel: true,
        homeTeam: true,
        awayTeam: true,
        eventStartsAt: true,
        book: true,
        notes: true,
        ...(notesPublicReady ? { notesPublic: true } : {}),
        ...(clvReady ? { closingOddsAmerican: true, clvPts: true } : {}),
        capper: {
          select: { user: { select: { username: true } } },
        },
      },
    });

    const row = rows.find(
      (r) => r.capper.user.username && !hasQaNoteMarker(r.notes),
    );
    if (!row?.capper.user.username) return { play: null, failed: false };

    const play: FeaturedGradedPlay = {
      id: row.id,
      sport: row.sport,
      league: row.league,
      market: row.market,
      selection: row.selection,
      oddsAmerican: row.oddsAmerican,
      units: Number(row.units),
      outcome: row.outcome,
      profitUnits: row.profitUnits == null ? null : Number(row.profitUnits),
      createdAt: row.createdAt,
      verificationTier: row.verificationTier as VerificationTier,
      side: row.side,
      eventLabel: row.eventLabel,
      eventStartsAt: row.eventStartsAt,
      book: row.book,
      notes: row.notes,
      notesPublic:
        "notesPublic" in row
          ? ((row as { notesPublic?: boolean }).notesPublic ?? true)
          : true,
      closingOddsAmerican:
        "closingOddsAmerican" in row && row.closingOddsAmerican != null
          ? Number(row.closingOddsAmerican)
          : null,
      clvPts: "clvPts" in row && row.clvPts != null ? Number(row.clvPts) : null,
      handle: row.capper.user.username,
    };

    return { play, failed: false };
  } catch (err) {
    console.error("[getFeaturedGradedPlay]", err);
    return { play: null, failed: true };
  }
}
