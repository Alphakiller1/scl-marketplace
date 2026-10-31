/**
 * Settlement engine: turn outcomes into graded results + profit, per GRADING_WORKFLOW.md.
 *
 * Straight plays delegate to `profitUnitsForOutcome`. Parlays follow the house rules:
 *   - any leg still PENDING            → parlay PENDING (not yet gradable)
 *   - any leg LOSS                     → parlay LOSS (−stake)
 *   - PUSH/VOID legs are removed        → odds recombine over the surviving WIN legs
 *   - all legs removed (all push/void) → parlay PUSH (stake returned)
 *   - otherwise                        → parlay WIN on the recombined odds
 */
import {
  americanToDecimal,
  combineDecimalOdds,
  decimalToAmerican,
  round2,
} from "@/lib/odds";
import type { Outcome } from "@prisma/client";

export type ParlayLeg = { outcome: Outcome; oddsAmerican: number };

export type ParlaySettlement = {
  outcome: Outcome;
  profitUnits: number | null;
  /** Recombined American odds over surviving WIN legs, or null when N/A. */
  effectiveOddsAmerican: number | null;
  /** Number of legs that count toward the payout (WIN legs after push/void removal). */
  activeLegs: number;
};

export function settleParlay(
  legs: ParlayLeg[],
  stakeUnits: number,
): ParlaySettlement {
  if (legs.length === 0) {
    return {
      outcome: "VOID",
      profitUnits: 0,
      effectiveOddsAmerican: null,
      activeLegs: 0,
    };
  }
  if (legs.some((l) => l.outcome === "PENDING")) {
    return {
      outcome: "PENDING",
      profitUnits: null,
      effectiveOddsAmerican: null,
      activeLegs: 0,
    };
  }
  if (legs.some((l) => l.outcome === "LOSS")) {
    return {
      outcome: "LOSS",
      profitUnits: round2(-stakeUnits),
      effectiveOddsAmerican: null,
      activeLegs: 0,
    };
  }
  // Remaining legs are WIN or PUSH/VOID; drop the returned-stake legs.
  const winners = legs.filter((l) => l.outcome === "WIN");
  if (winners.length === 0) {
    return {
      outcome: "PUSH",
      profitUnits: 0,
      effectiveOddsAmerican: null,
      activeLegs: 0,
    };
  }
  const decimal = combineDecimalOdds(
    winners.map((l) => americanToDecimal(l.oddsAmerican)),
  );
  return {
    outcome: "WIN",
    profitUnits: round2(stakeUnits * (decimal - 1)),
    effectiveOddsAmerican: decimalToAmerican(decimal),
    activeLegs: winners.length,
  };
}

/** Whether a reason is required for an audit entry (overrides + manual grades). */
export function reasonRequired(
  source: "AUTO" | "ADMIN_OVERRIDE" | "MANUAL",
): boolean {
  return source !== "AUTO";
}
