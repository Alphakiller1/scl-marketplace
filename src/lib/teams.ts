export type TeamIdentity = {
  key: string;
  abbr: string;
  shortName: string;
  fullName: string;
  primaryColor: string;
  secondaryColor?: string;
};

type TeamRecord = TeamIdentity & { aliases: string[] };

const FALLBACK_COLORS = [
  "#f97316",
  "#14b8a6",
  "#3b82f6",
  "#a855f7",
  "#ef4444",
  "#22c55e",
  "#eab308",
  "#ec4899",
  "#06b6d4",
  "#8b5cf6",
];

const WNBA_TEAMS: TeamRecord[] = [
  team("ATL", "Dream", "Atlanta Dream", "#c8102e", ["Atlanta"]),
  team("CHI", "Sky", "Chicago Sky", "#4cc1e0", ["Chicago"]),
  team("CON", "Sun", "Connecticut Sun", "#f05023", ["Connecticut"]),
  team("DAL", "Wings", "Dallas Wings", "#002b5c", ["Dallas"]),
  team("GSV", "Valkyries", "Golden State Valkyries", "#6f42c1", [
    "Golden State",
    "GS Valkyries",
  ]),
  team("IND", "Fever", "Indiana Fever", "#c8102e", ["Indiana"]),
  team("LVA", "Aces", "Las Vegas Aces", "#a7a8aa", ["Las Vegas", "Vegas"]),
  team("LAS", "Sparks", "Los Angeles Sparks", "#552583", [
    "Los Angeles",
    "LA Sparks",
  ]),
  team("MIN", "Lynx", "Minnesota Lynx", "#005083", ["Minnesota"]),
  team("NYL", "Liberty", "New York Liberty", "#86cebc", [
    "New York",
    "NY Liberty",
  ]),
  team("PHO", "Mercury", "Phoenix Mercury", "#201747", ["Phoenix"]),
  team("POR", "Fire", "Portland Fire", "#e03a3e", ["Portland"]),
  team("SEA", "Storm", "Seattle Storm", "#2c5234", ["Seattle"]),
  team("TOR", "Tempo", "Toronto Tempo", "#6c1d45", ["Toronto"]),
  team("WAS", "Mystics", "Washington Mystics", "#002b5c", ["Washington"]),
];

const MLB_TEAMS: TeamRecord[] = [
  team("ARI", "D-backs", "Arizona Diamondbacks", "#a71930", [
    "Arizona",
    "Diamondbacks",
  ]),
  team("ATL", "Braves", "Atlanta Braves", "#13274f", ["Atlanta"]),
  team("BAL", "Orioles", "Baltimore Orioles", "#df4601", ["Baltimore"]),
  team("BOS", "Red Sox", "Boston Red Sox", "#bd3039", ["Boston"]),
  team("CHC", "Cubs", "Chicago Cubs", "#0e3386", ["Cubs"]),
  team("CWS", "White Sox", "Chicago White Sox", "#27251f", [
    "White Sox",
    "Chi White Sox",
  ]),
  team("CIN", "Reds", "Cincinnati Reds", "#c6011f", ["Cincinnati"]),
  team("CLE", "Guardians", "Cleveland Guardians", "#00385d", ["Cleveland"]),
  team("COL", "Rockies", "Colorado Rockies", "#333366", ["Colorado"]),
  team("DET", "Tigers", "Detroit Tigers", "#0c2340", ["Detroit"]),
  team("HOU", "Astros", "Houston Astros", "#002d62", ["Houston"]),
  team("KC", "Royals", "Kansas City Royals", "#004687", [
    "Kansas City",
    "KC Royals",
  ]),
  team("LAA", "Angels", "Los Angeles Angels", "#ba0021", [
    "LA Angels",
    "Los Angeles Angels of Anaheim",
  ]),
  team("LAD", "Dodgers", "Los Angeles Dodgers", "#005a9c", [
    "LA Dodgers",
    "Dodgers",
  ]),
  team("MIA", "Marlins", "Miami Marlins", "#00a3e0", ["Miami"]),
  team("MIL", "Brewers", "Milwaukee Brewers", "#12284b", ["Milwaukee"]),
  team("MIN", "Twins", "Minnesota Twins", "#002b5c", ["Minnesota"]),
  team("NYM", "Mets", "New York Mets", "#002d72", ["NY Mets", "Mets"]),
  team("NYY", "Yankees", "New York Yankees", "#0c2340", [
    "NY Yankees",
    "Yankees",
  ]),
  team("ATH", "Athletics", "Athletics", "#003831", [
    "A's",
    "Oakland Athletics",
    "Sacramento Athletics",
  ]),
  team("PHI", "Phillies", "Philadelphia Phillies", "#e81828", ["Philadelphia"]),
  team("PIT", "Pirates", "Pittsburgh Pirates", "#fdb827", ["Pittsburgh"]),
  team("SD", "Padres", "San Diego Padres", "#2f241d", ["San Diego"]),
  team("SF", "Giants", "San Francisco Giants", "#fd5a1e", ["San Francisco"]),
  team("SEA", "Mariners", "Seattle Mariners", "#0c2c56", ["Seattle"]),
  team("STL", "Cardinals", "St. Louis Cardinals", "#c41e3a", [
    "Saint Louis Cardinals",
    "St Louis Cardinals",
    "St. Louis",
  ]),
  team("TB", "Rays", "Tampa Bay Rays", "#092c5c", ["Tampa Bay"]),
  team("TEX", "Rangers", "Texas Rangers", "#003278", ["Texas"]),
  team("TOR", "Blue Jays", "Toronto Blue Jays", "#134a8e", ["Toronto"]),
  team("WSH", "Nationals", "Washington Nationals", "#ab0003", ["Washington"]),
];

const TEAMS_BY_SPORT: Record<string, TeamRecord[]> = {
  MLB: MLB_TEAMS,
  WNBA: WNBA_TEAMS,
};

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
  return fallbackTeam(name);
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

function fallbackTeam(name: string): TeamIdentity {
  const hash = hashString(name);
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
  return {
    key: `fallback-${normalize(name)}`,
    abbr,
    shortName: words.at(-1) ?? name,
    fullName: name,
    primaryColor: FALLBACK_COLORS[hash % FALLBACK_COLORS.length],
  };
}

function hashString(value: string): number {
  let hash = 0;
  for (let i = 0; i < value.length; i += 1) {
    hash = (hash * 31 + value.charCodeAt(i)) >>> 0;
  }
  return hash;
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
