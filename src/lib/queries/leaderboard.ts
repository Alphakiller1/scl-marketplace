import "server-only";

import { cache } from "react";
import type { Outcome } from "@prisma/client";

import { cachedQuery } from "@/lib/cached-query";
import { withTransientDatabaseRetry } from "@/lib/database-retry";
import { prisma } from "@/lib/prisma";
import {
  buildPerformanceTrend,
  DEFAULT_LEADERBOARD_LIMIT,
  leaderboardWindowBounds,
  partitionLeaderboard,
  type LeaderboardFilters,
} from "@/lib/leaderboard";
import { UNIT_MIN } from "@/lib/constants";
import { hasQaNoteMarker } from "@/lib/public-eligibility";
import { prismaExcludeTestHandlesLive } from "@/lib/public-eligibility-prisma";
import { computeCapperStats, type StatsBaseline } from "@/lib/stats";
import { computeVerifiedShare } from "@/lib/verification";
import type { CapperSummary, FormResult } from "@/lib/mock";
import { resolveStorefrontIdentity } from "@/lib/storefront";
import {
  computeCapperActivity,
  publicCapperActivityCutoff,
} from "@/lib/capper-activity";
import { hasClvColumns } from "@/lib/results/schema-features";
import { activePublicPackageWhere } from "@/lib/public-packages";

/**
 * Live leaderboard data — computed from real plays, never fabricated. Only
 * cappers with a public handle (User.username) are ranked. When the database
 * is empty the board is empty (honest); pages render an empty state, not mock.
 */

const DEFAULT_FILTERS: LeaderboardFilters = {
  sport: "ALL",
  window: "all",
  sort: "units",
  direction: "desc",
  minPicks: 0,
  verifiedOnly: false,
  search: "",
  limit: DEFAULT_LEADERBOARD_LIMIT,
};

async function fetchRankableProfiles(
  filters: LeaderboardFilters,
  clvReady: boolean,
  capperIds?: string[],
) {
  const { start: windowStart, end: windowEnd } = leaderboardWindowBounds(
    filters.window,
  );
  const positionWindow =
    filters.window === "1d" && windowStart && windowEnd
      ? { gradedAt: { gte: windowStart, lt: windowEnd } }
      : windowStart
        ? { createdAt: { gte: windowStart } }
        : undefined;
  const activityCutoff = publicCapperActivityCutoff();
  const excludeTest = await prismaExcludeTestHandlesLive();

  return prisma.capperProfile.findMany({
    where: {
      ...(capperIds ? { id: { in: capperIds } } : undefined),
      ...(capperIds
        ? {}
        : {
            OR: [
              { plays: { some: { createdAt: { gte: activityCutoff } } } },
              { parlays: { some: { createdAt: { gte: activityCutoff } } } },
            ],
          }),
      user: {
        username: { not: null },
        accountStatus: "ACTIVE",
        ...excludeTest,
        ...(filters.verifiedOnly
          ? { emailVerified: { not: null } }
          : undefined),
        ...(filters.search
          ? {
              username: {
                contains: filters.search,
                mode: "insensitive" as const,
              },
            }
          : undefined),
      },
    },
    select: {
      id: true,
      avatarUrl: true,
      bannerUrl: true,
      headline: true,
      bio: true,
      specialties: true,
      storefrontTitle: true,
      storefrontDescription: true,
      storefrontEnabled: true,
      isLegacy: true,
      sports: true,
      books: true,
      createdAt: true,
      user: {
        select: { username: true, emailVerified: true },
      },
      plays: {
        where: {
          // Parlay legs are display-only components of their parent; the parlay is the
          // position of record. Excluding legs here keeps record/units/ROI from
          // double-counting once parlays land (parlay rows are added to stats then).
          parlayId: null,
          units: { gte: UNIT_MIN },
          ...(filters.sport !== "ALL" ? { sport: filters.sport } : undefined),
          ...positionWindow,
        },
        select: {
          outcome: true,
          units: true,
          profitUnits: true,
          sport: true,
          createdAt: true,
          gradedAt: true,
          verificationTier: true,
          notes: true,
          ...(clvReady ? { clvPts: true } : {}),
        },
        orderBy: { createdAt: "asc" },
      },
      // Results carried over from the previous SCL platform. Only the
      // PRE_IMPORT scope is fetched: it is the legacy season total with the
      // imported plays already subtracted, so adding it to the computed stats
      // can never double-count the ~90 days that exist in both.
      legacyRecords: {
        where: {
          scope: "PRE_IMPORT",
          sport: filters.sport === "ALL" ? "ALL" : filters.sport,
        },
        select: {
          wins: true,
          losses: true,
          pushes: true,
          unitsRisked: true,
          unitsNet: true,
        },
        take: 1,
      },
      packages: {
        where: activePublicPackageWhere,
        orderBy: [{ sortOrder: "asc" }, { createdAt: "asc" }],
        select: {
          title: true,
          trackingUrls: {
            select: { slug: true },
            orderBy: { createdAt: "asc" },
            take: 1,
          },
        },
      },
      // Parlays are positions of record alongside straight plays. A parlay matches a
      // sport filter when any leg is that sport.
      parlays: {
        where: {
          ...positionWindow,
          units: { gte: UNIT_MIN },
          ...(filters.sport !== "ALL"
            ? { legs: { some: { sport: filters.sport } } }
            : undefined),
        },
        select: {
          outcome: true,
          units: true,
          profitUnits: true,
          createdAt: true,
          gradedAt: true,
        },
        orderBy: { createdAt: "asc" },
      },
    },
  });
}

