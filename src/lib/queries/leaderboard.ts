import "server-only";

import type { Outcome } from "@prisma/client";

import { prisma } from "@/lib/prisma";
import {
  buildPerformanceTrend,
  DEFAULT_LEADERBOARD_LIMIT,
  leaderboardWindowStart,
  partitionLeaderboard,
  type LeaderboardFilters,
} from "@/lib/leaderboard";
import { UNIT_MIN } from "@/lib/constants";
import { hasQaNoteMarker } from "@/lib/public-eligibility";
import { prismaExcludeTestHandlesLive } from "@/lib/public-eligibility-prisma";
import { computeCapperStats } from "@/lib/stats";
import { computeVerifiedShare } from "@/lib/verification";
import type { CapperSummary, FormResult } from "@/lib/mock";
import { resolveStorefrontIdentity } from "@/lib/storefront";
import { computeCapperActivity } from "@/lib/capper-activity";
import { hasClvColumns } from "@/lib/results/schema-features";

/**
 * Live leaderboard data — computed from real plays, never fabricated. Only
 * cappers with a public handle (User.username) are ranked. When the database
 * is empty the board is empty (honest); pages render an empty state, not mock.
 */

const DEFAULT_FILTERS: LeaderboardFilters = {
  sport: "ALL",
  window: "all",
  sort: "units",
  minPicks: 0,
  verifiedOnly: false,
  search: "",
  limit: DEFAULT_LEADERBOARD_LIMIT,
};

async function fetchRankableProfiles(
  filters: LeaderboardFilters,
  clvReady: boolean,
) {
  const windowStart = leaderboardWindowStart(filters.window);
  const excludeTest = await prismaExcludeTestHandlesLive();

  return prisma.capperProfile.findMany({
    where: {
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
          ...(windowStart ? { createdAt: { gte: windowStart } } : undefined),
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
      // Parlays are positions of record alongside straight plays. A parlay matches a
      // sport filter when any leg is that sport.
      parlays: {
        where: {
          ...(windowStart ? { createdAt: { gte: windowStart } } : undefined),
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

function summarize(p: ProfileRow): CapperSummary | null {
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

  const stats = computeCapperStats(
    positions.map((x) => ({
      outcome: x.outcome,
      units: x.units,
      profitUnits: x.profitUnits,
    })),
  );
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
    joinedAt: p.createdAt,
    socials: undefined, // dormant — external links no longer rendered
    isLegacy: p.isLegacy || undefined,
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

export async function getLeaderboardResult(
  options: Partial<LeaderboardFilters> = {},
): Promise<{
  cappers: CapperSummary[];
  unranked: CapperSummary[];
  failed: boolean;
}> {
  const filters = { ...DEFAULT_FILTERS, ...options };
  let profiles: ProfileRow[];
  try {
    const clvReady = await hasClvColumns();
    profiles = await fetchRankableProfiles(filters, clvReady);
  } catch (err) {
    console.error("[getLeaderboard] database unavailable:", err);
    return { cappers: [], unranked: [], failed: true };
  }

  const cappers = profiles
    .map(summarize)
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
