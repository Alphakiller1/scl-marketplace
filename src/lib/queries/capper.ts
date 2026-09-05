import "server-only";

import { cache } from "react";

import { cachedQuery } from "@/lib/cached-query";
import {
  leaderboardSlateInstant,
  parlayLeaderboardSlateInstant,
} from "@/lib/leaderboard";
import { summarizeClvTracker, type ClvTrackerSummary } from "@/lib/clv-tracker";
import { UNIT_MIN } from "@/lib/constants";
import { withTransientDatabaseRetry } from "@/lib/database-retry";
import { stakeFromStored } from "@/lib/extreme-stake";
import {
  assembleLegacySportTable,
  filterPlaysAfterLegacySnapshot,
  mergeCareerSportRecords,
  toLegacySportRecordView,
  type LegacySportRecordView,
} from "@/lib/legacy-sport-records";
import type { CapperSummary } from "@/lib/mock";
import {
  buildProfileChartSeries,
  type ProfileChartSeries,
} from "@/lib/profile-chart-window";
import {
  PROFILE_PERF_WINDOWS,
  buildProfileWindowStats,
  profilePerfWindowFilter,
  selectDefaultProfileWindow,
  type ProfilePerfWindow,
  type ProfilePosition,
  type ProfileWindowStats,
} from "@/lib/profile-performance-windows";
import { prisma } from "@/lib/prisma";
import { hasQaNoteMarker, isValidPublicStake } from "@/lib/public-eligibility";
import { prismaExcludeTestHandlesLive } from "@/lib/public-eligibility-prisma";
import { publicPickEmbargoState } from "@/lib/public-pick-embargo";
import { getPublicCapperEvidenceByIds } from "@/lib/queries/leaderboard";
import { parlayToRecordView } from "@/lib/parlay-record";
import type { PlayView } from "@/lib/queries/plays";
import { computeStatsBySport, type SportStats } from "@/lib/stats";
import {
  hasClvColumns,
  hasNotesPublicColumn,
} from "@/lib/results/schema-features";
import {
  getAllTimeLegacyBaseline,
  getYtdLegacyBaseline,
  legacySnapshotCapturedAt,
  profileLegacyRecordWhere,
} from "@/lib/legacy-all-time";
import { resolveLegacyHandleAlias } from "@/lib/legacy-handle-aliases";

export type PublicCapper = {
  capper: CapperSummary;
  plays: PlayView[];
  playsError: boolean;
  avgClv: number | null;
  clvTracker: ClvTrackerSummary;
  chartSeries?: ProfileChartSeries;
  chartSeriesBySport: Record<string, ProfileChartSeries>;
  historyNextCursor: string | null;
  /** Career by sport: old-site year pages + plays logged after the export. */
  legacyBySport: LegacySportRecordView[];
  /** Record, win%, ROI, units, sample and CLV for every scope. */
  windowStats: Record<ProfilePerfWindow, ProfileWindowStats>;
  /** Sport breakdown per scope, ready to render. */
  windowSportBreakdown: Record<ProfilePerfWindow, LegacySportRecordView[]>;
  /** CLV distribution per scope. */
  clvTrackerByWindow: Record<ProfilePerfWindow, ClvTrackerSummary>;
  /** Scope the profile opens on: best qualifying form, per the sample gate. */
  defaultWindow: ProfilePerfWindow;
};

export type PublicProfileHistoryPage = {
  plays: PlayView[];
  nextCursor: string | null;
};

const PROFILE_HISTORY_PAGE_SIZE = 10;
const PROFILE_HISTORY_FETCH_SIZE = PROFILE_HISTORY_PAGE_SIZE * 3;
const PROFILE_HISTORY_MAX_BATCHES = 16;
const PROFILE_CHART_QUERY_LIMIT = 5_000;

/**
 * Legs pulled per parlay, to place the ticket on a slate day.
 *
 * `createParlaySchema` caps a parlay at 12 legs, so this covers every ticket
 * the app can create. It is a bound rather than "all legs": without one, a
 * capper with thousands of parlays drags tens of thousands of leg rows through
 * the shared pool on a public page.
 */
