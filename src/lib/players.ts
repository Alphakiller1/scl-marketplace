/**
 * Player image / headshot assets — DEFERRED (owner).
 *
 * Slot only: do not wire player photos into pick cards, odds board, or profiles yet.
 * When enabled, prefer a CDN URL on a future `PlayerIdentity.imageUrl?` and always
 * fall back to initials (same graceful pattern as TeamMark / LeagueMark).
 *
 * Candidate CDN (not wired): ESPN headshots
 *   https://a.espncdn.com/i/headshots/{sport}/players/full/{playerId}.png
 */

export type PlayerIdentity = {
  key: string;
  displayName: string;
  /** Reserved — unset until player images ship. */
  imageUrl?: string;
};

/** Placeholder resolver — returns identity without an image URL. */
export function getPlayerIdentity(displayName: string): PlayerIdentity {
  const name = displayName.trim() || "Player";
  return {
    key: name.toLowerCase().replace(/[^a-z0-9]+/g, "-"),
    displayName: name,
  };
}
