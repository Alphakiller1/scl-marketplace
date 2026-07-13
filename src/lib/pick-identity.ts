import { resolveKnownTeam, type TeamIdentity } from "@/lib/teams";

/** Sides that are market directions, never team names. */
const NON_TEAM_SIDES = new Set(["over", "under"]);

/**
 * Safe team identity for a board-structured `side` only. Returns null for Over/Under,
 * empty/missing side, or any name that isn't in the sport's known team map.
 * Never parses free-text `selection` — trust > decoration.
 */
export function teamIdentityFromSide(
  side: string | null | undefined,
  sport: string,
): TeamIdentity | null {
  if (!side) return null;
  const trimmed = side.trim();
  if (!trimmed) return null;
  if (NON_TEAM_SIDES.has(trimmed.toLowerCase())) return null;
  return resolveKnownTeam(trimmed, sport);
}

/**
 * Secondary context line under the sport badge. Always prefers market; only includes league
 * when it is distinct from both sport and market — so "MLB" + league "MLB" never becomes
 * "MLB MLB".
 */
export function pickContextLabel(opts: {
  sport: string;
  league?: string | null;
  market: string;
}): string {
  const league = opts.league?.trim();
  const sport = opts.sport.trim();
  const market = opts.market.trim();
  if (
    league &&
    normalizeLabel(league) !== normalizeLabel(sport) &&
    normalizeLabel(league) !== normalizeLabel(market)
  ) {
    return `${league} · ${market}`;
  }
  return market;
}

function normalizeLabel(value: string): string {
  return value.toLowerCase().replace(/[^a-z0-9]+/g, "");
}
