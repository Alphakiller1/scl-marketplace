import { PREDICTION_UNIT_MAX } from "@/lib/constants";
import { round2 } from "@/lib/odds";

/**
 * Stakes at or above this are not real unit sizes — they are import/UI
 * sentinels (the Primos 999u ticket). New predictions already cap at 5u;
 * this is the read-time + repair threshold for rows that slipped in earlier.
 */
export const EXTREME_STAKE_UNITS = 100;

export function isExtremeStake(units: number): boolean {
  return Number.isFinite(units) && units >= EXTREME_STAKE_UNITS;
}

/**
 * Collapse a sentinel stake to the owner-controlled max and scale P/L with it.
 * LOSS of 999u becomes −5u; a +909 win at 999u becomes the same payout on 5u.
 */
export function normalizeExtremeStake(input: {
  units: number;
  profitUnits: number | null;
}): { units: number; profitUnits: number | null } {
  if (!isExtremeStake(input.units)) {
    return { units: input.units, profitUnits: input.profitUnits };
  }
  const scale = PREDICTION_UNIT_MAX / input.units;
  return {
    units: PREDICTION_UNIT_MAX,
    profitUnits:
      input.profitUnits == null ? null : round2(input.profitUnits * scale),
  };
}

/** Number() + clamp in one step for Prisma Decimal fields. */
export function stakeFromStored(
  units: { toString(): string } | number,
  profitUnits: { toString(): string } | number | null,
): { units: number; profitUnits: number | null } {
  return normalizeExtremeStake({
    units: Number(units),
    profitUnits: profitUnits == null ? null : Number(profitUnits),
  });
}