type ProfileRow = Awaited<ReturnType<typeof fetchRankableProfiles>>[number];

/** Graded positions per capper across their whole record, window ignored. */
type LifetimeGradedByCapper = Map<string, number>;

const SETTLED_OUTCOMES: Outcome[] = ["WIN", "LOSS", "PUSH"];

/**
 * How many graded positions each capper has ever had.
 *
 * The main profile query filters plays to the selected window, so the count it
 * produces cannot answer "does this capper have a track record" — under a 1D
 * filter it reports how many picks graded yesterday. Two grouped counts are
 * cheap, run once per board rather than per capper, and keep the windowed
 * figures on the row exactly as they were.
 *
 * Legacy carried results are added per capper in `summarize`, since those live
 * on the profile rows already fetched.
 */
async function fetchLifetimeGraded(
  capperIds: string[],
): Promise<LifetimeGradedByCapper> {
  const totals: LifetimeGradedByCapper = new Map();
  if (capperIds.length === 0) return totals;

  const [plays, parlays] = await Promise.all([
    prisma.play.groupBy({
      by: ["capperId"],
      where: {
        capperId: { in: capperIds },
        parlayId: null,
        units: { gte: UNIT_MIN },
        outcome: { in: SETTLED_OUTCOMES },
      },
      _count: { _all: true },
    }),
    prisma.parlay.groupBy({
      by: ["capperId"],
      where: {
        capperId: { in: capperIds },
        units: { gte: UNIT_MIN },
        outcome: { in: SETTLED_OUTCOMES },
      },
      _count: { _all: true },
    }),
  ]);

  for (const row of [...plays, ...parlays]) {
    totals.set(row.capperId, (totals.get(row.capperId) ?? 0) + row._count._all);
  }
  return totals;
}

function topSport(sports: string[], fallback?: string): string {
  if (sports.length === 0) return fallback ?? "—";
  const counts = new Map<string, number>();
  for (const s of sports) counts.set(s, (counts.get(s) ?? 0) + 1);
  return [...counts.entries()].sort((a, b) => b[1] - a[1])[0][0];
}

/** Recent form + current streak from settled outcomes, oldest → newest. */
function deriveForm(settled: Outcome[]): {
  recentForm: FormResult[];
  streak: number;
} {
  const forms = settled.map((o) =>
    o === "WIN" ? "W" : o === "LOSS" ? "L" : "P",
  ) as FormResult[];

  let streak = 0;
  for (let i = forms.length - 1; i >= 0; i--) {
    const f = forms[i];
    if (f === "P") continue; // a push is neutral — skip it, don't break the streak
    if (streak === 0) streak = f === "W" ? 1 : -1;
    else if (streak > 0 && f === "W") streak++;
    else if (streak < 0 && f === "L") streak--;
    else break;
  }

  return { recentForm: forms.slice(-6), streak };
}

/**
 * Carried-over totals only apply to the all-time board. The trailing windows
 * (7d/30d/90d) are about current form, and the legacy figures are a frozen
 * snapshot from the export date — folding them into a rolling window would
 * make a capper's "past 7 days" grow stale results it never earned that week.
 */
function baselineFor(
  p: ProfileRow,
  applyBaseline: boolean,
): StatsBaseline | null {
  if (!applyBaseline) return null;
  const rec = p.legacyRecords[0];
  if (!rec) return null;
  return {
    wins: rec.wins,
    losses: rec.losses,
    pushes: rec.pushes,
    stakedUnits: Number(rec.unitsRisked),
    units: Number(rec.unitsNet),
  };
}

