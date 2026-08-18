import "server-only";

import { cache } from "react";

import { cachedQuery } from "@/lib/cached-query";
import { summarizeClvTracker, type ClvTrackerSummary } from "@/lib/clv-tracker";
import { UNIT_MIN } from "@/lib/constants";
import { withTransientDatabaseRetry } from "@/lib/database-retry";
import { stakeFromStored } from "@/lib/extreme-stake";
import {
  mergeCareerSportRecords,
  sortLegacySportRecords,
  type LegacySportRecordView,
} from "@/lib/legacy-sport-records";
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
import { LEGACY_RECORD_ALL_SPORTS } from "@/lib/schemas/legacy-records.schema";

export type PublicCapper = {
  capper: CapperSummary;
  plays: PlayView[];
  playsError: boolean;
  avgClv: number | null;
  clvTracker: ClvTrackerSummary;
  chartSeries?: ProfileChartSeries;
  chartSeriesBySport: Record<string, ProfileChartSeries>;
  historyNextCursor: string | null;
  /** Career by sport: PRE_IMPORT per sport + SCL-logged positions. */
  legacyBySport: LegacySportRecordView[];
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
        homeTeam: true,
        awayTeam: true,
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
          const stake = stakeFromStored(row.units, row.profitUnits);
          return {
            id: row.id,
            sport: row.sport,
            league: row.league,
            market: row.market,
            selection: embargo.isEmbargoed ? "Pick hidden" : row.selection,
            oddsAmerican: embargo.isEmbargoed ? 0 : row.oddsAmerican,
            units: stake.units,
            outcome: row.outcome,
            profitUnits: stake.profitUnits,
            createdAt: row.createdAt,
            verificationTier: row.verificationTier,
            side: embargo.isEmbargoed ? null : row.side,
            eventStartsAt: row.eventStartsAt,
            // Which game, not which side of it — disclosed on the same terms as
            // eventLabel, which an embargoed row already carries.
            eventLabel: row.eventLabel,
            homeTeam: row.homeTeam,
            awayTeam: row.awayTeam,
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
const loadPublicCapperByHandle = cache(async function loadPublicCapperByHandle(
  handle: string,
): Promise<PublicCapper | null> {
  const normalizedHandle = handle.replace(/^@+/, "").trim().toLowerCase();
  if (!normalizedHandle) return null;

  // Targeted lookup — never scan the full leaderboard for one profile.
  const profile = await withTransientDatabaseRetry(
    async () => {
      const excludeTest = await prismaExcludeTestHandlesLive();
      return prisma.capperProfile.findFirst({
        where: {
          user: {
            username: { equals: normalizedHandle, mode: "insensitive" },
            accountStatus: "ACTIVE",
            ...excludeTest,
          },
        },
        select: { id: true, user: { select: { username: true } } },
      });
    },
    { label: `public profile identity @${normalizedHandle}` },
  );
  if (!profile?.user.username) return null;

  const {
    cappers,
    failed: evidenceFailed,
    sclBySportByCapperId = {},
  } = await getPublicCapperEvidenceByIds([profile.id]);
  const capper = cappers[0];
  if (!capper) {
    // A temporary database failure is not evidence that a public capper does
    // not exist. Returning null here lets unstable_cache persist a false 404
    // for a real leaderboard link. Throw instead so the failed result is never
    // cached and the next request can recover normally.
    if (evidenceFailed) {
      throw new Error(
        `[getPublicCapperByHandle] evidence unavailable for @${normalizedHandle}`,
      );
    }
    return null;
  }
  const sclBySport = sclBySportByCapperId[capper.id] ?? [];

  let plays: PlayView[] = [];
  let playsError = false;
  let avgClv: number | null = null;
  let clvTracker = summarizeClvTracker([]);
  let chartSeries: ProfileChartSeries | undefined;
  let chartSeriesBySport: Record<string, ProfileChartSeries> = {};
  let historyNextCursor: string | null = null;
  let legacyBySport: LegacySportRecordView[] = [];

  async function settle<T>(label: string, operation: () => Promise<T>) {
    try {
      return {
        status: "fulfilled",
        value: await withTransientDatabaseRetry(operation, { label }),
      } as const;
    } catch (reason) {
      return { status: "rejected", reason } as const;
    }
  }

  // Keep one profile's heavier optional reads sequential so Fluid Compute can
  // reserve the rest of the shared pool for concurrent public requests.
  const historyResult = await settle("public profile history", () =>
    getPublicProfileHistoryPage(capper.handle),
  );
  const chartResult = await settle("public profile chart", async () => {
    // Straight picks + whole parlays — same positions of record the
    // Evidence Brief / leaderboard units aggregate uses.
    const straightRows = await prisma.play.findMany({
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
        units: true,
        profitUnits: true,
        sport: true,
        notes: true,
      },
    });
    const parlayRows = await prisma.parlay.findMany({
      where: {
        capperId: capper.id,
        units: { gte: UNIT_MIN },
        outcome: { not: "PENDING" },
      },
      orderBy: [{ createdAt: "desc" }, { id: "desc" }],
      take: PROFILE_CHART_QUERY_LIMIT,
      select: {
        createdAt: true,
        outcome: true,
        units: true,
        profitUnits: true,
        // Parlay has no sport column — attribute to the first leg for
        // sport-filtered charts; All-window ignores sport.
        legs: {
          select: { sport: true },
          take: 1,
          orderBy: { id: "asc" },
        },
      },
    });
    return [straightRows, parlayRows] as const;
  });
  const clvResult = await settle("public profile CLV", async () => {
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
  });
  // Per-sport PRE_IMPORT residuals (ALL excluded in sort helper).
  const legacyResult = await settle("public profile legacy records", () =>
    prisma.legacyRecord.findMany({
      where: { capperId: capper.id, scope: "PRE_IMPORT" },
      select: {
        sport: true,
        wins: true,
        losses: true,
        pushes: true,
        unitsRisked: true,
        unitsNet: true,
      },
    }),
  );

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
    const [straightRows, parlayRows] = chartResult.value;
    const straightChart = straightRows
      .filter((row) => !hasQaNoteMarker(row.notes))
      .map((row) => {
        const stake = stakeFromStored(row.units, row.profitUnits);
        return {
          createdAt: row.createdAt,
          outcome: row.outcome,
          profitUnits: stake.profitUnits,
          units: stake.units,
          sport: row.sport,
        };
      });
    const parlayChart = parlayRows.map((row) => {
      const stake = stakeFromStored(row.units, row.profitUnits);
      return {
        createdAt: row.createdAt,
        outcome: row.outcome,
        profitUnits: stake.profitUnits,
        units: stake.units,
        sport: row.legs[0]?.sport ?? "MULTI",
      };
    });
    const chartRows = [...straightChart, ...parlayChart].sort(
      (a, b) => a.createdAt.getTime() - b.createdAt.getTime(),
    );
    const chartNow = new Date();
    // All-window chart End must match Evidence Brief units (legacy + SCL).
    // Sport-filtered series stay receipt-only — legacy baseline is all-sports.
    const legacyBaseline = capper.legacyBaselineUnits ?? 0;
    chartSeries = buildProfileChartSeries(
      chartRows,
      chartNow,
      120,
      legacyBaseline,
    );
    const sports = [...new Set(chartRows.map((row) => row.sport))];
    chartSeriesBySport = Object.fromEntries(
      sports.map((sport) => [
        sport,
        buildProfileChartSeries(
          chartRows.filter((row) => row.sport === sport),
          chartNow,
        ),
      ]),
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

  const legacyRows =
    legacyResult.status === "fulfilled"
      ? legacyResult.value.map((row) => ({
          sport: row.sport,
          wins: row.wins,
          losses: row.losses,
          pushes: row.pushes,
          unitsRisked: Number(row.unitsRisked),
          unitsNet: Number(row.unitsNet),
        }))
      : [];
  if (legacyResult.status === "rejected") {
    console.error(
      "[getPublicCapperByHandle] legacy sport records unavailable:",
      legacyResult.reason,
    );
  }
  const combined = legacyRows.find(
    (row) => row.sport === LEGACY_RECORD_ALL_SPORTS,
  );
  legacyBySport = mergeCareerSportRecords({
    legacyBySport: sortLegacySportRecords(legacyRows),
    allBaseline: combined
      ? {
          wins: combined.wins,
          losses: combined.losses,
          pushes: combined.pushes,
          stakedUnits: combined.unitsRisked,
          units: combined.unitsNet,
        }
      : null,
    sclBySport,
  });

  return {
    capper,
    plays,
    playsError,
    avgClv,
    clvTracker,
    chartSeries,
    chartSeriesBySport,
    historyNextCursor,
    legacyBySport,
  };
});

/**
 * Cross-request cache for the public profile.
 *
 * React `cache()` above only dedupes within a single render, so every visitor
 * to a capper's profile paid the full fan-out again — six awaits against a
 * five-connection pool, which is why profiles were the slowest public page on a
 * cold isolate. Every other public surface (leaderboard, discover, league
 * action) already caches for 60s; profiles were simply missed.
 *
 * Tagged `leaderboard` so the same revalidation that publishes a new grade also
 * refreshes the profile that shows it — a graded pick must not sit behind a
 * stale profile for a minute.
 *
 * Goes through `cachedQuery`, not `unstable_cache` directly: this payload
 * carries Dates (`capper.lastPlayAt`, `capper.joinedAt`, every play's
 * `createdAt`/`eventStartsAt`) and the JSON cache returns those as strings.
 */
const getCachedPublicCapperByHandle = cachedQuery(
  async (handle: string) => loadPublicCapperByHandle(handle),
  // v2 intentionally abandons partial profile payloads cached before metadata
  // stopped launching a competing full hydration on cold requests.
  ["public-capper-by-handle-v3"],
  { revalidate: 60, tags: ["leaderboard"] },
);

export const getPublicCapperByHandle = cache(
  async function getPublicCapperByHandle(
    handle: string,
  ): Promise<PublicCapper | null> {
    const normalized = handle.replace(/^@+/, "").trim().toLowerCase();
    if (!normalized) return null;
    return getCachedPublicCapperByHandle(normalized);
  },
);
