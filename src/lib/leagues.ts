/**
 * League identity + optional CDN league logos.
 *
 * Logos use ESPN's public league-logo CDN. Missing/broken URLs must never blank
 * the UI — LeagueMark falls back to a deterministic color + initials mark.
 */

import { SPORTS, type SportKey } from "@/lib/constants";
import { leagueInitials } from "@/lib/league-action";
import { readableTextColor } from "@/lib/teams";

export type LeagueIdentity = {
  key: string;
  name: string;
  /** Optional remote logo (ESPN CDN). Prefer LeagueMark's onError color fallback. */
  logoUrl?: string;
  primaryColor: string;
};

/** ESPN league logo stems under /i/teamlogos/leagues/500/{stem}.png */
const ESPN_LEAGUE_STEM: Partial<Record<string, string>> = {
  MLB: "mlb",
  WNBA: "wnba",
  NBA: "nba",
  NFL: "nfl",
  NHL: "nhl",
  NCAAF: "college-football",
  NCAAB: "mens-college-basketball",
};

const LEAGUE_COLORS: Partial<Record<string, string>> = {
  MLB: "#002d72",
  WNBA: "#fa4616",
  NBA: "#1d428a",
  NFL: "#013369",
  NHL: "#111111",
  NCAAF: "#0a5630",
  NCAAB: "#0033a0",
  SOCCER: "#2ecc71",
  MMA: "#c0392b",
};

function espnLeagueLogoUrl(key: string): string | undefined {
  const stem = ESPN_LEAGUE_STEM[key.toUpperCase()];
  if (!stem) return undefined;
  return `https://a.espncdn.com/i/teamlogos/leagues/500/${stem}.png`;
}

const LEAGUE_BY_KEY = new Map<string, LeagueIdentity>();

for (const sport of SPORTS) {
  const key = sport.key;
  LEAGUE_BY_KEY.set(key.toUpperCase(), {
    key,
    name: sport.label,
    logoUrl: espnLeagueLogoUrl(key),
    primaryColor: LEAGUE_COLORS[key] ?? "#6d28d9",
  });
}

/** Resolve a league/sport key or display name to a LeagueIdentity (always returns something). */
export function getLeagueIdentity(keyOrName: string): LeagueIdentity {
  const raw = keyOrName.trim();
  if (!raw) {
    return {
      key: "SCL",
      name: "SCL",
      primaryColor: "#6d28d9",
    };
  }
  const upper = raw.toUpperCase();
  const byKey = LEAGUE_BY_KEY.get(upper);
  if (byKey) return byKey;

  for (const league of LEAGUE_BY_KEY.values()) {
    if (league.name.toUpperCase() === upper) return league;
  }

  // Deterministic fallback for unknown leagues (e.g. free-text legacy rows).
  return {
    key: upper.slice(0, 12),
    name: raw,
    primaryColor: "#6d28d9",
  };
}

export function leagueMarkInitials(league: LeagueIdentity): string {
  return leagueInitials(league.name || league.key);
}

export function leagueMarkTextColor(league: LeagueIdentity): string {
  return readableTextColor(league.primaryColor);
}

export type { SportKey };
