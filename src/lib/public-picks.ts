import { deriveLifecycle } from "@/lib/lifecycle";
import type { CapperSummary, TodayPick } from "@/lib/mock";
import { matchupLabel, pickContextLabel } from "@/lib/pick-identity";
import { isValidPublicStake } from "@/lib/public-eligibility";
import { stakeFromStored } from "@/lib/extreme-stake";
import { publicPickEmbargoState } from "@/lib/public-pick-embargo";
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
  eventLabel?: string | null;
  homeTeam?: string | null;
  awayTeam?: string | null;
  eventStartsAt: Date | null;
  book?: string | null;
  closingOddsAmerican?: number | null;
  clvPts?: number | { toString(): string } | null;
  notes?: string | null;
  notesPublic?: boolean;
};

/**
 * Join DB plays to capper summaries for the public feed. Plays whose capper
 * is absent from `cappers` are dropped (no anonymous / email-leaking cards).
 */
export function joinPlaysToPublicPicks(
  plays: PublicPlayJoinRow[],
  cappers: CapperSummary[],
  now: Date = new Date(),
): TodayPick[] {
  const capperById = new Map(cappers.map((capper) => [capper.id, capper]));

  return plays.flatMap((play) => {
    const capper = capperById.get(play.capperId);
    if (!capper) return [];
    const stake = stakeFromStored(play.units, play.profitUnits);
    if (!isValidPublicStake(stake.units)) return [];
    const embargo = publicPickEmbargoState(play, now);
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
        event:
          matchupLabel(play) ??
          pickContextLabel({
            sport: play.sport,
            league: play.league,
            market: play.market,
          }),
        selection: embargo.isEmbargoed ? "Pick hidden" : play.selection,
        oddsAmerican: embargo.isEmbargoed ? 0 : play.oddsAmerican,
        units: stake.units,
        status: deriveLifecycle({
          outcome: play.outcome,
          eventStartsAt: play.eventStartsAt,
        }),
        postedAt: play.createdAt,
        gameTime: play.outcome === "PENDING" ? "Pending" : "Graded",
        verificationTier: play.verificationTier,
        side: embargo.isEmbargoed ? null : play.side,
        market: play.market,
        profitUnits: stake.profitUnits,
        book: embargo.isEmbargoed ? null : (play.book ?? null),
        eventStartsAt: play.eventStartsAt,
        closingOddsAmerican: embargo.isEmbargoed
          ? null
          : (play.closingOddsAmerican ?? null),
        clvPts:
          embargo.isEmbargoed || play.clvPts == null
            ? null
            : Number(play.clvPts),
        notes:
          embargo.isEmbargoed || play.notesPublic === false
            ? null
            : (play.notes ?? null),
        notesPublic: play.notesPublic ?? true,
        ...embargo,
      } satisfies TodayPick,
    ];
  });
}
