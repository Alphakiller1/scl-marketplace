/**
 * Real player headshots for MLB + WNBA player props.
 *
 * SCL's odds board and ghost seed carry player *names* (not IDs), so we resolve a
 * headshot by matching a known player's name inside a prop's selection text. Every
 * ESPN id below was verified to return a real image from the ESPN headshot CDN —
 * only add ids you've confirmed resolve, or the row renders a broken image.
 *
 * Coverage is the stars; anything unmatched falls back to initials in the UI.
 */

export type HeadshotLeague = "mlb" | "wnba";

export type PlayerHeadshot = {
  name: string;
  league: HeadshotLeague;
  espnId: string;
};

export const PLAYER_HEADSHOTS: PlayerHeadshot[] = [
  // ── MLB ──────────────────────────────────────────────────────────────────
  { name: "Aaron Judge", league: "mlb", espnId: "33192" },
  { name: "Shohei Ohtani", league: "mlb", espnId: "39832" },
  { name: "Mookie Betts", league: "mlb", espnId: "33039" },
  { name: "Juan Soto", league: "mlb", espnId: "36969" },
  { name: "Freddie Freeman", league: "mlb", espnId: "30193" },
  { name: "José Ramírez", league: "mlb", espnId: "30155" },
  { name: "Vladimir Guerrero Jr.", league: "mlb", espnId: "35002" },
  { name: "Ronald Acuña Jr.", league: "mlb", espnId: "36185" },
  { name: "Corbin Carroll", league: "mlb", espnId: "42404" },
  { name: "Kyle Tucker", league: "mlb", espnId: "39530" },
  // ── WNBA ─────────────────────────────────────────────────────────────────
  { name: "A'ja Wilson", league: "wnba", espnId: "2529622" },
  { name: "Caitlin Clark", league: "wnba", espnId: "4433403" },
  { name: "Breanna Stewart", league: "wnba", espnId: "2998928" },
  { name: "Sabrina Ionescu", league: "wnba", espnId: "4066533" },
  { name: "Kelsey Plum", league: "wnba", espnId: "3065570" },
  { name: "Arike Ogunbowale", league: "wnba", espnId: "3904577" },
  { name: "Jackie Young", league: "wnba", espnId: "4065870" },
  { name: "Alyssa Thomas", league: "wnba", espnId: "2491205" },
  { name: "Angel Reese", league: "wnba", espnId: "4433402" },
];

export function espnHeadshotUrl(
  league: HeadshotLeague,
  espnId: string,
): string {
  return `https://a.espncdn.com/i/headshots/${league}/players/full/${espnId}.png`;
}

export function playersForLeague(league: HeadshotLeague): PlayerHeadshot[] {
  return PLAYER_HEADSHOTS.filter((p) => p.league === league);
}

/** Map a Play's sport/league string ("MLB" | "WNBA") to a headshot league. */
export function toHeadshotLeague(
  value: string | null | undefined,
): HeadshotLeague | undefined {
  const v = value?.toLowerCase();
  return v === "mlb" || v === "wnba" ? v : undefined;
}

// Longest names first so "Vladimir Guerrero Jr." wins over a bare "Vladimir".
const BY_NAME_LENGTH = [...PLAYER_HEADSHOTS].sort(
  (a, b) => b.name.length - a.name.length,
);

// Normalize accents/punctuation so "Jose Ramirez" matches "José Ramírez".
function normalize(value: string): string {
  return value
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/['’.]/g, "");
}

/**
 * Find a known player named anywhere in `text` (a prop's selection string) and
 * return their headshot, optionally constrained to a league. Null when no known
 * player is named — the caller should fall back to initials.
 */
export function resolvePlayerHeadshot(
  text: string | null | undefined,
  league?: HeadshotLeague,
): PlayerHeadshot | null {
  if (!text) return null;
  const hay = normalize(text);
  for (const player of BY_NAME_LENGTH) {
    if (league && player.league !== league) continue;
    if (hay.includes(normalize(player.name))) return player;
  }
  return null;
}
