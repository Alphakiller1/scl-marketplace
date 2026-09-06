/** Parlay legs must be reviewed on their ticket so profit is counted once. */
export function adminGradingHref(play: {
  id: string;
  parlayId: string | null;
}): string {
  return play.parlayId
    ? `/admin/plays/parlay/${encodeURIComponent(play.parlayId)}`
    : `/admin/plays/straight/${encodeURIComponent(play.id)}`;
}