const PARLAY_LEG_SCAN_LIMIT = 12;

/** Points per sport-filtered series; the all-sports series keeps the default. */
const PROFILE_SPORT_CHART_POINTS = 70;

/** Empty CLV distributions, so a failed CLV read still returns every scope. */
function emptyClvTrackerByWindow(): Record<
  ProfilePerfWindow,
  ClvTrackerSummary
> {
  return Object.fromEntries(
    PROFILE_PERF_WINDOWS.map(({ key }) => [key, summarizeClvTracker([])]),
  ) as Record<ProfilePerfWindow, ClvTrackerSummary>;
}

/**
 * Bounded public receipt page. A parlay is ONE position of record: its legs are
 * never rows of their own, so the parlay itself has to be listed or a capper who
 * posts only parlays shows an empty history while their chart and record move.
 */
type HistoryScan = { createdAt: Date; id: string };

/** Cursor is opaque to callers; it travels through a server action, never a URL. */
function encodeHistoryCursor(scan: HistoryScan): string {
  return `${scan.createdAt.toISOString()}|${scan.id}`;
}

async function decodeHistoryCursor(
  cursor: string | null | undefined,
): Promise<HistoryScan | null> {
  if (!cursor) return null;
  const split = cursor.indexOf("|");
  if (split > 0) {
    const createdAt = new Date(cursor.slice(0, split));
    const id = cursor.slice(split + 1);
    if (!Number.isNaN(createdAt.getTime()) && id) return { createdAt, id };
    return null;
  }
  // Legacy cursor: a bare Play id issued before parlays joined this ledger.
  // Resolve it so a page open across the deploy keeps paging instead of stalling.
  const row = await prisma.play.findUnique({
    where: { id: cursor },
    select: { id: true, createdAt: true },
  });
  return row ? { createdAt: row.createdAt, id: row.id } : null;
}

/** Keyset predicate for "strictly older than the scan position". */
function olderThan(scan: HistoryScan | null) {
  if (!scan) return {};
  return {
    OR: [
      { createdAt: { lt: scan.createdAt } },
      { createdAt: scan.createdAt, id: { lt: scan.id } },
    ],
  };
}

