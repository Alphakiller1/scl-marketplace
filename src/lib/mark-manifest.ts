/**
 * Static manifest of self-hosted league/team marks under `public/marks/`.
 *
 * Drop SVG files into:
 *   public/marks/leagues/{key}.svg   — e.g. mlb.svg
 *   public/marks/teams/{sport}/{abbr}.svg — e.g. mlb/lad.svg
 *
 * Add the key here when a file is added — no runtime fs checks.
 * League marks are SCL monograms (nominative lettermarks), not trademark wordmarks.
 */

/** Uppercase league/sport keys with a file in public/marks/leagues/ */
export const LEAGUE_MARKS = new Set<string>([
  "MLB",
  "NBA",
  "NFL",
  "NHL",
  "WNBA",
  "NCAAF",
  "NCAAB",
  "SOCCER",
  "MMA",
  "CFL",
  "UFL",
  "BOXING",
  "NASCAR",
  "PGA",
  "TENNIS",
]);

/** Common free-text / synonym → canonical sport key. */
const LEAGUE_ALIASES: Record<string, string> = {
  BASEBALL: "MLB",
  "MAJOR LEAGUE BASEBALL": "MLB",
  "AMERICAN LEAGUE": "MLB",
  "NATIONAL LEAGUE": "MLB",
  BASKETBALL: "NBA",
  "NATIONAL BASKETBALL ASSOCIATION": "NBA",
  FOOTBALL: "NFL",
  "AMERICAN FOOTBALL": "NFL",
  "NATIONAL FOOTBALL LEAGUE": "NFL",
  HOCKEY: "NHL",
  "NATIONAL HOCKEY LEAGUE": "NHL",
  "COLLEGE FOOTBALL": "NCAAF",
  CFB: "NCAAF",
  "COLLEGE BASKETBALL": "NCAAB",
  CBB: "NCAAB",
  "NCAA FOOTBALL": "NCAAF",
  "NCAA BASKETBALL": "NCAAB",
  SOCCER: "SOCCER",
  FOOTY: "SOCCER",
  FUTBOL: "SOCCER",
  UFC: "MMA",
  "MIXED MARTIAL ARTS": "MMA",
  GOLF: "PGA",
};

/** Normalize a sport/league string to a canonical uppercase key when possible. */
export function normalizeLeagueKey(key: string): string {
  const raw = key.trim();
  if (!raw) return "";
  const upper = raw.toUpperCase();
  if (LEAGUE_MARKS.has(upper)) return upper;
  if (LEAGUE_ALIASES[upper]) return LEAGUE_ALIASES[upper];
  // "MLB Baseball" / "NBA - East" → first token
  const token = upper.split(/[\s/_-]+/)[0] ?? "";
  if (LEAGUE_MARKS.has(token)) return token;
  if (LEAGUE_ALIASES[token]) return LEAGUE_ALIASES[token];
  return upper;
}

/** `${SPORT}:${ABBR}` keys with a file in public/marks/teams/{sport}/ */
export const TEAM_MARKS = new Set<string>([
  // Example: "MLB:LAD", "WNBA:LAS"
]);

/** Bump when regenerating league SVGs so CDN/browser caches refresh. */
const LEAGUE_MARK_ASSET_VERSION = "2";

export function leagueMarkSrc(key: string): string | undefined {
  const canonical = normalizeLeagueKey(key);
  if (!canonical || !LEAGUE_MARKS.has(canonical)) return undefined;
  return `/marks/leagues/${canonical.toLowerCase()}.svg?v=${LEAGUE_MARK_ASSET_VERSION}`;
}

export function teamMarkSrc(sport: string, abbr: string): string | undefined {
  const sportUpper = normalizeLeagueKey(sport) || sport.trim().toUpperCase();
  const abbrUpper = abbr.trim().toUpperCase();
  if (!sportUpper || !abbrUpper) return undefined;
  const manifestKey = `${sportUpper}:${abbrUpper}`;
  if (!TEAM_MARKS.has(manifestKey)) return undefined;
  return `/marks/teams/${sportUpper.toLowerCase()}/${abbrUpper.toLowerCase()}.svg`;
}
