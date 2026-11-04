/**
 * Full college basketball identities across the odds and scoreboard feeds.
 * Keep the school AND mascot. Abbreviation/spelling aliases must never make
 * two unrelated Bulldogs, Tigers, Rams, or Huskies interchangeable.
 */
export function canonicalNcaabTeamName(name: string): string {
  const normalized = name
    .normalize("NFD")
    .replace(/\p{M}/gu, "")
    .toLowerCase()
    .replace(/[^a-z0-9 ]/g, " ")
    .replace(/\b(state|saint)\b/g, "st")
    .replace(/\bmt\b/g, "mount")
    .replace(/\b(university|univ)\b/g, "")
    .replace(/\s+/g, " ")
    .trim();
  const aliases: Record<string, string> = {
    "appalachian st mountaineers": "app st mountaineers",
    "arkansas little rock trojans": "little rock trojans",
    "central connecticut st blue devils": "central connecticut blue devils",
    "loyola md greyhounds": "loyola maryland greyhounds",
    "connecticut huskies": "uconn huskies",
    "seattle u redhawks": "seattle redhawks",
  };
  return aliases[normalized] ?? normalized;
}
