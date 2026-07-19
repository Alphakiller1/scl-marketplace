import "server-only";

import { cache } from "react";

import { summarizeClvTracker, type ClvTrackerSummary } from "@/lib/clv-tracker";
import { UNIT_MIN } from "@/lib/constants";
import type { CapperSummary } from "@/lib/mock";
import {
  buildProfileChartSeries,
  type ProfileChartSeries,
} from "@/lib/profile-chart-window";
import { prisma } from "@/lib/prisma";
import { hasQaNoteMarker, isValidPublicStake } from "@/lib/public-eligibility";
import { getLeaderboardResult } from "@/lib/queries/leaderboard";
import type { PlayView } from "@/lib/queries/plays";
import {
  hasClvColumns,
  hasNotesPublicColumn,
} from "@/lib/results/schema-features";

export type PublicCapper = {
  capper: CapperSummary;
  plays: PlayView[];
  playsError: boolean;
  avgClv: number | null;
  clvTracker: ClvTrackerSummary;
  chartSeries: ProfileChartSeries;
  historyNextCursor: string | null;
};

export type PublicProfileHistoryPage = {
  plays: PlayView[];
  nextCursor: string | null;
};

const PROFILE_HISTORY_PAGE_SIZE = 10;
const PROFILE_HISTORY_FETCH_SIZE = PROFILE_HISTORY_PAGE_SIZE * 3;

/** Bounded public receipt page; parlay legs are never positions of record. */
export async function getPublicProfileHistoryPage(
  handle: string,
  cursor?: string | null,
): Promise<PublicProfileHistoryPage> {
  const notesPublicReady = await hasNotesPublicColumn();
  const clvReady = await hasClvColumns();
  const rows = await prisma.play.findMany({
    where: {
      capper: { user: { username: handle, accountStatus: "ACTIVE" } },
      units: { gte: UNIT_MIN },
      parlayId: null,
    },
    orderBy: [{ createdAt: "desc" }, { id: "desc" }],
    take: PROFILE_HISTORY_FETCH_SIZE,
    ...(cursor ? { cursor: { id: cursor }, skip: 1 } : {}),
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
      eventStartsAt: true,
      book: true,
      notes: true,
      ...(notesPublicReady ? { notesPublic: true } : {}),
      ...(clvReady ? { closingOddsAmerican: true, clvPts: true } : {}),
    },
  });
  const visible = rows
    .filter((row) => !hasQaNoteMarker(row.notes))
    .map((row) => ({
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
      verificationTier: row.verificationTier,
      side: row.side,
      eventStartsAt: row.eventStartsAt,
      book: row.book,
      notes:
        "notesPublic" in row &&
        (row as { notesPublic?: boolean }).notesPublic === false
          ? null
          : row.notes,
      notesPublic:
        "notesPublic" in row
          ? ((row as { notesPublic?: boolean }).notesPublic ?? true)
          : true,
      closingOddsAmerican:
        "closingOddsAmerican" in row
          ? ((row as { closingOddsAmerican?: number | null })
              .closingOddsAmerican ?? null)
          : null,
      clvPts:
        "clvPts" in row && (row as { clvPts?: unknown }).clvPts != null
          ? Number((row as { clvPts: unknown }).clvPts)
          : null,
    }))
    .filter((play) => isValidPublicStake(play.units));
  const plays = visible.slice(0, PROFILE_HISTORY_PAGE_SIZE);
  const mayHaveMore =
    visible.length > PROFILE_HISTORY_PAGE_SIZE ||
    rows.length === PROFILE_HISTORY_FETCH_SIZE;

  return {
    plays,
    nextCursor: mayHaveMore
      ? (plays.at(-1)?.id ?? rows.at(-1)?.id ?? null)
      : null,
  };
}

/** Public profile data with bounded receipt hydration and server-built chart series. */
export const getPublicCapperByHandle = cache(
  async function getPublicCapperByHandle(
    handle: string,
  ): Promise<PublicCapper | null> {
    const { cappers, unranked } = await getLeaderboardResult();
    const capper =
      cappers.find((candidate) => candidate.handle === handle) ??
      unranked.find((candidate) => candidate.handle === handle);
    if (!capper) return null;

    let plays: PlayView[] = [];
    let playsError = false;
    let avgClv: number | null = null;
    let clvTracker = summarizeClvTracker([]);
    let chartSeries = buildProfileChartSeries([], new Date());
    let historyNextCursor: string | null = null;

    try {
      const clvReady = await hasClvColumns();
      const [history, chartRows] = await Promise.all([
        getPublicProfileHistoryPage(handle),
        prisma.play.findMany({
          where: {
            capperId: capper.id,
            units: { gte: UNIT_MIN },
            parlayId: null,
            outcome: { not: "PENDING" },
          },
          orderBy: [{ createdAt: "asc" }, { id: "asc" }],
          select: {
            createdAt: true,
            outcome: true,
            profitUnits: true,
            notes: true,
          },
        }),
      ]);
      plays = history.plays;
      historyNextCursor = history.nextCursor;
      chartSeries = buildProfileChartSeries(
        chartRows
          .filter((row) => !hasQaNoteMarker(row.notes))
          .map((row) => ({
            createdAt: row.createdAt,
            outcome: row.outcome,
            profitUnits:
              row.profitUnits == null ? null : Number(row.profitUnits),
          })),
        new Date(),
      );

      if (clvReady) {
        const clvRows = await prisma.play.findMany({
          where: {
            capperId: capper.id,
            clvPts: { not: null },
            verificationTier: { in: ["VERIFIED", "AUTO_VERIFIED"] },
            outcome: { not: "PENDING" },
            parlayId: null,
            units: { gte: UNIT_MIN },
          },
          select: { clvPts: true, notes: true },
        });
        const points = clvRows
          .filter((row) => !hasQaNoteMarker(row.notes))
          .map((row) => (row.clvPts == null ? null : Number(row.clvPts)))
          .filter(
            (value): value is number => value != null && Number.isFinite(value),
          );
        clvTracker = summarizeClvTracker(points);
        avgClv = clvTracker.avgClv;
      }
    } catch (error) {
      console.error("[getPublicCapperByHandle] plays unavailable:", error);
      playsError = true;
    }

    return {
      capper,
      plays,
      playsError,
      avgClv,
      clvTracker,
      chartSeries,
      historyNextCursor,
    };
  },
);
