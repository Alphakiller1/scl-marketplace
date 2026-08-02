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
import { prismaExcludeTestHandlesLive } from "@/lib/public-eligibility-prisma";
import { publicPickEmbargoState } from "@/lib/public-pick-embargo";
import { getPublicCapperEvidenceByIds } from "@/lib/queries/leaderboard";
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
  chartSeries?: ProfileChartSeries;
  historyNextCursor: string | null;
};

export type PublicProfileHistoryPage = {
  plays: PlayView[];
  nextCursor: string | null;
};

const PROFILE_HISTORY_PAGE_SIZE = 10;
const PROFILE_HISTORY_FETCH_SIZE = PROFILE_HISTORY_PAGE_SIZE * 3;
const PROFILE_HISTORY_MAX_BATCHES = 16;
const PROFILE_CHART_QUERY_LIMIT = 5_000;

/** Bounded public receipt page; parlay legs are never positions of record. */
export async function getPublicProfileHistoryPage(
  handle: string,
  cursor?: string | null,
): Promise<PublicProfileHistoryPage> {
  const excludeTest = await prismaExcludeTestHandlesLive();
  const notesPublicReady = await hasNotesPublicColumn();
  const clvReady = await hasClvColumns();
  const visible: PlayView[] = [];
  let scanCursor = cursor ?? null;
  let exhausted = false;

  for (
    let batch = 0;
    batch < PROFILE_HISTORY_MAX_BATCHES &&
    visible.length <= PROFILE_HISTORY_PAGE_SIZE &&
    !exhausted;
    batch += 1
  ) {
    const rows = await prisma.play.findMany({
      where: {
        capper: {
          user: {
            username: { equals: handle, mode: "insensitive" },
            accountStatus: "ACTIVE",
            ...excludeTest,
          },
        },
        units: { gte: UNIT_MIN },
        parlayId: null,
      },
      orderBy: [{ createdAt: "desc" }, { id: "desc" }],
      take: PROFILE_HISTORY_FETCH_SIZE,
      ...(scanCursor ? { cursor: { id: scanCursor }, skip: 1 } : {}),
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
        eventLabel: true,
        book: true,
        notes: true,
        ...(notesPublicReady ? { notesPublic: true } : {}),
        ...(clvReady ? { closingOddsAmerican: true, clvPts: true } : {}),
      },
    });
    if (rows.length === 0) {
      exhausted = true;
      break;
    }
    scanCursor = rows.at(-1)?.id ?? scanCursor;
    exhausted = rows.length < PROFILE_HISTORY_FETCH_SIZE;
    visible.push(
      ...rows
        .filter((row) => !hasQaNoteMarker(row.notes))
        .map((row) => {
          const embargo = publicPickEmbargoState(row);
          return {
            id: row.id,
            sport: row.sport,
            league: row.league,
            market: row.market,
            selection: embargo.isEmbargoed ? "Pick hidden" : row.selection,
            oddsAmerican: embargo.isEmbargoed ? 0 : row.oddsAmerican,
            units: Number(row.units),
            outcome: row.outcome,
            profitUnits:
              row.profitUnits == null ? null : Number(row.profitUnits),
            createdAt: row.createdAt,
            verificationTier: row.verificationTier,
            side: embargo.isEmbargoed ? null : row.side,
            eventStartsAt: row.eventStartsAt,
            eventLabel: row.eventLabel,
            book: embargo.isEmbargoed ? null : row.book,
            notes:
              embargo.isEmbargoed ||
              ("notesPublic" in row &&
                (row as { notesPublic?: boolean }).notesPublic === false)
                ? null
                : row.notes,
            notesPublic:
              "notesPublic" in row
                ? ((row as { notesPublic?: boolean }).notesPublic ?? true)
                : true,
            closingOddsAmerican:
              embargo.isEmbargoed || !("closingOddsAmerican" in row)
                ? null
                : ((row as { closingOddsAmerican?: number | null })
                    .closingOddsAmerican ?? null),
            clvPts:
              embargo.isEmbargoed ||
              !("clvPts" in row) ||
              (row as { clvPts?: unknown }).clvPts == null
                ? null
                : Number((row as { clvPts: unknown }).clvPts),
            ...embargo,
          };
        })
        .filter((play) => isValidPublicStake(play.units)),
    );
  }
  const plays = visible.slice(0, PROFILE_HISTORY_PAGE_SIZE);
  const mayHaveMore = visible.length > PROFILE_HISTORY_PAGE_SIZE || !exhausted;

  return {
    plays,
    nextCursor: mayHaveMore ? (plays.at(-1)?.id ?? scanCursor) : null,
  };
}

