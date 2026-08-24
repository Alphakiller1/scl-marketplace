import "server-only";

import type { Outcome } from "@prisma/client";

import { UNIT_MIN } from "@/lib/constants";
import { etDayBounds } from "@/lib/et-day";
import { stakeFromStored } from "@/lib/extreme-stake";
import {
  earliestLegStart,
  parlayBookLabel,
  parlayDisplaySport,
  parlayGameLabel,
  parlayTitle,
  parlayVerificationTier,
  type ParlayPositionDetail,
} from "@/lib/parlay-display";
import { matchupLabel } from "@/lib/pick-identity";
import { prisma } from "@/lib/prisma";
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
  /** Set when the featured position is a parlay rather than a straight pick. */
  parlay?: ParlayPositionDetail;
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
    const capperWhere = {
      capper: {
        user: {
          accountStatus: "ACTIVE" as const,
          username: { not: null },
          ...excludeTest,
        },
      },
    };
    const gradedToday = {
      outcome: { in: GRADED },
      units: { gte: UNIT_MIN },
      gradedAt: { gte: start, lt: end },
      ...capperWhere,
    };
    const positionSelect = {
      units: true,
      profitUnits: true,
      capper: {
        select: {
          user: { select: { username: true } },
        },
      },
    } as const;
    // Today's move is the day's net across a capper's positions of record —
    // parlays included, exactly as the leaderboard counts them. Reading straight
    // plays alone hid parlay-only cappers from the board entirely.
    const [plays, parlays] = await Promise.all([
      prisma.play.findMany({
        where: { parlayId: null, ...gradedToday },
        select: positionSelect,
      }),
      prisma.parlay.findMany({
        where: gradedToday,
        select: positionSelect,
      }),
    ]);

    const byHandle = new Map<
      string,
      { unitsDelta: number; gradedCount: number }
    >();
    for (const p of [...plays, ...parlays]) {
      const handle = p.capper.user.username;
      if (!handle) continue;
      const prev = byHandle.get(handle) ?? { unitsDelta: 0, gradedCount: 0 };
      const stake = stakeFromStored(p.units, p.profitUnits);
      prev.unitsDelta += stake.profitUnits ?? 0;
      prev.gradedCount += 1;
      byHandle.set(handle, prev);
    }

    const handles = [...byHandle.keys()];
    if (!handles.length) return { moves: [], failed: false };

    // Attach current leaderboard-facing stats where available (no invented Δ).
    const gradedPositions = {
      outcome: { in: GRADED },
      units: { gte: UNIT_MIN },
    };
    const profiles = await prisma.capperProfile.findMany({
      where: {
        user: { username: { in: handles } },
      },
      select: {
        user: { select: { username: true } },
        plays: {
          where: { parlayId: null, ...gradedPositions },
          select: {
            outcome: true,
            profitUnits: true,
            units: true,
          },
        },
        parlays: {
          where: gradedPositions,
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
      for (const pl of [...profile.plays, ...profile.parlays]) {
        const stake = stakeFromStored(pl.units, pl.profitUnits);
        settled += 1;
        staked += stake.units;
        profit += stake.profitUnits ?? 0;
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

/**
 * Most recent graded position for the Featured Proof Receipt — null when none.
 *
 * Straight picks and parlays compete for the slot on the same terms: newest
 * graded, board-verified, public. Reading straight plays alone meant a capper
 * who only posts parlays could never be featured, however their week went.
 */
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
        gradedAt: true,
        ...(notesPublicReady ? { notesPublic: true } : {}),
        ...(clvReady ? { closingOddsAmerican: true, clvPts: true } : {}),
        capper: {
          select: { user: { select: { username: true } } },
        },
      },
    });

    const parlayRows = await prisma.parlay.findMany({
      where: {
        outcome: { in: GRADED },
        units: { gte: UNIT_MIN },
        gradedAt: { not: null },
        legs: {
          some: {},
          every: { verificationTier: { in: [...BOARD_VERIFIED_TIERS] } },
        },
        capper: {
          user: {
            accountStatus: "ACTIVE",
            username: { not: null },
            ...excludeTest,
          },
        },
      },
      orderBy: { gradedAt: "desc" },
      take: 8,
      select: {
        id: true,
        combinedOddsAmerican: true,
        units: true,
        outcome: true,
        profitUnits: true,
        createdAt: true,
        gradedAt: true,
        legs: {
          orderBy: { createdAt: "asc" as const },
          select: {
            id: true,
            sport: true,
            league: true,
            market: true,
            selection: true,
            oddsAmerican: true,
            side: true,
            book: true,
            eventLabel: true,
            homeTeam: true,
            awayTeam: true,
            eventStartsAt: true,
            verificationTier: true,
            notes: true,
          },
        },
        capper: {
          select: { user: { select: { username: true } } },
        },
      },
    });

    const row = rows.find(
      (r) => r.capper.user.username && !hasQaNoteMarker(r.notes),
    );
    const parlayRow = parlayRows.find(
      (r) =>
        r.capper.user.username &&
        !r.legs.some((leg) => hasQaNoteMarker(leg.notes)),
    );
    // Newest graded wins the slot, whichever kind of position it is.
    const parlayWins =
      parlayRow != null &&
      (row == null ||
        (parlayRow.gradedAt?.getTime() ?? 0) > (row.gradedAt?.getTime() ?? 0));

    if (parlayWins && parlayRow?.capper.user.username) {
      const stake = stakeFromStored(parlayRow.units, parlayRow.profitUnits);
      const play: FeaturedGradedPlay = {
        id: parlayRow.id,
        sport: parlayDisplaySport(parlayRow.legs),
        league: null,
        market: "Parlay",
        selection: parlayTitle(parlayRow.legs.length),
        // No stored combined price stays an em-dash on the receipt, never a 0.
        oddsAmerican: parlayRow.combinedOddsAmerican ?? 0,
        units: stake.units,
        outcome: parlayRow.outcome,
        profitUnits: stake.profitUnits,
        createdAt: parlayRow.createdAt,
        verificationTier: parlayVerificationTier(parlayRow.legs),
        side: null,
        eventLabel: parlayGameLabel(parlayRow.legs),
        eventStartsAt: earliestLegStart(parlayRow.legs),
        book: parlayBookLabel(parlayRow.legs),
        notes: null,
        notesPublic: true,
        // A parlay spans several prices, so there is no single close to beat.
        closingOddsAmerican: null,
        clvPts: null,
        handle: parlayRow.capper.user.username,
        parlay: {
          combinedOddsAmerican: parlayRow.combinedOddsAmerican,
          legs: parlayRow.legs.map((leg) => ({
            id: leg.id,
            sport: leg.sport,
            market: leg.market,
            selection: leg.selection,
            oddsAmerican: leg.oddsAmerican,
            side: leg.side,
            book: leg.book,
            event: matchupLabel(leg),
          })),
        },
      };
      return { play, failed: false };
    }

    if (!row?.capper.user.username) return { play: null, failed: false };

    const stake = stakeFromStored(row.units, row.profitUnits);
    const play: FeaturedGradedPlay = {
      id: row.id,
      sport: row.sport,
      league: row.league,
      market: row.market,
      selection: row.selection,
      oddsAmerican: row.oddsAmerican,
      units: stake.units,
      outcome: row.outcome,
      profitUnits: stake.profitUnits,
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
