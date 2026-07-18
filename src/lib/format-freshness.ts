/** Freshness label for Live-mode surfaces (page generation time). */
export function formatUpdatedAgo(at: Date, now = new Date()): string {
  const mins = Math.max(0, Math.floor((now.getTime() - at.getTime()) / 60_000));
  if (mins < 1) return "Updated just now";
  if (mins === 1) return "Updated 1m ago";
  if (mins < 60) return `Updated ${mins}m ago`;
  const hours = Math.floor(mins / 60);
  if (hours === 1) return "Updated 1h ago";
  return `Updated ${hours}h ago`;
}
