import { deriveLifecycle } from "@/lib/lifecycle";
import {
  earliestLegStart,
  parlayBookLabel,
  parlayDisplaySport,
  parlayGameLabel,
  parlayTitle,
  parlayVerificationTier,
} from "@/lib/parlay-display";
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

export type PublicParlayJoinRow = {
  id: string;
  capperId: string;
  combinedOddsAmerican: number | null;
  units: number | { toString(): string };
  outcome: "PENDING" | "WIN" | "LOSS" | "PUSH" | "VOID";
  profitUnits: number | { toString(): string } | null;
  createdAt: Date;
  legs: {
    id: string;
    sport: string;
    league: string | null;
    market: string;
    selection: string;
    oddsAmerican: number;
    side: string | null;
    book: string | null;
    eventLabel?: string | null;
    homeTeam?: string | null;
    awayTeam?: string | null;
    eventStartsAt: Date | null;
    verificationTier: VerificationTier;
  }[];
};

/**
 * Join DB parlays to capper summaries for the public feed.
 *
 * A parlay is one position of record: one combined price, one stake, one
 * result. It reads on the ledger exactly like a straight pick does, with its
 * legs carried as detail — CLV is the one column it cannot fill, because a
 * parlay has no single closing price to measure against.
 */
export function joinParlaysToPublicPicks(
  parlays: PublicParlayJoinRow[],
  cappers: CapperSummary[],
  now: Date = new Date(),
): TodayPick[] {
  const capperById = new Map(cappers.map((capper) => [capper.id, capper]));

  return parlays.flatMap((parlay) => {
    const capper = capperById.get(parlay.capperId);
    if (!capper) return [];
    const stake = stakeFromStored(parlay.units, parlay.profitUnits);
    if (!isValidPublicStake(stake.units)) return [];
    const eventStartsAt = earliestLegStart(parlay.legs);
    const embargo = publicPickEmbargoState(
      { outcome: parlay.outcome, eventStartsAt },
      now,
    );
    return [
      {
        id: parlay.id,
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
        sport: parlayDisplaySport(parlay.legs),
        event: parlayGameLabel(parlay.legs) ?? "",
        selection: parlayTitle(parlay.legs.length),
        // An embargoed parlay's price would reconstruct its legs, so it waits.
        oddsAmerican: embargo.isEmbargoed
          ? 0
          : (parlay.combinedOddsAmerican ?? 0),
        units: stake.units,
        status: deriveLifecycle({ outcome: parlay.outcome, eventStartsAt }),
        postedAt: parlay.createdAt,
        gameTime: parlay.outcome === "PENDING" ? "Pending" : "Graded",
        verificationTier: parlayVerificationTier(parlay.legs),
        side: null,
        market: "Parlay",
        profitUnits: stake.profitUnits,
        book: embargo.isEmbargoed ? null : parlayBookLabel(parlay.legs),
        eventStartsAt,
        closingOddsAmerican: null,
        clvPts: null,
        notes: null,
        notesPublic: true,
        parlay: {
          combinedOddsAmerican: embargo.isEmbargoed
            ? null
            : parlay.combinedOddsAmerican,
          legs: parlay.legs.map((leg) => ({
            id: leg.id,
            sport: leg.sport,
            market: leg.market,
            selection: embargo.isEmbargoed ? "Pick hidden" : leg.selection,
            oddsAmerican: embargo.isEmbargoed ? 0 : leg.oddsAmerican,
            side: embargo.isEmbargoed ? null : leg.side,
            book: embargo.isEmbargoed ? null : leg.book,
            event: matchupLabel(leg),
          })),
        },
        ...embargo,
      } satisfies TodayPick,
    ];
  });
}

/** Straight picks + parlays as one most-recent-first public feed. */
export function mergePublicPicks(...groups: TodayPick[][]): TodayPick[] {
  return groups
    .flat()
    .sort(
      (a, b) => new Date(b.postedAt).getTime() - new Date(a.postedAt).getTime(),
    );
}

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
