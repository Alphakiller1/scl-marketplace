/** Freshness label for Live-mode surfaces (page generation time). */
export function formatUpdatedAgo(at: Date, now = new Date()): string {
  const mins = Math.max(0, Math.floor((now.getTime() - at.getTime()) / 60_000));
  if (mins < 1) return "Updated Just Now";
  if (mins === 1) return "Updated 1m Ago";
  if (mins < 60) return `Updated ${mins}m Ago`;
  const hours = Math.floor(mins / 60);
  if (hours === 1) return "Updated 1h Ago";
  return `Updated ${hours}h Ago`;
}
