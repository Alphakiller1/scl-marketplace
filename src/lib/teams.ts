/**
 * Team identity + logos.
 *
 * Prefer self-hosted marks from `public/marks/teams/` when listed in the
 * manifest; otherwise use ESPN's public team-logo CDN. Missing/broken URLs
 * fall back to the deterministic color mark in TeamMark.
 *
 * Player headshots: OUT OF SCOPE — see `src/lib/players.ts` for the deferred slot.
 */

import { teamMarkSrc } from "@/lib/mark-manifest";

export type TeamIdentity = {
  key: string;
  abbr: string;
  shortName: string;
  fullName: string;
  primaryColor: string;
  secondaryColor?: string;
  /** Self-hosted mark or ESPN CDN team logo. */
  logoUrl?: string;
};

type TeamRecord = TeamIdentity & { aliases: string[] };

const FALLBACK_COLOR = "#3D4E6B";

/** ESPN CDN slug for our sport key → path segment under /i/teamlogos/{slug}/500/. */
const ESPN_SPORT_SLUG: Record<string, string> = {
  MLB: "mlb",
  WNBA: "wnba",
  NFL: "nfl",
  NBA: "nba",
  NHL: "nhl",
  NCAAF: "ncaa/football",
  NCAAB: "ncaa/basketball",
  CFL: "cfl",
};

/**
 * Our internal abbr → ESPN CDN file stem when they differ.
 * Default is lowercase of our abbr (e.g. NYY → nyy).
 */
const ESPN_ABBR_OVERRIDE: Record<string, Record<string, string>> = {
  MLB: {
    CWS: "chw",
  },
  WNBA: {
    GSV: "gs",
    LVA: "lv",
    LAS: "la",
    NYL: "ny",
    PHO: "phx",
    WAS: "wsh",
  },
};

export function espnTeamLogoUrl(
  sport: string,
  abbr: string,
): string | undefined {
  const slug = ESPN_SPORT_SLUG[sport.toUpperCase()];
  if (!slug) return undefined;
  const stem =
    ESPN_ABBR_OVERRIDE[sport.toUpperCase()]?.[abbr.toUpperCase()] ??
    abbr.toLowerCase();
  return `https://a.espncdn.com/i/teamlogos/${slug}/500/${stem}.png`;
}

const WNBA_TEAMS: TeamRecord[] = [
  team("WNBA", "ATL", "Dream", "Atlanta Dream", "#c8102e", ["Atlanta"]),
  team("WNBA", "CHI", "Sky", "Chicago Sky", "#4cc1e0", ["Chicago"]),
  team("WNBA", "CON", "Sun", "Connecticut Sun", "#f05023", ["Connecticut"]),
  team("WNBA", "DAL", "Wings", "Dallas Wings", "#002b5c", ["Dallas"]),
  team("WNBA", "GSV", "Valkyries", "Golden State Valkyries", "#6f42c1", [
    "Golden State",
    "GS Valkyries",
  ]),
  team("WNBA", "IND", "Fever", "Indiana Fever", "#c8102e", ["Indiana"]),
  team("WNBA", "LVA", "Aces", "Las Vegas Aces", "#a7a8aa", [
    "Las Vegas",
    "Vegas",
  ]),
  team("WNBA", "LAS", "Sparks", "Los Angeles Sparks", "#552583", [
    "Los Angeles",
    "LA Sparks",
  ]),
  team("WNBA", "MIN", "Lynx", "Minnesota Lynx", "#005083", ["Minnesota"]),
  team("WNBA", "NYL", "Liberty", "New York Liberty", "#86cebc", [
    "New York",
    "NY Liberty",
  ]),
  team("WNBA", "PHO", "Mercury", "Phoenix Mercury", "#201747", ["Phoenix"]),
  team("WNBA", "POR", "Fire", "Portland Fire", "#e03a3e", ["Portland"]),
  team("WNBA", "SEA", "Storm", "Seattle Storm", "#2c5234", ["Seattle"]),
  team("WNBA", "TOR", "Tempo", "Toronto Tempo", "#6c1d45", ["Toronto"]),
  team("WNBA", "WAS", "Mystics", "Washington Mystics", "#002b5c", [
    "Washington",
  ]),
];

