/**
 * Static manifest of self-hosted league/team marks under `public/marks/`.
 *
 * Major leagues: self-hosted PNGs pulled from ESPN public CDN.
 * Remaining sports: SVG sport-icons only when no PNG exists.
 */

/** Uppercase keys with a PNG in public/marks/leagues/ */
export const LEAGUE_PNG_MARKS = new Set<string>([
  "MLB",
  "NBA",
  "NFL",
  "NHL",
  "WNBA",
  "SOCCER",
  "MMA",
]);

/** SVG-only keys (no real PNG available). */
export const LEAGUE_SVG_MARKS = new Set<string>([
  "NCAAF",
  "NCAAB",
  "CFL",
  "UFL",
  "BOXING",
  "NASCAR",
  "PGA",
  "TENNIS",
]);

/** Any self-hosted league mark (png or svg). */
export const LEAGUE_MARKS = new Set<string>([
  ...LEAGUE_PNG_MARKS,
  ...LEAGUE_SVG_MARKS,
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
  MLS: "SOCCER",
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
  const token = upper.split(/[\s/_-]+/)[0] ?? "";
  if (LEAGUE_MARKS.has(token)) return token;
  if (LEAGUE_ALIASES[token]) return LEAGUE_ALIASES[token];
  return upper;
}

/** `${SPORT}:${ABBR}` keys with a file in public/marks/teams/{sport}/ */
export const TEAM_MARKS = new Set<string>([
  // Example: "MLB:LAD", "WNBA:LAS"
]);

/** Bump when replacing league mark binaries so CDN/browser caches refresh. */
const LEAGUE_MARK_ASSET_VERSION = "4";

export function leagueMarkSrc(key: string): string | undefined {
  const canonical = normalizeLeagueKey(key);
  if (!canonical) return undefined;
  if (LEAGUE_PNG_MARKS.has(canonical)) {
    return `/marks/leagues/${canonical.toLowerCase()}.png?v=${LEAGUE_MARK_ASSET_VERSION}`;
  }
  if (LEAGUE_SVG_MARKS.has(canonical)) {
    return `/marks/leagues/${canonical.toLowerCase()}.svg?v=${LEAGUE_MARK_ASSET_VERSION}`;
  }
  return undefined;
}

export function teamMarkSrc(sport: string, abbr: string): string | undefined {
  const sportUpper = normalizeLeagueKey(sport) || sport.trim().toUpperCase();
  const abbrUpper = abbr.trim().toUpperCase();
  if (!sportUpper || !abbrUpper) return undefined;
  const manifestKey = `${sportUpper}:${abbrUpper}`;
  if (!TEAM_MARKS.has(manifestKey)) return undefined;
  return `/marks/teams/${sportUpper.toLowerCase()}/${abbrUpper.toLowerCase()}.png`;
}
