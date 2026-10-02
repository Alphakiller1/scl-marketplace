import "server-only";

import {
  audienceCounts,
  resolveAudienceMembers,
} from "@/lib/admin-audience-members";
import { prisma } from "@/lib/prisma";
import { loadAudienceSnapshots } from "@/lib/queries/admin-audience";
import { countStorefrontQueue } from "@/lib/queries/store";
import { listGradingWorkQueue } from "@/lib/results/stuck-plays";
import {
  emptyAudienceFilters,
  type AudienceFilters,
} from "@/lib/schemas/audience.schema";

const DAY_MS = 86_400_000;

function filters(overrides: Partial<AudienceFilters>): AudienceFilters {
  return { ...emptyAudienceFilters(), ...overrides };
}

export const OPERATIONAL_AUDIENCES = {
  all: filters({}),
  joined7: filters({ joinedWithinDays: 7 }),
  joined14: filters({ joinedWithinDays: 14 }),
  joined30: filters({ joinedWithinDays: 30 }),
  active: filters({ accountActivity: "ACTIVE" }),
  inactive: filters({ accountActivity: "INACTIVE" }),
  verified: filters({ verification: "VERIFIED" }),
  unverified: filters({ verification: "UNVERIFIED" }),
  hasPlays: filters({ playHistory: "HAS_PLAYS" }),
  neverSubmitted: filters({ playHistory: "NEVER_SUBMITTED" }),
  played7: filters({ playedWithinDays: 7 }),
  played30: filters({ playedWithinDays: 30 }),
  noPlays3: filters({ noPlaysWithinDays: 3 }),
  noPlays7: filters({ noPlaysWithinDays: 7 }),
  noPlays14: filters({ noPlaysWithinDays: 14 }),
  noPlays30: filters({ noPlaysWithinDays: 30 }),
  connectedStorefront: filters({ storefront: "CONNECTED" }),
  noConnectedStorefront: filters({ storefront: "NOT_CONNECTED" }),
  playsNoStorefront: filters({
    playHistory: "HAS_PLAYS",
    storefront: "NOT_CONNECTED",
  }),
  awaitingStorefront: filters({ storefront: "AWAITING_REVIEW" }),
} as const;

export type OperationalAudienceKey = keyof typeof OPERATIONAL_AUDIENCES;

export type AudienceMetric = {
  /** Cappers in the group — the length of the list the card opens. */
  count: number;
  /** Of those, how many a campaign to this group would reach. */
  emailable: number;
  filters: AudienceFilters;
};

/**
 * Operational totals for the admin overview.
 *
 * - Active plays: every unresolved committed position — straight plays plus
 *   parlays (a parlay is one position, not its legs) — whether the event is
 *   upcoming or underway. Grading or closing it removes it.
 * - Pending grades: the same actionable work queue shown on `/admin/grading` —
 *   plays past their expected final or permanently blocked from auto-grading.
 */
export async function getAdminOperationalOverview() {
  const now = new Date();
  const realCapper = { user: { isTest: false } };
  const activeStraightWhere = {
    outcome: "PENDING" as const,
    status: "COMMITTED" as const,
    parlayId: null,
    capper: realCapper,
  };
  const since = (days: number) => new Date(now.getTime() - days * DAY_MS);
  const submitted = (days: number) =>
    Promise.all([
      prisma.play.count({
        where: {
          parlayId: null,
          status: "COMMITTED",
          capper: realCapper,
          createdAt: { gte: since(days) },
        },
      }),
      prisma.parlay.count({
        where: { capper: realCapper, createdAt: { gte: since(days) } },
      }),
    ]).then(([plays, parlays]) => plays + parlays);

  const [
    snapshots,
    activeStraight,
    activeParlays,
    plays7,
    plays30,
    gradingWorkQueue,
    storefrontQueue,
  ] = await Promise.all([
    loadAudienceSnapshots(),
    prisma.play.count({ where: activeStraightWhere }),
    prisma.parlay.count({
      where: { outcome: "PENDING", capper: realCapper },
    }),
    submitted(7),
    submitted(30),
    listGradingWorkQueue(),
    countStorefrontQueue(),
  ]);

  const audiences = Object.fromEntries(
    Object.entries(OPERATIONAL_AUDIENCES).map(([key, value]) => {
      const { total, emailable } = audienceCounts(
        resolveAudienceMembers(snapshots, value, now),
      );
      return [key, { count: total, emailable, filters: value }];
    }),
  ) as Record<OperationalAudienceKey, AudienceMetric>;

  return {
    generatedAt: now.toISOString(),
    totals: {
      cappers: audiences.all.count,
      activePlays: activeStraight + activeParlays,
      plays7,
      plays30,
      pendingGrades: gradingWorkQueue.length,
      storefrontQueue,
    },
    audiences,
  };
}

export type AdminOperationalOverview = Awaited<
  ReturnType<typeof getAdminOperationalOverview>
>;