function summarize(
  p: ProfileRow,
  applyBaseline: boolean,
  lifetimeGradedPositions?: LifetimeGradedByCapper,
): CapperSummary | null {
  const username = p.user.username;
  if (!username) return null;

  // Drop QA-noted plays so a stray test note never counts toward a public
  // record, units, ROI, or CLV. The capper's private dashboard is unfiltered.
  const plays = p.plays.filter((pl) => !hasQaNoteMarker(pl.notes));

  // Straight plays + parlays are the capper's positions of record (legs are already
  // excluded from plays). Merge them, oldest → newest, for all aggregations.
  const positions = [
    ...plays.map((pl) => ({
      outcome: pl.outcome,
      units: Number(pl.units),
      profitUnits: pl.profitUnits == null ? null : Number(pl.profitUnits),
      createdAt: pl.createdAt,
      gradedAt: pl.gradedAt,
    })),
    ...p.parlays.map((pa) => ({
      outcome: pa.outcome,
      units: Number(pa.units),
      profitUnits: pa.profitUnits == null ? null : Number(pa.profitUnits),
      createdAt: pa.createdAt,
      gradedAt: pa.gradedAt,
    })),
  ].sort((a, b) => a.createdAt.getTime() - b.createdAt.getTime());

  const legacyBaseline = baselineFor(p, applyBaseline);
  const stats = computeCapperStats(
    positions.map((x) => ({
      outcome: x.outcome,
      units: x.units,
      profitUnits: x.profitUnits,
    })),
    legacyBaseline,
  );
  // Form, streak and trend stay play-derived. The legacy export carries totals
  // only — no per-pick sequence — so seeding them here would be inventing a
  // shape the source data never had.
  const performanceTrend = buildPerformanceTrend(
    positions.map((x) => ({ outcome: x.outcome, profitUnits: x.profitUnits })),
  );

  const settled = positions
    .filter(
      (x) =>
        x.outcome === "WIN" || x.outcome === "LOSS" || x.outcome === "PUSH",
    )
    .sort(
      (a, b) =>
        (a.gradedAt ?? a.createdAt).getTime() -
        (b.gradedAt ?? b.createdAt).getTime(),
    )
    .map((x) => x.outcome);
  const { recentForm, streak } = deriveForm(settled);

  const displayName = null; // dormant — public identity is username-only
  const activity = computeCapperActivity(positions.map((x) => x.createdAt));

  // Carried-over results count toward the track record whatever window is
  // selected — they are a settled history, not something that happened this
  // week. `legacyBaseline` is window-aware (all-time only), so read the row.
  const carriedResults = p.legacyRecords[0]
    ? p.legacyRecords[0].wins +
      p.legacyRecords[0].losses +
      p.legacyRecords[0].pushes
    : 0;
  const lifetimeGraded =
    (lifetimeGradedPositions?.get(p.id) ?? stats.settled) + carriedResults;
  const publicPackages = p.packages.filter((pkg) => pkg.trackingUrls[0]?.slug);

  const clvValues = plays
    .map((pl) =>
      "clvPts" in pl && pl.clvPts != null ? Number(pl.clvPts) : null,
    )
    .filter((v): v is number => v != null && Number.isFinite(v));
  const avgClv =
    clvValues.length > 0
      ? clvValues.reduce((a, b) => a + b, 0) / clvValues.length
      : null;

  return {
    id: p.id,
    name: username,
    handle: username,
    displayName,
    avatarUrl: p.avatarUrl ?? undefined,
    bannerUrl: p.bannerUrl ?? undefined,
    verified: p.user.emailVerified != null,
    topSport: topSport(
      plays.map((x) => x.sport),
      p.sports[0],
    ),
    rank: 0, // assigned after sort
    rankDelta: 0, // no historical snapshot yet — honest neutral
    record: { w: stats.wins, l: stats.losses, p: stats.pushes },
    winPct: stats.winPct,
    units: stats.units,
    roi: stats.roi,
    streak,
    recentForm,
    trophies: [],
    settledPicks: stats.settled,
    lifetimeGraded,
    verifiedShare: computeVerifiedShare(plays.map((x) => x.verificationTier)),
    avgClv,
    stakedUnits: stats.stakedUnits,
    performanceTrend,
    lastPlayAt: positions.at(-1)?.createdAt,
    headline: p.headline ?? undefined,
    bio: p.bio ?? undefined,
    specialties: p.specialties.length ? p.specialties : undefined,
    sports: p.sports.length ? p.sports : undefined,
    books: p.books.length ? p.books : undefined,
    storefront: resolveStorefrontIdentity({
      username,
      title: p.storefrontTitle,
      description: p.storefrontDescription,
      enabled: p.storefrontEnabled,
    }),
    publicOffers: publicPackages[0]
      ? {
          count: publicPackages.length,
          featuredTitle: publicPackages[0].title,
          purchasePath: `/go/${publicPackages[0].trackingUrls[0]!.slug}`,
        }
      : undefined,
    joinedAt: p.createdAt,
    socials: undefined, // dormant — external links no longer rendered
    isLegacy: p.isLegacy || undefined,
    legacyCarriedResults: legacyBaseline
      ? legacyBaseline.wins + legacyBaseline.losses + legacyBaseline.pushes
      : undefined,
    legacyBaselineUnits: legacyBaseline ? legacyBaseline.units : undefined,
    activity,
  };
}

