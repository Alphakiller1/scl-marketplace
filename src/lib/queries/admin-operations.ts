import "server-only";

import { resolveAudienceMembers } from "@/lib/queries/admin-audience";
import { prisma } from "@/lib/prisma";
import {
  emptyAudienceFilters,
  type AudienceFilters,
} from "@/lib/schemas/audience.schema";
import { loadAudienceSnapshots } from "@/lib/queries/admin-audience";

function filters(overrides: Partial<AudienceFilters>): AudienceFilters {
  return { ...emptyAudienceFilters(), ...overrides };
}

export async function getAdminOperationalOverview() {
  const now = new Date();
  const snapshotsPromise = loadAudienceSnapshots();
  const activeStraightWhere = {
    outcome: "PENDING" as const,
    status: "COMMITTED" as const,
    parlayId: null,
    capper: { user: { isTest: false } },
  };
  const realCapper = { user: { isTest: false } };

  const [
    snapshots,
    activeStraight,
    activeParlays,
    plays7,
    plays30,
    pendingStraight,
    pendingParlays,
  ] = await Promise.all([
    snapshotsPromise,
    prisma.play.count({ where: activeStraightWhere }),
    prisma.parlay.count({
      where: { outcome: "PENDING", capper: realCapper },
    }),
    Promise.all([
      prisma.play.count({
        where: {
          parlayId: null,
          status: "COMMITTED",
          capper: realCapper,
          createdAt: { gte: new Date(now.getTime() - 7 * 86_400_000) },
        },
      }),
      prisma.parlay.count({
        where: {
          capper: realCapper,
          createdAt: { gte: new Date(now.getTime() - 7 * 86_400_000) },
        },
      }),
    ]),
    Promise.all([
      prisma.play.count({
        where: {
          parlayId: null,
          status: "COMMITTED",
          capper: realCapper,
          createdAt: { gte: new Date(now.getTime() - 30 * 86_400_000) },
        },
      }),
      prisma.parlay.count({
        where: {
          capper: realCapper,
          createdAt: { gte: new Date(now.getTime() - 30 * 86_400_000) },
        },
      }),
    ]),
    prisma.play.count({
      where: {
        ...activeStraightWhere,
        eventStartsAt: { lt: now },
      },
    }),
    prisma.parlay.count({
      where: {
        outcome: "PENDING",
        capper: realCapper,
        legs: {
          some: {},
          every: { eventStartsAt: { lt: now } },
        },
      },
    }),
  ]);

  const eligibleCount = (audienceFilters: AudienceFilters) =>
    resolveAudienceMembers(snapshots, audienceFilters, now).filter(
      (member) => member.eligible,
    ).length;
  const realCappers = snapshots.filter((capper) => !capper.isTest);

  const audienceFilters = {
    joined7: filters({ joinedWithinDays: 7 }),
    joined14: filters({ joinedWithinDays: 14 }),
    joined30: filters({ joinedWithinDays: 30 }),
    active: filters({ accountActivity: "ACTIVE" }),
    inactive: filters({ accountActivity: "INACTIVE" }),
    verified: filters({ verification: "VERIFIED" }),
    unverified: filters({ verification: "UNVERIFIED" }),
    hasPlays: filters({ playHistory: "HAS_PLAYS" }),
    neverSubmitted: filters({ playHistory: "NEVER_SUBMITTED" }),
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
  };

  return {
    totals: {
      cappers: realCappers.length,
      activePlays: activeStraight + activeParlays,
      plays7: plays7[0] + plays7[1],
      plays30: plays30[0] + plays30[1],
      pendingGrades: pendingStraight + pendingParlays,
    },
    audiences: Object.fromEntries(
      Object.entries(audienceFilters).map(([key, value]) => [
        key,
        { count: eligibleCount(value), filters: value },
      ]),
    ) as Record<
      keyof typeof audienceFilters,
      { count: number; filters: AudienceFilters }
    >,
  };
}
