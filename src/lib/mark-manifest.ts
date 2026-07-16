/**
 * Static manifest of self-hosted league/team marks under `public/marks/`.
 *
 * Drop SVG files into:
 *   public/marks/leagues/{key}.svg   — e.g. mlb.svg
 *   public/marks/teams/{sport}/{abbr}.svg — e.g. mlb/lad.svg
 *
 * Add the key here when a file is added — no runtime fs checks.
 */

/** Uppercase league/sport keys with a file in public/marks/leagues/ */
export const LEAGUE_MARKS = new Set<string>([
  // Example: "MLB", "WNBA", "NBA"
]);

/** `${SPORT}:${ABBR}` keys with a file in public/marks/teams/{sport}/ */
export const TEAM_MARKS = new Set<string>([
  // Example: "MLB:LAD", "WNBA:LAS"
]);

export function leagueMarkSrc(key: string): string | undefined {
  const upper = key.trim().toUpperCase();
  if (!upper || !LEAGUE_MARKS.has(upper)) return undefined;
  return `/marks/leagues/${upper.toLowerCase()}.svg`;
}

export function teamMarkSrc(sport: string, abbr: string): string | undefined {
  const sportUpper = sport.trim().toUpperCase();
  const abbrUpper = abbr.trim().toUpperCase();
  if (!sportUpper || !abbrUpper) return undefined;
  const manifestKey = `${sportUpper}:${abbrUpper}`;
  if (!TEAM_MARKS.has(manifestKey)) return undefined;
  return `/marks/teams/${sportUpper.toLowerCase()}/${abbrUpper.toLowerCase()}.svg`;
}