const withTrophy = (c: CapperSummary, t: string) => {
  if (!c.trophies.includes(t)) c.trophies.push(t);
};

export async function getLeaderboard(
  options: Partial<LeaderboardFilters> = {},
): Promise<CapperSummary[]> {
  return (await getLeaderboardResult(options)).cappers;
}

/**
 * All-time public evidence for a bounded set of marketplace cappers. Reuses
 * the leaderboard's public predicates and summary math without scanning every
 * active account or assigning marketplace ranks.
 */
export async function getPublicCapperEvidenceByIds(
  requestedIds: string[],
): Promise<{ cappers: CapperSummary[]; failed: boolean }> {
  const capperIds = [...new Set(requestedIds.filter(Boolean))];
  if (capperIds.length === 0) return { cappers: [], failed: false };

  try {
    const profiles = await withTransientDatabaseRetry(
      async () => {
        const clvReady = await hasClvColumns();
        return fetchRankableProfiles(DEFAULT_FILTERS, clvReady, capperIds);
      },
      { label: "public capper evidence" },
    );
    return {
      // All-time evidence, so carried-over totals apply.
      cappers: profiles
        .map((p) => summarize(p, true))
        .filter((capper): capper is CapperSummary => capper !== null),
      failed: false,
    };
  } catch (error) {
    console.error(
      "[getPublicCapperEvidenceByIds] database unavailable:",
      error,
    );
    return { cappers: [], failed: true };
  }
}

async function loadLeaderboardResult(filters: LeaderboardFilters): Promise<{
  cappers: CapperSummary[];
  unranked: CapperSummary[];
  failed: boolean;
}> {
  let profiles: ProfileRow[];
  let lifetimeGraded: LifetimeGradedByCapper = new Map();
  try {
    profiles = await withTransientDatabaseRetry(
      async () => {
        const clvReady = await hasClvColumns();
        return fetchRankableProfiles(filters, clvReady);
      },
      { label: "leaderboard read" },
    );
    lifetimeGraded = await withTransientDatabaseRetry(
      () => fetchLifetimeGraded(profiles.map((p) => p.id)),
      { label: "leaderboard lifetime sample" },
    );
  } catch (err) {
    console.error("[getLeaderboard] database unavailable:", err);
    return { cappers: [], unranked: [], failed: true };
  }

  const cappers = profiles
    .map((p) => summarize(p, filters.window === "all", lifetimeGraded))
    .filter((c): c is CapperSummary => c !== null);

  const { ranked, unranked } = partitionLeaderboard(cappers, filters);

  // Modest, data-derived honors (no fabricated awards) — ranked field only.
  if (ranked.length) {
    const topUnits = [...ranked].sort((a, b) => b.units - a.units)[0];
    if (topUnits.units > 0) withTrophy(topUnits, "Top Units");
    const topRoi = ranked
      .filter((c) => c.units > 0)
      .sort((a, b) => b.roi - a.roi)[0];
    if (topRoi) withTrophy(topRoi, "Top ROI");
    for (const c of ranked) if (c.streak >= 4) withTrophy(c, "Hot Streak");
  }

  return { cappers: ranked, unranked, failed: false };
}

const getCachedLeaderboardResult = cachedQuery(
  async (cacheKey: string) => {
    const filters = JSON.parse(cacheKey) as LeaderboardFilters;
    return loadLeaderboardResult(filters);
  },
  ["leaderboard-result"],
  { revalidate: 60, tags: ["leaderboard"] },
);

export const getLeaderboardResult = cache(async function getLeaderboardResult(
  options: Partial<LeaderboardFilters> = {},
): Promise<{
  cappers: CapperSummary[];
  unranked: CapperSummary[];
  failed: boolean;
}> {
  const filters = { ...DEFAULT_FILTERS, ...options };
  const cacheKey = JSON.stringify({
    sport: filters.sport,
    window: filters.window,
    sort: filters.sort,
    direction: filters.direction ?? "desc",
    minPicks: filters.minPicks,
    verifiedOnly: filters.verifiedOnly,
    search: filters.search,
    limit: filters.limit,
  });
  return getCachedLeaderboardResult(cacheKey);
});
