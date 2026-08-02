import type { CapperSummary } from "@/lib/mock";

/**
 * Fields home Rank boards actually render. Stripping profile/chart baggage
 * keeps the home RSC flight much smaller (hero + Top Cappers duplicate rows).
 */
export function slimBoardCapper(capper: CapperSummary): CapperSummary {
  return {
    id: capper.id,
    name: capper.name,
    handle: capper.handle,
    displayName: capper.displayName,
    avatarUrl: capper.avatarUrl,
    verified: capper.verified,
    topSport: capper.topSport,
    rank: capper.rank,
    rankDelta: capper.rankDelta,
    record: capper.record,
    winPct: capper.winPct,
    units: capper.units,
    roi: capper.roi,
    streak: capper.streak,
    recentForm: [],
    trophies: [],
    settledPicks: capper.settledPicks,
    verifiedShare: capper.verifiedShare,
    sports: capper.sports,
    specialties: capper.specialties,
    publicOffers: capper.publicOffers,
  };
}
