/**
 * American-odds math and per-play profit/loss, in units.
 *
 * All money on SCL is denominated in *units* (a capper's standardized stake). A
 * settled play's profit is a pure function of its American odds, its unit stake,
 * and its outcome — see GRADING_WORKFLOW.md for the canonical rules.
 */
import type { Outcome } from "@prisma/client";

/** Round to 2 decimals without binary-float drift (matches the Decimal(10,2) column). */
export function round2(n: number): number {
  return Math.round((n + Number.EPSILON) * 100) / 100;
}

/** American odds → decimal (e.g. +150 → 2.5, −110 → 1.9090…). */
export function americanToDecimal(american: number): number {
  if (american === 0) return 1;
  return american > 0 ? 1 + american / 100 : 1 + 100 / Math.abs(american);
}

/** Decimal → American (inverse of americanToDecimal; ±100 at decimal 2.0). */
export function decimalToAmerican(decimal: number): number {
  if (decimal <= 1) return 0;
  return decimal >= 2
    ? Math.round((decimal - 1) * 100)
    : Math.round(-100 / (decimal - 1));
}

/** Multiply leg decimals into a combined parlay decimal. */
export function combineDecimalOdds(legDecimals: number[]): number {
  return legDecimals.reduce((acc, d) => acc * d, 1);
}

/**
 * Profit in units for a settled straight play, or `null` if not settled to a P/L.
 *   WIN  → stake × (decimal − 1)   (net winnings, stake excluded)
 *   LOSS → −stake
 *   PUSH → 0   ·   VOID → 0   (stake returned)
 *   PENDING → null
 */
export function profitUnitsForOutcome(
  outcome: Outcome,
  oddsAmerican: number,
  units: number,
): number | null {
  switch (outcome) {
    case "WIN":
      return round2(units * (americanToDecimal(oddsAmerican) - 1));
    case "LOSS":
      return round2(-units);
    case "PUSH":
    case "VOID":
      return 0;
    case "PENDING":
      return null;
    default:
      return null;
  }
}