const MLB_TEAMS: TeamRecord[] = [
  team("MLB", "ARI", "D-backs", "Arizona Diamondbacks", "#a71930", [
    "Arizona",
    "Diamondbacks",
  ]),
  team("MLB", "ATL", "Braves", "Atlanta Braves", "#13274f", ["Atlanta"]),
  team("MLB", "BAL", "Orioles", "Baltimore Orioles", "#df4601", ["Baltimore"]),
  team("MLB", "BOS", "Red Sox", "Boston Red Sox", "#bd3039", ["Boston"]),
  team("MLB", "CHC", "Cubs", "Chicago Cubs", "#0e3386", ["Cubs"]),
  team("MLB", "CWS", "White Sox", "Chicago White Sox", "#27251f", [
    "White Sox",
    "Chi White Sox",
  ]),
  team("MLB", "CIN", "Reds", "Cincinnati Reds", "#c6011f", ["Cincinnati"]),
  team("MLB", "CLE", "Guardians", "Cleveland Guardians", "#00385d", [
    "Cleveland",
  ]),
  team("MLB", "COL", "Rockies", "Colorado Rockies", "#333366", ["Colorado"]),
  team("MLB", "DET", "Tigers", "Detroit Tigers", "#0c2340", ["Detroit"]),
  team("MLB", "HOU", "Astros", "Houston Astros", "#002d62", ["Houston"]),
  team("MLB", "KC", "Royals", "Kansas City Royals", "#004687", [
    "Kansas City",
    "KC Royals",
  ]),
  team("MLB", "LAA", "Angels", "Los Angeles Angels", "#ba0021", [
    "LA Angels",
    "Los Angeles Angels of Anaheim",
  ]),
  team("MLB", "LAD", "Dodgers", "Los Angeles Dodgers", "#005a9c", [
    "LA Dodgers",
    "Dodgers",
  ]),
  team("MLB", "MIA", "Marlins", "Miami Marlins", "#00a3e0", ["Miami"]),
  team("MLB", "MIL", "Brewers", "Milwaukee Brewers", "#12284b", ["Milwaukee"]),
  team("MLB", "MIN", "Twins", "Minnesota Twins", "#002b5c", ["Minnesota"]),
  team("MLB", "NYM", "Mets", "New York Mets", "#002d72", ["NY Mets", "Mets"]),
  team("MLB", "NYY", "Yankees", "New York Yankees", "#0c2340", [
    "NY Yankees",
    "Yankees",
  ]),
  team("MLB", "ATH", "Athletics", "Athletics", "#003831", [
    "A's",
    "Oakland Athletics",
    "Sacramento Athletics",
  ]),
  team("MLB", "PHI", "Phillies", "Philadelphia Phillies", "#e81828", [
    "Philadelphia",
  ]),
  team("MLB", "PIT", "Pirates", "Pittsburgh Pirates", "#fdb827", [
    "Pittsburgh",
  ]),
  team("MLB", "SD", "Padres", "San Diego Padres", "#2f241d", ["San Diego"]),
  team("MLB", "SF", "Giants", "San Francisco Giants", "#fd5a1e", [
    "San Francisco",
  ]),
  team("MLB", "SEA", "Mariners", "Seattle Mariners", "#0c2c56", ["Seattle"]),
  team("MLB", "STL", "Cardinals", "St. Louis Cardinals", "#c41e3a", [
    "Saint Louis Cardinals",
    "St Louis Cardinals",
    "St. Louis",
  ]),
  team("MLB", "TB", "Rays", "Tampa Bay Rays", "#092c5c", ["Tampa Bay"]),
  team("MLB", "TEX", "Rangers", "Texas Rangers", "#003278", ["Texas"]),
  team("MLB", "TOR", "Blue Jays", "Toronto Blue Jays", "#134a8e", ["Toronto"]),
  team("MLB", "WSH", "Nationals", "Washington Nationals", "#ab0003", [
    "Washington",
  ]),
];

const TEAMS_BY_SPORT: Record<string, TeamRecord[]> = {
  MLB: MLB_TEAMS,
  WNBA: WNBA_TEAMS,
};

/** Spec map shape: normalizedName → { abbr, shortName, primaryColor }. */
export type TeamMapEntry = {
  abbr: string;
  shortName: string;
  primaryColor: string;
};