/** Public profile data with bounded receipt hydration and server-built chart series. */
export const getPublicCapperByHandle = cache(
  async function getPublicCapperByHandle(
    handle: string,
  ): Promise<PublicCapper | null> {
    const normalizedHandle = handle.replace(/^@+/, "").trim().toLowerCase();
    if (!normalizedHandle) return null;

    // Targeted lookup — never scan the full leaderboard for one profile.
    const excludeTest = await prismaExcludeTestHandlesLive();
    const profile = await prisma.capperProfile.findFirst({
      where: {
        user: {
          username: { equals: normalizedHandle, mode: "insensitive" },
          accountStatus: "ACTIVE",
          ...excludeTest,
        },
      },
      select: { id: true, user: { select: { username: true } } },
    });
    if (!profile?.user.username) return null;

    const { cappers, failed: evidenceFailed } =
      await getPublicCapperEvidenceByIds([profile.id]);
    const capper = cappers[0];
    if (!capper) {
      if (evidenceFailed) return null;
      return null;
    }

    let plays: PlayView[] = [];
    let playsError = false;
    let avgClv: number | null = null;
    let clvTracker = summarizeClvTracker([]);
    let chartSeries: ProfileChartSeries | undefined;
    let historyNextCursor: string | null = null;

    const [historyResult, chartResult, clvResult] = await Promise.allSettled([
      getPublicProfileHistoryPage(capper.handle),
      prisma.play.findMany({
        where: {
          capperId: capper.id,
          units: { gte: UNIT_MIN },
          parlayId: null,
          outcome: { not: "PENDING" },
        },
        orderBy: [{ createdAt: "desc" }, { id: "desc" }],
        take: PROFILE_CHART_QUERY_LIMIT,
        select: {
          createdAt: true,
          outcome: true,
          profitUnits: true,
          notes: true,
        },
      }),
      (async () => {
        const clvReady = await hasClvColumns();
        if (!clvReady) return null;
        return prisma.play.findMany({
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
      })(),
    ]);

    if (historyResult.status === "fulfilled") {
      plays = historyResult.value.plays;
      historyNextCursor = historyResult.value.nextCursor;
    } else {
      console.error(
        "[getPublicCapperByHandle] history unavailable:",
        historyResult.reason,
      );
      playsError = true;
    }

    if (chartResult.status === "fulfilled") {
      chartSeries = buildProfileChartSeries(
        chartResult.value
          .filter((row) => !hasQaNoteMarker(row.notes))
          .map((row) => ({
            createdAt: row.createdAt,
            outcome: row.outcome,
            profitUnits:
              row.profitUnits == null ? null : Number(row.profitUnits),
          }))
          .reverse(),
        new Date(),
      );
    } else {
      console.error(
        "[getPublicCapperByHandle] chart unavailable:",
        chartResult.reason,
      );
    }

    if (clvResult.status === "fulfilled" && clvResult.value) {
      const points = clvResult.value
        .filter((row) => !hasQaNoteMarker(row.notes))
        .map((row) => (row.clvPts == null ? null : Number(row.clvPts)))
        .filter(
          (value): value is number => value != null && Number.isFinite(value),
        );
      clvTracker = summarizeClvTracker(points);
      avgClv = clvTracker.avgClv;
    } else if (clvResult.status === "rejected") {
      console.error(
        "[getPublicCapperByHandle] CLV unavailable:",
        clvResult.reason,
      );
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
