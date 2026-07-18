import "server-only";

import { prisma } from "@/lib/prisma";
import { summarizeClvTracker, type ClvTrackerSummary } from "@/lib/clv-tracker";
import { getLeaderboardResult } from "@/lib/queries/leaderboard";
import type { PlayView } from "@/lib/queries/plays";
import type { CapperSummary } from "@/lib/mock";
import { hasQaNoteMarker } from "@/lib/public-eligibility";
import {
  hasClvColumns,
  hasNotesPublicColumn,
} from "@/lib/results/schema-features";

export type PublicCapper = {
  capper: CapperSummary;
  plays: PlayView[];
  playsError: boolean;
  /** Average CLV pts when signal-sized snapshots exist; else null. */
  avgClv: number | null;
  /** Full CLV tracker summary from stored clvPts (never recomputed). */
  clvTracker: ClvTrackerSummary;
};

/**
 * The public profile payload for /cappers/[handle]. Pulls the capper from the
 * live leaderboard (so rank/stats stay consistent with the board) and attaches
 * their most recent tracked plays. Returns null when the handle isn't a public
 * capper (ranked or building a record), so the page can 404 honestly.
 */
export async function getPublicCapperByHandle(
  handle: string,
): Promise<PublicCapper | null> {
  const { cappers, unranked } = await getLeaderboardResult();
  const capper =
    cappers.find((c) => c.handle === handle) ??
    unranked.find((c) => c.handle === handle);
  if (!capper) return null;

  let plays: PlayView[] = [];
  let playsError = false;
  let avgClv: number | null = null;
  let clvTracker = summarizeClvTracker([]);
  try {
    const notesPublicReady = await hasNotesPublicColumn();
    const clvReady = await hasClvColumns();
    const rows = await prisma.play.findMany({
      where: { capper: { user: { username: handle } } },
      orderBy: { createdAt: "desc" },
      // Over-fetch so QA-noted plays filtered below don't thin the record.
      take: 48,
      select: {
        id: true,
        sport: true,
        league: true,
        market: true,
        selection: true,
        oddsAmerican: true,
        units: true,
        outcome: true,
        profitUnits: true,
        createdAt: true,
        verificationTier: true,
        side: true,
        eventStartsAt: true,
        book: true,
        notes: true,
        ...(notesPublicReady ? { notesPublic: true } : {}),
        ...(clvReady ? { closingOddsAmerican: true, clvPts: true } : {}),
      },
    });
    plays = rows
      .filter((p) => !hasQaNoteMarker(p.notes))
      .slice(0, 24)
      .map((p) => ({
        id: p.id,
        sport: p.sport,
        league: p.league,
        market: p.market,
        selection: p.selection,
        oddsAmerican: p.oddsAmerican,
        units: Number(p.units),
        outcome: p.outcome,
        profitUnits: p.profitUnits == null ? null : Number(p.profitUnits),
        createdAt: p.createdAt,
        verificationTier: p.verificationTier,
        side: p.side,
        eventStartsAt: p.eventStartsAt,
        book: p.book,
        notes: p.notes,
        notesPublic:
          "notesPublic" in p
            ? ((p as { notesPublic?: boolean }).notesPublic ?? true)
            : true,
        closingOddsAmerican:
          "closingOddsAmerican" in p
            ? ((p as { closingOddsAmerican?: number | null })
                .closingOddsAmerican ?? null)
            : null,
        clvPts:
          "clvPts" in p && (p as { clvPts?: unknown }).clvPts != null
            ? Number((p as { clvPts: unknown }).clvPts)
            : null,
      }));

    if (clvReady) {
      const clvRows = await prisma.play.findMany({
        where: {
          capperId: capper.id,
          clvPts: { not: null },
          verificationTier: { in: ["VERIFIED", "AUTO_VERIFIED"] },
          outcome: { not: "PENDING" },
          parlayId: null,
        },
        select: { clvPts: true },
      });
      const pts = clvRows
        .map((r) => (r.clvPts == null ? null : Number(r.clvPts)))
        .filter((v): v is number => v != null && Number.isFinite(v));
      clvTracker = summarizeClvTracker(pts);
      avgClv = clvTracker.avgClv;
    }
  } catch (err) {
    console.error("[getPublicCapperByHandle] plays unavailable:", err);
    playsError = true;
  }

  return { capper, plays, playsError, avgClv, clvTracker };
}
