import { resolveKnownTeam, type TeamIdentity } from "@/lib/teams";

/** Sides that are market directions, never team names. */
const NON_TEAM_SIDES = new Set(["over", "under"]);
const REAL_MARKET_TYPES = new Set(["moneyline", "spread", "total"]);

/**
 * When the game a pick belongs to was scheduled to start.
 *
 * Board picks store `eventStartsAt`. Imported legacy picks do not — 5,142 of
 * 5,781 plays have it null — but their `createdAt` is the event time, because
 * the legacy extractor derives it from the source row's date and time rather
 * than from when the row was written. `results/match.ts` already grades on that
 * basis (`play.eventStartsAt ?? play.createdAt`); this is the same rule for
 * display, so a receipt shows a game date instead of dropping the line for
 * nearly every pick on the site.
 *
 * Returns null only when there is genuinely nothing to show.
 */
export function pickEventDate(pick: {
  eventStartsAt?: Date | string | null;
  createdAt?: Date | string | null;
}): Date | string | null {
  return pick.eventStartsAt ?? pick.createdAt ?? null;
}

/**
 * The matchup line for a receipt: "Texas Rangers @ Los Angeles Angels".
 *
 * `eventLabel` is only written by the board entry path, and only since it was
 * added — 80 of 5,781 plays carry one. Where it is missing, the stored home and
 * away teams reconstruct it exactly; where those are missing too, the caller's
 * market label is the honest remainder. That fallback is why a settled Sparks
 * spread showed "SPREAD" while a Rangers total showed both teams: nothing to do
 * with winning or losing, only with which picks were logged after the board
 * started recording the matchup.
 */
export function matchupLabel(pick: {
  eventLabel?: string | null;
  homeTeam?: string | null;
  awayTeam?: string | null;
}): string | null {
  const stored = pick.eventLabel?.trim();
  if (stored) return stored;
  const away = pick.awayTeam?.trim();
  const home = pick.homeTeam?.trim();
  if (away && home) return `${away} @ ${home}`;
  return null;
}

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
  const marketIsRealType = REAL_MARKET_TYPES.has(normalizeLabel(market));
  const marketIsSport = normalizeLabel(market) === normalizeLabel(sport);
  const marketIsLeague =
    Boolean(league) && normalizeLabel(market) === normalizeLabel(league ?? "");

  if (marketIsSport || (marketIsLeague && !marketIsRealType)) return "";

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
