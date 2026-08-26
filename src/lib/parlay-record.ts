/**
 * Projecting a parlay into a position of record.
 *
 * A parlay's legs are never rows of their own, so any surface that lists
 * positions must render the parlay itself. Pure and server-free so it can be
 * unit tested and shared by server queries and client components alike.
 */
import type { Outcome, VerificationTier } from "@prisma/client";

import type { ParlayLegView, PlayView } from "@/lib/queries/plays";
import { isVerifiedTier } from "@/lib/verification";

/** Market label a parlay carries when it appears in a list of positions. */
export const PARLAY_MARKET_LABEL = "Parlay";

export type ParlayRecordLeg = {
  id: string;
  sport: string;
  market: string;
  selection: string;
  oddsAmerican: number;
  side: string | null;
  book: string | null;
  verificationTier: VerificationTier;
  eventStartsAt: Date | null;
};

export type ParlayRecordRow = {
  id: string;
  combinedOddsAmerican: number | null;
  units: unknown;
  outcome: Outcome;
  profitUnits: unknown;
  createdAt: Date;
  legs: ParlayRecordLeg[];
};

/** Earliest leg start (or null) — a parlay's lifecycle anchors to its first game. */
export function earliestLegStart(
  legs: { eventStartsAt: Date | null }[],
): Date | null {
  const times = legs
    .map((l) => l.eventStartsAt)
    .filter((d): d is Date => d != null);
  if (times.length === 0) return null;
  return times.reduce((a, b) => (a.getTime() <= b.getTime() ? a : b));
}

/** Project a parlay so it can sit in one ordered ledger beside straight picks. */
export function parlayToRecordView(parlay: ParlayRecordRow): PlayView {
  const legs = parlay.legs;
  const legViews: ParlayLegView[] = legs.map((l) => ({
    id: l.id,
    sport: l.sport,
    market: l.market,
    selection: l.selection,
    oddsAmerican: l.oddsAmerican,
    side: l.side,
    book: l.book,
  }));
  return {
    id: parlay.id,
    // Parlay has no sport column; attribute to the first leg so sport filters
    // and league marks still have something truthful to read.
    sport: legs[0]?.sport ?? "",
    league: null,
    market: PARLAY_MARKET_LABEL,
    selection: `${legs.length}-leg parlay`,
    // 0 means "no stored combined price" — renderers must show an em-dash.
    oddsAmerican: parlay.combinedOddsAmerican ?? 0,
    units: Number(parlay.units),
    outcome: parlay.outcome,
    profitUnits: parlay.profitUnits == null ? null : Number(parlay.profitUnits),
    createdAt: parlay.createdAt,
    verificationTier:
      legs.length > 0 && legs.every((l) => isVerifiedTier(l.verificationTier))
        ? "VERIFIED"
        : "SELF_REPORTED",
    side: null,
    eventStartsAt: earliestLegStart(legs),
    eventLabel: null,
    book: null,
    notes: null,
    parlayLegs: legViews,
  };
}
