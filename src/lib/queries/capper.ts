import "server-only";

import { cache } from "react";

import { prisma } from "@/lib/prisma";
import { getLeaderboardOrThrow } from "@/lib/queries/leaderboard";
import type { PlayView } from "@/lib/queries/plays";
import type { CapperSummary } from "@/lib/mock";

export type PublicCapper = {
  capper: CapperSummary;
  plays: PlayView[];
  /** True when the recent-plays query failed, so the page can show an error
   * state instead of a misleading "no plays" empty state. */
  playsError: boolean;
};

/**
 * The public profile payload for /cappers/[handle]. Pulls the capper from the
 * live leaderboard (so rank/stats stay consistent with the board) and attaches
 * their most recent tracked plays. Returns null when the handle isn't a ranked
 * capper, so the page can 404 honestly. Database failures propagate (rather than
 * resolving to null) so a transient outage surfaces an error instead of a false
 * 404 for a real handle.
 *
 * Wrapped in React.cache so a single request that calls this from both
 * generateMetadata and the page component only runs one leaderboard + plays load.
 */
export const getPublicCapperByHandle = cache(
  async function getPublicCapperByHandle(
    handle: string,
  ): Promise<PublicCapper | null> {
    const board = await getLeaderboardOrThrow();
    const capper = board.find((c) => c.handle === handle);
    if (!capper) return null;

    let plays: PlayView[] = [];
    let playsError = false;
    try {
      const rows = await prisma.play.findMany({
        where: { capper: { user: { username: handle } } },
        orderBy: { createdAt: "desc" },
        take: 8,
      });
      plays = rows.map((p) => ({
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
      }));
    } catch (err) {
      console.error("[getPublicCapperByHandle] plays unavailable:", err);
      playsError = true;
    }

    return { capper, plays, playsError };
  },
);
