/**
 * Production audit: classify committed PENDING plays as live-window vs overdue.
 *
 * Usage:
 *   DATABASE_URL='postgresql://…?schema=scl' npx tsx scripts/audit-pending-plays.ts
 */
import { PrismaClient } from "@prisma/client";

const EXPECTED_FINAL_HOURS: Record<string, number> = {
  MLB: 6,
  NBA: 5,
  WNBA: 5,
  NCAAB: 5,
  NFL: 6,
  NCAAF: 6,
  CFL: 6,
  NHL: 5,
  SOCCER: 4,
  TENNIS: 7,
};

function expectedFinalHours(sport: string): number {
  return EXPECTED_FINAL_HOURS[sport.toUpperCase()] ?? 8;
}

function expectedFinalAt(sport: string, startsAt: Date): Date {
  return new Date(
    startsAt.getTime() + expectedFinalHours(sport) * 60 * 60 * 1_000,
  );
}

function isAwaitingExpectedFinal(
  sport: string,
  startsAt: Date | null | undefined,
  now: Date,
): boolean {
  return startsAt != null && expectedFinalAt(sport, startsAt) > now;
}

const prisma = new PrismaClient();

async function main() {
  const now = new Date();
  const pending = await prisma.play.findMany({
    where: { outcome: "PENDING", status: "COMMITTED" },
    select: {
      id: true,
      sport: true,
      market: true,
      selection: true,
      eventStartsAt: true,
      eventId: true,
      parlayId: true,
      capper: {
        select: {
          user: {
            select: { username: true, accountStatus: true, email: true },
          },
        },
      },
    },
    orderBy: { eventStartsAt: "asc" },
  });

  const live: typeof pending = [];
  const future: typeof pending = [];
  const noStart: typeof pending = [];
  const overdue: typeof pending = [];

  for (const play of pending) {
    if (play.eventStartsAt == null) {
      noStart.push(play);
      continue;
    }
    if (play.eventStartsAt.getTime() > now.getTime()) {
      future.push(play);
      continue;
    }
    if (isAwaitingExpectedFinal(play.sport, play.eventStartsAt, now)) {
      live.push(play);
      continue;
    }
    overdue.push(play);
  }

  const row = (p: (typeof pending)[number]) => ({
    id: p.id,
    handle: p.capper.user.username,
    sport: p.sport,
    market: p.market,
    selection: p.selection,
    eventStartsAt: p.eventStartsAt?.toISOString() ?? null,
    expectedFinalBy: p.eventStartsAt
      ? expectedFinalAt(p.sport, p.eventStartsAt).toISOString()
      : null,
    parlayId: p.parlayId,
  });

  console.log(
    JSON.stringify(
      {
        checkedAt: now.toISOString(),
        totals: {
          pendingCommitted: pending.length,
          stillInExpectedFinalWindow: live.length,
          futureEvents: future.length,
          missingEventStartsAt: noStart.length,
          overduePastExpectedFinal: overdue.length,
        },
        overduePlays: overdue.map(row),
        liveWindowPlays: live.map(row),
        futurePlays: future.slice(0, 20).map(row),
        noStartPlays: noStart.slice(0, 20).map(row),
        ok: overdue.length === 0,
      },
      null,
      2,
    ),
  );

  if (overdue.length > 0) process.exitCode = 1;
}

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
