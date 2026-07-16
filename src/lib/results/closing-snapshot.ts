import "server-only";

import { computeClvPts } from "@/lib/clv";
import { marketKeysForMarket } from "@/lib/odds-verify";
import { fetchEventOddsForVerification } from "@/lib/odds-api";
import { liveLineAmerican } from "@/lib/odds-verify";
import { prisma } from "@/lib/prisma";

const PRE_START_WINDOW_MS = 90 * 60 * 1000;
const RECENT_START_MS = 2 * 60 * 60 * 1000;

export type ClosingSnapshotResult = { snapshots: number; skipped: number };

/**
 * Capture same-book closing prices for open plays (purpose=clv).
 * Targets events starting within 90m or recently started without a close.
 */
export async function snapshotClosingOdds(
  now = new Date(),
): Promise<ClosingSnapshotResult> {
  const preStartEnd = new Date(now.getTime() + PRE_START_WINDOW_MS);
  const recentStart = new Date(now.getTime() - RECENT_START_MS);

  const plays = await prisma.play.findMany({
    where: {
      outcome: "PENDING",
      closingOddsAmerican: null,
      eventId: { not: null },
      OR: [
        { eventStartsAt: { gte: now, lte: preStartEnd } },
        {
          eventStartsAt: { gte: recentStart, lt: now },
        },
      ],
    },
    select: {
      id: true,
      sport: true,
      eventId: true,
      book: true,
      market: true,
      side: true,
      line: true,
      league: true,
    },
    take: 80,
  });

  let snapshots = 0;
  let skipped = 0;

  for (const play of plays) {
    if (!play.eventId) {
      skipped++;
      continue;
    }

    const marketKeys = marketKeysForMarket(play.market);
    const event = await fetchEventOddsForVerification(
      play.sport,
      play.eventId,
      {
        books: play.book ? [play.book] : undefined,
        purpose: "clv",
        league: play.league,
      },
    );

    if (!event) {
      skipped++;
      continue;
    }

    const closing = liveLineAmerican(event, {
      marketKeys,
      side: play.side ?? "",
      line: play.line == null ? undefined : Number(play.line),
      bookKey: play.book,
      bookKeys: play.book ? [play.book] : [],
    });

    await prisma.play.update({
      where: { id: play.id },
      data: {
        closingOddsAmerican: closing,
        closingCapturedAt: new Date(),
      },
    });

    if (closing != null) snapshots++;
    else skipped++;
  }

  if (plays.length > 0) {
    console.info(
      `[odds] purpose=clv closing-snapshot: plays=${plays.length} captured=${snapshots} skipped=${skipped}`,
    );
  }

  return { snapshots, skipped };
}

/** Compute and persist CLV at grade time when a closing price exists. */
export function clvPtsForGrade(
  oddsAmerican: number,
  closingOddsAmerican: number | null | undefined,
): number | null {
  return computeClvPts(oddsAmerican, closingOddsAmerican);
}