function toTeamMap(teams: TeamRecord[]): Record<string, TeamMapEntry> {
  const map: Record<string, TeamMapEntry> = {};
  for (const t of teams) {
    const entry = {
      abbr: t.abbr,
      shortName: t.shortName,
      primaryColor: t.primaryColor,
    };
    for (const alias of [t.fullName, t.shortName, t.abbr, ...t.aliases]) {
      map[normalize(alias)] = entry;
    }
  }
  return map;
}

export const WNBA: Record<string, TeamMapEntry> = toTeamMap(WNBA_TEAMS);
export const MLB: Record<string, TeamMapEntry> = toTeamMap(MLB_TEAMS);

const TEAM_INDEX = new Map<string, TeamRecord>();

for (const [sport, teams] of Object.entries(TEAMS_BY_SPORT)) {
  for (const t of teams) {
    for (const alias of [t.fullName, t.shortName, t.abbr, ...t.aliases]) {
      TEAM_INDEX.set(indexKey(sport, alias), t);
    }
  }
}

export function getTeamIdentity(name: string, sport?: string): TeamIdentity {
  const sports = sport ? [sport] : Object.keys(TEAMS_BY_SPORT);
  for (const s of sports) {
    const found = TEAM_INDEX.get(indexKey(s, name));
    if (found) return stripAliases(found);
  }
  return fallbackTeam(name, sport);
}

/**
 * Strict team lookup for public surfaces (picks feed, play rows). Returns null when the name is
 * not in the sport's known map — never invents a decorative mark from free text.
 */
export function resolveKnownTeam(
  name: string,
  sport: string,
): TeamIdentity | null {
  const found = TEAM_INDEX.get(indexKey(sport, name));
  return found ? stripAliases(found) : null;
}

export function readableTextColor(hex: string): "#0b0f19" | "#ffffff" {
  const rgb = parseHex(hex);
  if (!rgb) return "#ffffff";
  const [r, g, b] = rgb.map((n) => {
    const c = n / 255;
    return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
  });
  const luminance = 0.2126 * r + 0.7152 * g + 0.0722 * b;
  return luminance > 0.55 ? "#0b0f19" : "#ffffff";
}

function team(
  sport: "MLB" | "WNBA",
  abbr: string,
  shortName: string,
  fullName: string,
  primaryColor: string,
  aliases: string[] = [],
  secondaryColor?: string,
): TeamRecord {
  return {
    key: `${abbr}-${normalize(fullName)}`,
    abbr,
    shortName,
    fullName,
    primaryColor,
    secondaryColor,
    logoUrl: teamMarkSrc(sport, abbr) ?? espnTeamLogoUrl(sport, abbr),
    aliases,
  };
}

function stripAliases(t: TeamRecord): TeamIdentity {
  return {
    key: t.key,
    abbr: t.abbr,
    shortName: t.shortName,
    fullName: t.fullName,
    primaryColor: t.primaryColor,
    secondaryColor: t.secondaryColor,
    logoUrl: t.logoUrl,
  };
}

function indexKey(sport: string, value: string): string {
  return `${sport}:${normalize(value)}`;
}

function normalize(value: string): string {
  return value
    .toLowerCase()
    .replace(/&/g, "and")
    .replace(/\bst\.\b/g, "saint")
    .replace(/[^a-z0-9]+/g, "")
    .trim();
}

function fallbackTeam(name: string, sport?: string): TeamIdentity {
  const words = name
    .replace(/[^a-zA-Z0-9 ]+/g, " ")
    .split(/\s+/)
    .filter(Boolean);
  const abbr =
    words.length > 1
      ? words
          .slice(0, 3)
          .map((w) => w[0])
          .join("")
          .toUpperCase()
      : (words[0] ?? name).slice(0, 3).toUpperCase();
  const logoUrl = sport
    ? (teamMarkSrc(sport, abbr) ?? espnTeamLogoUrl(sport, abbr))
    : undefined;
  return {
    key: `fallback-${normalize(name)}`,
    abbr,
    shortName: words.at(-1) ?? name,
    fullName: name,
    primaryColor: FALLBACK_COLOR,
    logoUrl,
  };
}

function parseHex(hex: string): [number, number, number] | null {
  const raw = hex.replace("#", "");
  if (!/^[0-9a-f]{6}$/i.test(raw)) return null;
  return [
    Number.parseInt(raw.slice(0, 2), 16),
    Number.parseInt(raw.slice(2, 4), 16),
    Number.parseInt(raw.slice(4, 6), 16),
  ];
}
