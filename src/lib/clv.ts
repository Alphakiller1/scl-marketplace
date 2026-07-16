/**
 * Closing Line Value (CLV) — pure helpers (no DB).
 * v1: raw implied-probability delta on the same book; no vig removal.
 */

/** American odds → implied probability (0–1). */
export function americanToImplied(american: number): number {
  if (american === 0) return 0;
  return american > 0
    ? 100 / (american + 100)
    : Math.abs(american) / (Math.abs(american) + 100);
}

/**
 * CLV in implied-probability points (positive = beat the close).
 * Returns null when either price is missing or invalid.
 */
export function computeClvPts(
  capturedAmerican: number | null | undefined,
  closingAmerican: number | null | undefined,
): number | null {
  if (
    capturedAmerican == null ||
    closingAmerican == null ||
    Math.abs(capturedAmerican) < 100 ||
    Math.abs(closingAmerican) < 100
  ) {
    return null;
  }
  const impliedCaptured = americanToImplied(capturedAmerican);
  const impliedClose = americanToImplied(closingAmerican);
  const delta = impliedClose - impliedCaptured;
  return Math.round((delta + Number.EPSILON) * 10_000) / 10_000;
}

/** Short tooltip copy (deliverables Step 6). */
export const CLV_TOOLTIP_SHORT =
  "Price vs the same book's closing odds — positive means you beat the close.";

/** Long explainer (≤120 words, deliverables Step 6). */
export const CLV_EXPLAINER_LONG =
  "Closing Line Value (CLV) measures whether the odds on your pick were better or worse than the same book's price at event start. A positive CLV means you captured a better number than the close; a negative CLV means the close was better. CLV is a pricing metric used by serious handicappers to evaluate process — it is not a prediction of future wins, and it does not guarantee profit. SCL only shows CLV on board-verified picks with a recorded closing price. If a close is unavailable, we show an em dash rather than an estimate.";
