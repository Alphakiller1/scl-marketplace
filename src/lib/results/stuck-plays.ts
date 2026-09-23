import "server-only";

import { UNIT_MIN } from "@/lib/constants";
import { prisma } from "@/lib/prisma";
import { isAgedOut } from "@/lib/results/skip-reason";
import { expectedFinalAt } from "@/lib/results/grading-window";
import { isAutoGradeBlocked } from "@/lib/results/match";
import {
  manualGradingReason,
  needsManualGrading,
} from "@/lib/results/manual-grading";
import { prismaExcludeTestHandlesLive } from "@/lib/public-eligibility-prisma";

export type StuckPlayRow = {
  id: string;
  handle: string | null;
  sport: string;
  market: string;
  selection: string;
  oddsAmerican: number;
  units: number;
  eventId: string | null;
  eventStartsAt: string | null;
  parlayId: string | null;
};

/** Read-only inventory of PENDING plays past the scores lookback (Task B). */
export async function listAgedOutPendingPlays(
  now = new Date(),
  take = 50,
): Promise<StuckPlayRow[]> {
  const rows = await prisma.play.findMany({
    where: { outcome: "PENDING", status: "COMMITTED" },
    select: {
      id: true,
      sport: true,
      market: true,
      selection: true,
      oddsAmerican: true,
      units: true,
      eventId: true,
      eventStartsAt: true,
      createdAt: true,
      parlayId: true,
      capper: {
        select: { user: { select: { username: true } } },
      },
    },
    orderBy: { eventStartsAt: "asc" },
    take: 200,
  });

  return (
    rows
      // Fall back to createdAt: imported legacy plays carry the EVENT time there
      // and leave eventStartsAt null, and isAgedOut returns false for null. Those
      // 64 plays were therefore invisible to this report, so the admin panel read
      // "4 stuck" while 121 sat ungraded — a falsely reassuring number on the one
      // surface meant to catch exactly this.
      .filter((p) => isAgedOut(p.eventStartsAt ?? p.createdAt, now))
      .slice(0, take)
      .map((p) => ({
        id: p.id,
        handle: p.capper.user.username,
        sport: p.sport,
        market: p.market,
        selection: p.selection,
        oddsAmerican: p.oddsAmerican,
        units: Number(p.units),
        eventId: p.eventId,
        eventStartsAt: p.eventStartsAt?.toISOString() ?? null,
        parlayId: p.parlayId,
      }))
  );
}

/**
 * Pending committed plays whose sport-specific final deadline has passed.
 *
 * Same public-record set as grading health (`pendingPastExpectedFinal`):
 * straight plays at or above `UNIT_MIN`. Parlay legs are `units: 0` — the
 * parent ticket is the position of record — so counting them here made the
 * grade cron return 503 while health stayed HEALTHY. Two Inter Milan soccer
 * legs did that after FT.
 */
export async function listOverduePendingPlays(
  now = new Date(),
  take = 50,
): Promise<StuckPlayRow[]> {
  const excludedUsers = await prismaExcludeTestHandlesLive();
  const rows = await prisma.play.findMany({
    where: {
      outcome: "PENDING",
      status: "COMMITTED",
      parlayId: null,
      units: { gte: UNIT_MIN },
      capper: {
        user: {
          accountStatus: "ACTIVE",
          username: { not: null },
          ...excludedUsers,
        },
      },
    },
    select: {
      id: true,
      sport: true,
      market: true,
      selection: true,
      oddsAmerican: true,
      units: true,
      eventId: true,
      eventStartsAt: true,
      parlayId: true,
      capper: { select: { user: { select: { username: true } } } },
    },
    orderBy: { eventStartsAt: "asc" },
    take: 1_000,
  });
  return rows
    .filter(
      (play) =>
        play.eventStartsAt != null &&
        !isAutoGradeBlocked(play) &&
        expectedFinalAt(play.sport, play.eventStartsAt) <= now,
    )
    .slice(0, take)
    .map((play) => ({
      id: play.id,
      handle: play.capper.user.username,
      sport: play.sport,
      market: play.market,
      selection: play.selection,
      oddsAmerican: play.oddsAmerican,
      units: Number(play.units),
      eventId: play.eventId,
      eventStartsAt: play.eventStartsAt?.toISOString() ?? null,
      parlayId: play.parlayId,
    }));
}

/**
 * Pending parlay legs whose sport-specific final deadline has passed.
 *
 * This is deliberately separate from `listOverduePendingPlays`: parlay legs
 * carry zero units and are not independent positions, but a leg that remains
 * pending can hold its entire ticket open. Keeping a dedicated inventory makes
 * that grading failure alertable without inflating straight-play health counts.
 */
