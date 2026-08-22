import "server-only";

import { getPublicCapperByHandle } from "@/lib/queries/capper";
import type { CapperOgPayload } from "@/lib/og/tokens";

/**
 * Compact capper payload for OG cards — same all-time stats as the profile.
 * Targeted handle lookup; never scan the activity-gated leaderboard (inactive
 * legacy cappers would disappear from share cards).
 */
export async function getCapperOgPayload(
  handle: string,
): Promise<CapperOgPayload | null> {
  const data = await getPublicCapperByHandle(handle);
  if (!data) return null;
  const { capper } = data;

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
