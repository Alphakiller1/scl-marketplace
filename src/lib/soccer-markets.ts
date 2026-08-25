/**
 * Soccer markets beyond the surface three — currently Double Chance.
 *
 * One source of truth shared by the board (what a capper can log), verification
 * (which Odds API key prices it) and grading (how it settles). They MUST agree,
 * and this market is a sharper trap than most: the provider names its outcomes
 * "Crystal Palace or Draw" / "Crystal Palace or Manchester City", which the
 * moneyline resolver happily reads as a team pick. A draw would then settle a
 * winning "Palace or Draw" ticket as a LOSS — a wrong result written onto a
 * public record, which is exactly the failure the team-total and period-market
 * registries exist to prevent.
 *
 * Pure — no network, no server-only, unit-testable.
 */

/** Odds API market key. There is no alternate ladder — the three outcomes are it. */
export const DOUBLE_CHANCE_MARKET_KEY = "double_chance";

/** Stored `market` label. Display may abbreviate; storage never does. */
export const DOUBLE_CHANCE_LABEL = "Double Chance";

/** Exact match, not a substring — nothing else may pass as this market. */
export function isDoubleChanceMarket(market: string): boolean {
  return market.trim().toLowerCase() === DOUBLE_CHANCE_LABEL.toLowerCase();
}

export type DoubleChanceSelection =
  | { kind: "team-or-draw"; team: string }
  | { kind: "either-team"; teams: [string, string] };

/**
 * Read a Double Chance outcome name apart.
 *
 * Deliberately strict: it accepts only the two shapes the provider writes,
 * `"<team> or Draw"` and `"<team> or <team>"`. Anything else returns null and
 * the pick stays deferred, because guessing which combination a loose string
 * names is how a wrong result gets written.
 */
export function parseDoubleChanceSelection(
  selection: string,
): DoubleChanceSelection | null {
  const parts = selection.split(/\s+or\s+/i).map((part) => part.trim());
  if (parts.length !== 2 || parts.some((part) => part.length === 0)) {
    return null;
  }
  const [first, second] = parts as [string, string];
  const firstIsDraw = first.toLowerCase() === "draw";
  const secondIsDraw = second.toLowerCase() === "draw";
  // "Draw or Draw" is not a market; two draws means the string was not one of
  // the provider's shapes at all.
  if (firstIsDraw && secondIsDraw) return null;
  if (secondIsDraw) return { kind: "team-or-draw", team: first };
  if (firstIsDraw) return { kind: "team-or-draw", team: second };
  return { kind: "either-team", teams: [first, second] };
}