export async function listOverduePendingParlayLegs(
  now = new Date(),
  take = 50,
): Promise<StuckPlayRow[]> {
  const excludedUsers = await prismaExcludeTestHandlesLive();
  const rows = await prisma.play.findMany({
    where: {
      outcome: "PENDING",
      status: "COMMITTED",
      parlayId: { not: null },
      capper: {
        user: {
          accountStatus: "ACTIVE",
          username: { not: null },
          ...excludedUsers,
        },
      },
    },
    select: {
      id: true,
      sport: true,
      market: true,
      selection: true,
      oddsAmerican: true,
      units: true,
      eventId: true,
      eventStartsAt: true,
      parlayId: true,
      capper: { select: { user: { select: { username: true } } } },
    },
    orderBy: { eventStartsAt: "asc" },
    take: 1_000,
  });

  return rows
    .filter(
      (play) =>
        play.eventStartsAt != null &&
        !isAutoGradeBlocked(play) &&
        expectedFinalAt(play.sport, play.eventStartsAt) <= now,
    )
    .slice(0, take)
    .map((play) => ({
      id: play.id,
      handle: play.capper.user.username,
      sport: play.sport,
      market: play.market,
      selection: play.selection,
      oddsAmerican: play.oddsAmerican,
      units: Number(play.units),
      eventId: play.eventId,
      eventStartsAt: play.eventStartsAt?.toISOString() ?? null,
      parlayId: play.parlayId,
    }));
}

/** Every pending committed play, aged out or not — the number ops actually needs. */
export async function countPendingPlays(): Promise<number> {
  return prisma.play.count({
    where: { outcome: "PENDING", status: "COMMITTED" },
  });
}

/**
 * Plays auto-grading has permanently given up on and a human must settle.
 *
 * Deliberately NOT the same set as `listOverduePendingPlays`, which excludes
 * these so an ungradeable market cannot hold the pipeline at UNHEALTHY forever.
 * That exclusion is right, and on its own it made the play invisible: the only
 * alert for ungraded plays skipped exactly the plays that can never grade
 * themselves. A tennis games spread sat PENDING for five days that way.
 *
 * Same shape as the other stuck reports, plus the reason, so the admin queue
 * says what the human has to go and find.
 */
export async function listManualGradingQueue(
  now = new Date(),
  take = 50,
): Promise<(StuckPlayRow & { reason: string })[]> {
  const excludedUsers = await prismaExcludeTestHandlesLive();
  const rows = await prisma.play.findMany({
    where: {
      outcome: "PENDING",
      status: "COMMITTED",
      capper: {
        user: {
          accountStatus: "ACTIVE",
          username: { not: null },
          ...excludedUsers,
        },
      },
    },
    select: {
      id: true,
      sport: true,
      market: true,
      selection: true,
      oddsAmerican: true,
      units: true,
      eventId: true,
      eventStartsAt: true,
      parlayId: true,
      capper: { select: { user: { select: { username: true } } } },
    },
    orderBy: { eventStartsAt: "asc" },
    take: 1_000,
  });

  return rows
    .filter((play) => needsManualGrading(play, now))
    .slice(0, take)
    .map((play) => ({
      id: play.id,
      handle: play.capper.user.username,
      sport: play.sport,
      market: play.market,
      selection: play.selection,
      oddsAmerican: play.oddsAmerican,
      units: Number(play.units),
      eventId: play.eventId,
      eventStartsAt: play.eventStartsAt?.toISOString() ?? null,
      parlayId: play.parlayId,
      reason: manualGradingReason(play),
    }));
}

/**
 * Everything a human should look at this morning: plays auto-grading has given
 * up on, plus plays still pending past their sport's expected final.
 *
 * The two used to be separate — the queue listed only the first kind while the
 * health line counted the second — so the panel could read "3 past expected
 * final" with one play to act on and no way to reach the other two. Retries
 * continue on the overdue ones; listing them only means the owner can settle
 * one by hand instead of waiting for a feed that may never carry it.
 */
export async function listGradingWorkQueue(
  now = new Date(),
  take = 50,
): Promise<(StuckPlayRow & { reason: string; manualOnly: boolean })[]> {
  const [manual, overdue, overdueParlayLegs] = await Promise.all([
    listManualGradingQueue(now, take),
    listOverduePendingPlays(now, take),
    listOverduePendingParlayLegs(now, take),
  ]);
  const seen = new Set(manual.map((play) => play.id));
  return [
    ...manual.map((play) => ({ ...play, manualOnly: true })),
    ...overdue
      .filter((play) => !seen.has(play.id))
      .map((play) => ({
        ...play,
        manualOnly: false,
        reason: `${play.market} is past its expected final for ${play.sport} — automatic retries continue`,
      })),
    ...overdueParlayLegs
      .filter((play) => !seen.has(play.id))
      .map((play) => ({
        ...play,
        manualOnly: false,
        reason: `${play.market} parlay leg is past its expected final for ${play.sport} — automatic retries continue`,
      })),
  ].slice(0, take);
}
