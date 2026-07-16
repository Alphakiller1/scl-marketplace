import "server-only";

import { prisma } from "@/lib/prisma";
import { isAgedOut } from "@/lib/results/skip-reason";

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
      parlayId: true,
      capper: {
        select: { user: { select: { username: true } } },
      },
    },
    orderBy: { eventStartsAt: "asc" },
    take: 200,
  });

  return rows
    .filter((p) => isAgedOut(p.eventStartsAt, now))
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
    }));
}