export async function getPublicProfileHistoryPage(
  handle: string,
  cursor?: string | null,
): Promise<PublicProfileHistoryPage> {
  const excludeTest = await prismaExcludeTestHandlesLive();
  const notesPublicReady = await hasNotesPublicColumn();
  const clvReady = await hasClvColumns();
  const visible: PlayView[] = [];
  let scan = await decodeHistoryCursor(cursor);
  let exhausted = false;

  const capperWhere = {
    user: {
      username: { equals: handle, mode: "insensitive" as const },
      accountStatus: "ACTIVE" as const,
      ...excludeTest,
    },
  };

  for (
    let batch = 0;
    batch < PROFILE_HISTORY_MAX_BATCHES &&
    visible.length <= PROFILE_HISTORY_PAGE_SIZE &&
    !exhausted;
    batch += 1
  ) {
    const [rows, parlayRows] = await Promise.all([
      prisma.play.findMany({
        where: {
          capper: capperWhere,
          units: { gte: UNIT_MIN },
          parlayId: null,
          ...olderThan(scan),
        },
        orderBy: [{ createdAt: "desc" }, { id: "desc" }],
        take: PROFILE_HISTORY_FETCH_SIZE,
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
      }),
      prisma.parlay.findMany({
        where: {
          capper: capperWhere,
          units: { gte: UNIT_MIN },
          ...olderThan(scan),
        },
        orderBy: [{ createdAt: "desc" }, { id: "desc" }],
        take: PROFILE_HISTORY_FETCH_SIZE,
        select: {
          id: true,
          combinedOddsAmerican: true,
          units: true,
          outcome: true,
          profitUnits: true,
          createdAt: true,
          legs: {
            orderBy: { createdAt: "asc" },
            select: {
              id: true,
              sport: true,
              market: true,
              selection: true,
              oddsAmerican: true,
              side: true,
              book: true,
              verificationTier: true,
              eventStartsAt: true,
              notes: true,
            },
          },
        },
      }),
    ]);
    if (rows.length === 0 && parlayRows.length === 0) {
      exhausted = true;
      break;
    }
    exhausted =
      rows.length < PROFILE_HISTORY_FETCH_SIZE &&
      parlayRows.length < PROFILE_HISTORY_FETCH_SIZE;

    const mappedPlays: PlayView[] = rows
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
          profitUnits: row.profitUnits == null ? null : Number(row.profitUnits),
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
      });

    const mappedParlays: PlayView[] = parlayRows
      // A parlay carries no notes of its own; a QA marker on any leg hides it.
      .filter((row) => !row.legs.some((leg) => hasQaNoteMarker(leg.notes)))
      .map((row) => {
        const view = parlayToRecordView(row);
        const embargo = publicPickEmbargoState(view);
        return {
          ...view,
          selection: embargo.isEmbargoed ? "Pick hidden" : view.selection,
          oddsAmerican: embargo.isEmbargoed ? 0 : view.oddsAmerican,
          parlayLegs: embargo.isEmbargoed ? [] : view.parlayLegs,
          ...embargo,
        };
      });

    const merged = [...mappedPlays, ...mappedParlays].sort((a, b) => {
      const delta = b.createdAt.getTime() - a.createdAt.getTime();
      if (delta !== 0) return delta;
      return a.id < b.id ? 1 : -1;
    });
    // Advance only to the OLDEST row consumed: anything older in the other
    // table is still ahead of the next scan, so nothing is skipped.
    const oldest = merged.at(-1);
    if (oldest) scan = { createdAt: oldest.createdAt, id: oldest.id };
    visible.push(...merged.filter((play) => isValidPublicStake(play.units)));
  }
  const plays = visible.slice(0, PROFILE_HISTORY_PAGE_SIZE);
  const mayHaveMore = visible.length > PROFILE_HISTORY_PAGE_SIZE || !exhausted;
  const last = plays.at(-1);

  return {
    plays,
    nextCursor: mayHaveMore
      ? last
        ? encodeHistoryCursor({ createdAt: last.createdAt, id: last.id })
        : scan
          ? encodeHistoryCursor(scan)
          : null
      : null,
  };
}

