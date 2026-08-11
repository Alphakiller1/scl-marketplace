import { PREDICTION_UNIT_MAX, PREDICTION_UNIT_MIN } from "@/lib/constants";

const UNIT_SCALE = 100;

/** New predictions accept 1.00–5.00 units with at most two decimal places. */
export function isValidPredictionUnits(units: number): boolean {
  if (
    !Number.isFinite(units) ||
    units < PREDICTION_UNIT_MIN ||
    units > PREDICTION_UNIT_MAX
  ) {
    return false;
  }
  const scaled = units * UNIT_SCALE;
  return Math.abs(scaled - Math.round(scaled)) < 1e-8;
}

/** Keep controlled UI state inside the owner-approved range and precision. */
export function clampPredictionUnits(units: number): number {
  if (!Number.isFinite(units)) return PREDICTION_UNIT_MIN;
  const bounded = Math.min(
    PREDICTION_UNIT_MAX,
    Math.max(PREDICTION_UNIT_MIN, units),
  );
  return Math.round((bounded + Number.EPSILON) * UNIT_SCALE) / UNIT_SCALE;
}
