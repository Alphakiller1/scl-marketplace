import type { CapperSummary, TodayPick } from "@/lib/mock";
import { pickContextLabel } from "@/lib/pick-identity";
import type { VerificationTier } from "@/lib/verification";

/** Ranked + building-a-record cappers for public recent-feed identity joins. */
export function publicFeedCappers(
  ranked: CapperSummary[],
  unranked: CapperSummary[] = [],
): CapperSummary[] {
  if (!unranked.length) return ranked;
  return ranked.concat(unranked);
}

export type PublicPlayJoinRow = {
  id: string;
  capperId: string;
  sport: string;
  league: string | null;
  market: string;
  selection: string;
  oddsAmerican: number;
  units: number | { toString(): string };
  outcome: "PENDING" | "WIN" | "LOSS" | "PUSH" | "VOID";
  profitUnits: number | { toString(): string } | null;
  createdAt: Date;
  verificationTier: VerificationTier;
  side: string | null;
};

const OUTCOME_TO_PICK_STATUS = {
  PENDING: "pending",
  WIN: "win",
  LOSS: "loss",
  PUSH: "push",
  VOID: "void",
} as const satisfies Record<PublicPlayJoinRow["outcome"], TodayPick["status"]>;

/**
 * Join DB plays to capper summaries for the public feed. Plays whose capper
 * is absent from `cappers` are dropped (no anonymous / email-leaking cards).
 */
export function joinPlaysToPublicPicks(
  plays: PublicPlayJoinRow[],
  cappers: CapperSummary[],
): TodayPick[] {
  const capperById = new Map(cappers.map((capper) => [capper.id, capper]));

  return plays.flatMap((play) => {
    const capper = capperById.get(play.capperId);
    if (!capper) return [];
    return [
      {
        id: play.id,
        capper: {
          id: capper.id,
          name: capper.name,
          handle: capper.handle,
          displayName: null,
          verified: capper.verified,
          avatarUrl: capper.avatarUrl,
        },
        capperRecord: capper.record,
        capperRank: capper.rank,
        capperSettledPicks: capper.settledPicks ?? 0,
        sport: play.sport,
        event: pickContextLabel({
          sport: play.sport,
          league: play.league,
          market: play.market,
        }),
        selection: play.selection,
        oddsAmerican: play.oddsAmerican,
        units: Number(play.units),
        status: OUTCOME_TO_PICK_STATUS[play.outcome],
        postedAt: play.createdAt,
        gameTime: play.outcome === "PENDING" ? "Pending" : "Graded",
        verificationTier: play.verificationTier,
        side: play.side,
        market: play.market,
        profitUnits: play.profitUnits == null ? null : Number(play.profitUnits),
      } satisfies TodayPick,
    ];
  });
}
