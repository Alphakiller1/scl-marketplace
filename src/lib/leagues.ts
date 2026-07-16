/**
 * League identity + optional self-hosted marks from `public/marks/leagues/`.
 *
 * Marks are gated by `src/lib/mark-manifest.ts` — missing entries always render
 * the deterministic color + initials fallback in LeagueMark.
 */

import { SPORTS, type SportKey } from "@/lib/constants";
import { leagueInitials } from "@/lib/league-action";
import { leagueMarkSrc, normalizeLeagueKey } from "@/lib/mark-manifest";
import { readableTextColor } from "@/lib/teams";

export type LeagueIdentity = {
  key: string;
  name: string;
  /** Self-hosted mark under /marks/leagues/ when listed in the manifest. */
  logoUrl?: string;
  primaryColor: string;
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

const LEAGUE_BY_KEY = new Map<string, LeagueIdentity>();

for (const sport of SPORTS) {
  const key = sport.key;
  LEAGUE_BY_KEY.set(key.toUpperCase(), {
    key,
    name: sport.label,
    logoUrl: leagueMarkSrc(key),
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
  const canonical = normalizeLeagueKey(raw);
  const byKey = LEAGUE_BY_KEY.get(canonical);
  if (byKey) return byKey;

  const upper = raw.toUpperCase();
  for (const league of LEAGUE_BY_KEY.values()) {
    if (league.name.toUpperCase() === upper) return league;
  }

  // Deterministic fallback for unknown leagues (e.g. free-text legacy rows).
  return {
    key: (canonical || upper).slice(0, 12),
    name: raw,
    primaryColor: "#6d28d9",
    logoUrl: leagueMarkSrc(canonical),
  };
}

export function leagueMarkInitials(league: LeagueIdentity): string {
  return leagueInitials(league.name || league.key);
}

export function leagueMarkTextColor(league: LeagueIdentity): string {
  return readableTextColor(league.primaryColor);
}

export type { SportKey };