/** Public profile data with bounded receipt hydration and server-built chart series. */
const loadPublicCapperByHandle = cache(async function loadPublicCapperByHandle(
  handle: string,
): Promise<PublicCapper | null> {
  const requestedHandle = resolveLegacyHandleAlias(
    handle.replace(/^@+/, "").trim(),
  );
  const normalizedHandle = requestedHandle.toLowerCase();
  if (!normalizedHandle) return null;

  // Targeted lookup — never scan the full leaderboard for one profile.
  const profile = await withTransientDatabaseRetry(
    async () => {
      const excludeTest = await prismaExcludeTestHandlesLive();
      // Case-insensitive, so two rows can match: the roster carries handles
      // that differ only in capitals (@Parlaypluggy and @parlaypluggy are both
      // live accounts). `findFirst` picked one arbitrarily, which left the
      // other capper's profile unreachable at its own URL. Order by the exact
      // spelling first so each resolves to itself, and only fall back to a
      // folded match when nothing matches exactly.
      const matches = await prisma.capperProfile.findMany({
        where: {
          user: {
            username: { equals: normalizedHandle, mode: "insensitive" },
            accountStatus: "ACTIVE",
            ...excludeTest,
          },
        },
        select: { id: true, user: { select: { username: true } } },
        take: 5,
      });
      return (
        matches.find((match) => match.user.username === requestedHandle) ??
        matches.find(
          (match) => match.user.username?.toLowerCase() === normalizedHandle,
        ) ??
        matches[0] ??
        null
      );
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
  const clvTrackerByWindow = emptyClvTrackerByWindow();
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
        eventStartsAt: true,
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
        // sport-filtered charts; All-window ignores sport. Leg event times
        // come back too: the ticket sits on the day its last bound leg was
        // played, which is when it could settle.
        legs: {
          select: { sport: true, eventStartsAt: true },
          take: PARLAY_LEG_SCAN_LIMIT,
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
      select: {
        clvPts: true,
        notes: true,
        createdAt: true,
        eventStartsAt: true,
      },
    });
  });
  // Sport table: CURRENT_YEAR + prior years. Headline carry still comes
  // from getPublicCapperEvidenceByIds (PRE_IMPORT + years).
  const legacyResult = await settle("public profile legacy records", () =>
    prisma.legacyRecord.findMany({
      where: { capperId: capper.id, ...profileLegacyRecordWhere },
      select: {
        scope: true,
        sport: true,
        wins: true,
        losses: true,
        pushes: true,
        unitsRisked: true,
        unitsNet: true,
        capturedAt: true,
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

  // The carried export drives which scopes may show more than SCL receipts.
  const legacyRows =
    legacyResult.status === "fulfilled" ? legacyResult.value : [];
  const allTimeBaseline = getAllTimeLegacyBaseline(legacyRows);
  const ytdBaseline = getYtdLegacyBaseline(legacyRows);
  const legacySnapshotAt = legacySnapshotCapturedAt(legacyRows);
  const scopedNow = new Date();

  let chartRows: ProfilePosition[] = [];
  if (chartResult.status === "fulfilled") {
    const [straightRows, parlayRows] = chartResult.value;
    const straightChart = straightRows
      .filter((row) => !hasQaNoteMarker(row.notes))
      .map((row) => {
        const stake = stakeFromStored(row.units, row.profitUnits);
        return {
          createdAt: row.createdAt,
          // The board's own rule, not a second copy of it: two
          // implementations of "which day is this pick on" would drift, and
          // the profile agreeing with the leaderboard is the whole point.
          slateAt: leaderboardSlateInstant(row),
          outcome: row.outcome,
          profitUnits: stake.profitUnits,
          units: stake.units,
          sport: row.sport,
        } satisfies ProfilePosition;
      });
    const parlayChart = parlayRows.map((row) => {
      const stake = stakeFromStored(row.units, row.profitUnits);
      return {
        createdAt: row.createdAt,
        // Same rule the board uses: the last bound leg decides the day.
        slateAt: parlayLeaderboardSlateInstant(row),
        outcome: row.outcome,
        profitUnits: stake.profitUnits,
        units: stake.units,
        sport: row.legs[0]?.sport ?? "MULTI",
      } satisfies ProfilePosition;
    });
    chartRows = [...straightChart, ...parlayChart].sort(
      (a, b) => a.slateAt.getTime() - b.slateAt.getTime(),
    );

    // Each scope's chart End must match the units its metric row reports, so
    // both are built from these same positions and the same baselines.
    chartSeries = buildProfileChartSeries(chartRows, scopedNow, 120, {
      allUnits: allTimeBaseline?.units ?? capper.legacyBaselineUnits ?? 0,
      ytdUnits: ytdBaseline?.units ?? 0,
      legacySnapshotAt,
    });
    // Sport-filtered series stay receipt-only — legacy baselines are all-sports.
    //
    // Coarser than the headline series on purpose. Going from four scopes to
    // seven multiplied this payload by 1.75 (88 KB -> 154 KB worst case for a
    // capper across eight sports), on a public page that was already the
    // slowest to hydrate. At this resolution a full-width trend line still
    // gets a point every ~14px, and the budget stays where it was.
    const sports = [...new Set(chartRows.map((row) => row.sport))];
    chartSeriesBySport = Object.fromEntries(
      sports.map((sport) => [
        sport,
        buildProfileChartSeries(
          chartRows.filter((row) => row.sport === sport),
          scopedNow,
          PROFILE_SPORT_CHART_POINTS,
        ),
      ]),
    );
  } else {
    console.error(
      "[getPublicCapperByHandle] chart unavailable:",
      chartResult.reason,
    );
  }

  const windowStats = buildProfileWindowStats({
    positions: chartRows,
    now: scopedNow,
    allTimeBaseline,
    ytdBaseline,
    legacySnapshotAt,
  });
  const defaultWindow = selectDefaultProfileWindow(windowStats);

  if (clvResult.status === "fulfilled" && clvResult.value) {
    const clvRows = clvResult.value
      .filter((row) => !hasQaNoteMarker(row.notes))
      .map((row) => ({
        slateAt: leaderboardSlateInstant(row),
        clvPts: row.clvPts == null ? null : Number(row.clvPts),
      }))
      .filter(
        (row): row is { slateAt: Date; clvPts: number } =>
          row.clvPts != null && Number.isFinite(row.clvPts),
      );
    clvTracker = summarizeClvTracker(clvRows.map((row) => row.clvPts));
    avgClv = clvTracker.avgClv;

    // CLV sits in the same metric row, so it has to answer to the same scope.
    // It comes from its own query (verified tier only), which is why it is
    // overlaid here rather than carried on the positions.
    for (const key of Object.keys(windowStats) as ProfilePerfWindow[]) {
      const inWindow = profilePerfWindowFilter(key, scopedNow);
      const scoped = clvRows.filter((row) => inWindow(row.slateAt));
      windowStats[key].clvSampleCount = scoped.length;
      windowStats[key].avgClv = scoped.length
        ? scoped.reduce((sum, row) => sum + row.clvPts, 0) / scoped.length
        : null;
      clvTrackerByWindow[key] = summarizeClvTracker(
        scoped.map((row) => row.clvPts),
      );
    }
  } else if (clvResult.status === "rejected") {
    console.error(
      "[getPublicCapperByHandle] CLV unavailable:",
      clvResult.reason,
    );
  }

  const assembled =
    legacyResult.status === "fulfilled"
      ? assembleLegacySportTable(legacyResult.value)
      : { bySport: [], capturedAt: null };
  if (legacyResult.status === "rejected") {
    console.error(
      "[getPublicCapperByHandle] legacy sport records unavailable:",
      legacyResult.reason,
    );
  }
  const sclForTable = assembled.capturedAt
    ? computeStatsBySport(
        filterPlaysAfterLegacySnapshot(chartRows, assembled.capturedAt),
      )
    : sclBySport;
  legacyBySport = mergeCareerSportRecords({
    legacyBySport: assembled.bySport,
    allBaseline:
      assembled.capturedAt || legacyResult.status !== "fulfilled"
        ? null
        : getAllTimeLegacyBaseline(legacyResult.value),
    sclBySport: sclForTable,
  });

  // Career table stays the All Time view. Every rolling scope is receipt-only:
  // the carried rows are frozen aggregates with no per-pick dates.
  const sclToView = (rows: SportStats[]): LegacySportRecordView[] =>
    rows.map((row) =>
      toLegacySportRecordView({
        sport: row.sport,
        wins: row.wins,
        losses: row.losses,
        pushes: row.pushes,
        unitsRisked: row.stakedUnits,
        unitsNet: row.units,
      }),
    );

  // YTD keeps the old site's own by-sport year page beside the receipts logged
  // since the export, matching how its headline figure is built.
  const ytdAssembled = assembleLegacySportTable(
    legacyRows.filter((row) => row.scope === "CURRENT_YEAR"),
  );
  const ytdBySport = ytdBaseline
    ? mergeCareerSportRecords({
        legacyBySport: ytdAssembled.bySport,
        allBaseline: null,
        sclBySport: windowStats.ytd.bySport,
      })
    : sclToView(windowStats.ytd.bySport);

  const windowSportBreakdown = Object.fromEntries(
    (Object.keys(windowStats) as ProfilePerfWindow[]).map((key) => [
      key,
      key === "all"
        ? legacyBySport
        : key === "ytd"
          ? ytdBySport
          : sclToView(windowStats[key].bySport),
    ]),
  ) as Record<ProfilePerfWindow, LegacySportRecordView[]>;

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
    windowStats,
    windowSportBreakdown,
    clvTrackerByWindow,
    defaultWindow,
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
  ["public-capper-by-handle-v8"],
  { revalidate: 60, tags: ["leaderboard"] },
);

export const getPublicCapperByHandle = cache(
  async function getPublicCapperByHandle(
    handle: string,
  ): Promise<PublicCapper | null> {
    const normalized = resolveLegacyHandleAlias(handle).toLowerCase();
    if (!normalized) return null;
    return getCachedPublicCapperByHandle(normalized);
  },
);
