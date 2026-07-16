import "server-only";

import { getLeaderboardResult } from "@/lib/queries/leaderboard";
import type { CapperOgPayload } from "@/lib/og/tokens";

/**
 * Compact capper payload for OG cards — same leaderboard stats as the profile.
 */
export async function getCapperOgPayload(
  handle: string,
): Promise<CapperOgPayload | null> {
  const bare = handle.trim().replace(/^@+/, "").toLowerCase();
  if (!bare) return null;

  const { cappers, unranked } = await getLeaderboardResult();
  const capper =
    cappers.find((c) => c.handle.toLowerCase() === bare) ??
    unranked.find((c) => c.handle.toLowerCase() === bare);
  if (!capper) return null;

  return {
    handle: capper.handle,
    verified: capper.verified,
    record: capper.record,
    units: capper.units,
    roi: capper.roi,
    topSport: capper.topSport,
    settledPicks: capper.settledPicks ?? 0,
    performanceTrend: capper.performanceTrend ?? [0],
  };
}
