import "server-only";

import { computeClvPts } from "@/lib/clv";
import { liveLineAmerican, marketKeysForMarket } from "@/lib/odds-verify";
import { fetchEventOddsForVerification } from "@/lib/odds-api";
import { prisma } from "@/lib/prisma";
import { hasClvColumns } from "@/lib/results/schema-features";

/** Pre-start window — capture same-book close as first pitch / tip approaches. */
const PRE_START_WINDOW_MS = 3 * 60 * 60 * 1000;
/** Post-start grace — Odds API often still has the board briefly after start. */
const RECENT_START_MS = 4 * 60 * 60 * 1000;

export type ClosingSnapshotResult = {
  snapshots: number;
  skipped: number;
  backfilled: number;
};

export type ClosingPlayRef = {
  id: string;
  sport: string;
  eventId: string | null;
  book: string | null;
  market: string;
  side: string | null;
  line: unknown;
  league: string | null;
};

/**
 * Resolve same-book closing American for a bound play.
 * Prefer capture book; if missing/suspended, fall back to best available on the
 * event payload so Close/CLV can still post when the book drops the line.
 */
export async function resolveClosingAmerican(
  play: ClosingPlayRef,
): Promise<number | null> {
  if (!play.eventId || !play.side?.trim()) return null;

  const marketKeys = marketKeysForMarket(play.market);
  if (!marketKeys.length) return null;

  const event = await fetchEventOddsForVerification(play.sport, play.eventId, {
    books: play.book ? [play.book] : undefined,
    purpose: "clv",
    league: play.league,
  });
  if (!event) return null;

  const line = play.line == null ? undefined : Number(play.line);
  const sameBook = liveLineAmerican(event, {
    marketKeys,
    side: play.side,
    line,
    bookKey: play.book,
    bookKeys: play.book ? [play.book] : [],
  });
  if (sameBook != null) return sameBook;

  // Book dropped / never listed this line — best available is still a real close.
  return liveLineAmerican(event, {
    marketKeys,
    side: play.side,
    line,
  });
}

/**
 * Capture closing prices for open (and recently started) plays missing a close.
 * Only persists when a real American price is found — failed fetches stay null
 * so the next cron can retry.
 */
export async function snapshotClosingOdds(
  now = new Date(),
): Promise<ClosingSnapshotResult> {
  if (!(await hasClvColumns())) {
    return { snapshots: 0, skipped: 0, backfilled: 0 };
  }

  const preStartEnd = new Date(now.getTime() + PRE_START_WINDOW_MS);
  const recentStart = new Date(now.getTime() - RECENT_START_MS);

  const plays = await prisma.play.findMany({
    where: {
      outcome: "PENDING",
      closingOddsAmerican: null,
      eventId: { not: null },
      side: { not: null },
      OR: [
        { eventStartsAt: { gte: now, lte: preStartEnd } },
        { eventStartsAt: { gte: recentStart, lt: now } },
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
    const closing = await resolveClosingAmerican(play);
    if (closing == null) {
      skipped++;
      continue;
    }

    await prisma.play.update({
      where: { id: play.id },
      data: {
        closingOddsAmerican: closing,
        closingCapturedAt: new Date(),
      },
      select: { id: true },
    });
    snapshots++;
  }

  const backfilled = await backfillClvPts();

  if (plays.length > 0 || backfilled > 0) {
    console.info(
      `[odds] purpose=clv closing-snapshot: plays=${plays.length} captured=${snapshots} skipped=${skipped} backfilled=${backfilled}`,
    );
  }

  return { snapshots, skipped, backfilled };
}

/**
 * Persist CLV for graded (or still-open) plays that already have a close but
 * never got `clvPts` written (manual grades, schema lag, partial cron).
 */
export async function backfillClvPts(limit = 200): Promise<number> {
  if (!(await hasClvColumns())) return 0;

  const rows = await prisma.play.findMany({
    where: {
      closingOddsAmerican: { not: null },
      clvPts: null,
      parlayId: null,
    },
    select: {
      id: true,
      oddsAmerican: true,
      closingOddsAmerican: true,
    },
    take: limit,
  });

  let updated = 0;
  for (const row of rows) {
    const clvPts = computeClvPts(row.oddsAmerican, row.closingOddsAmerican);
    if (clvPts == null) continue;
    await prisma.play.update({
      where: { id: row.id },
      data: { clvPts },
      select: { id: true },
    });
    updated++;
  }
  return updated;
}

/**
 * Last-chance close + CLV at grade time when the cron window was missed.
 * Returns updated closing (may be unchanged) and computed clvPts.
 */
export async function ensureClosingAndClv(play: {
  id: string;
  sport: string;
  eventId: string | null;
  book: string | null;
  market: string;
  side: string | null;
  line: unknown;
  league: string | null;
  oddsAmerican: number;
  closingOddsAmerican: number | null;
}): Promise<{ closingOddsAmerican: number | null; clvPts: number | null }> {
  if (!(await hasClvColumns())) {
    return { closingOddsAmerican: play.closingOddsAmerican, clvPts: null };
  }

  let closing = play.closingOddsAmerican;
  if (closing == null && play.eventId) {
    closing = await resolveClosingAmerican(play);
    if (closing != null) {
      await prisma.play.update({
        where: { id: play.id },
        data: {
          closingOddsAmerican: closing,
          closingCapturedAt: new Date(),
        },
        select: { id: true },
      });
    }
  }

  return {
    closingOddsAmerican: closing,
    clvPts: computeClvPts(play.oddsAmerican, closing),
  };
}

/** Compute CLV at grade time when a closing price exists. */
export function clvPtsForGrade(
  oddsAmerican: number,
  closingOddsAmerican: number | null | undefined,
): number | null {
  return computeClvPts(oddsAmerican, closingOddsAmerican);
}
