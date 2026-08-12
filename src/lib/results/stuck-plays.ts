import "server-only";

import { prisma } from "@/lib/prisma";
import { isAgedOut } from "@/lib/results/skip-reason";
import { expectedFinalAt } from "@/lib/results/grading-window";
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
    where: { outcome: "PENDING" },
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

/** Pending committed plays whose sport-specific final deadline has passed. */
export async function listOverduePendingPlays(
  now = new Date(),
  take = 50,
): Promise<StuckPlayRow[]> {
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
    .filter(
      (play) =>
        play.eventStartsAt != null &&
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
