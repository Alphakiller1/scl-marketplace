import "server-only";

import { getLeaderboard } from "@/lib/queries/leaderboard";
import { getCapperPlaysByHandle, type PlayView } from "@/lib/queries/plays";
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
 * capper, so the page can 404 honestly.
 */
export async function getPublicCapperByHandle(
  handle: string,
): Promise<PublicCapper | null> {
  const board = await getLeaderboard();
  const capper = board.find((c) => c.handle === handle);
  if (!capper) return null;

  let plays: PlayView[] = [];
  let playsError = false;
  try {
    plays = await getCapperPlaysByHandle(handle, 8);
  } catch (err) {
    console.error("[getPublicCapperByHandle] plays unavailable:", err);
    playsError = true;
  }

  return { capper, plays, playsError };
}
