/**
 * Odds API board names vs ESPN scoreboard display names for the same club.
 *
 * `mentions()` matches by substring / last token. That never joins
 * "Inter Milan" to "Internazionale", which is why two Serie A moneylines
 * stayed `event_not_found` after the fixture was already FT on ESPN.
 *
 * First name in each group is the Odds API / board label. Keep Inter Miami
 * out of the Internazionale group — they share "Inter" and nothing else.
 */
const SOCCER_CLUB_NAME_GROUPS: readonly (readonly string[])[] = [
  [
    "Inter Milan",
    "Internazionale",
    "FC Internazionale",
    "FC Internazionale Milano",
  ],
  [
    "Paris Saint Germain",
    "Paris Saint-Germain",
    "Paris Saint-Germain F.C.",
    "PSG",
  ],
  [
    "Atletico Madrid",
    "Atlético Madrid",
    "Club Atlético de Madrid",
    "Atletico de Madrid",
  ],
  ["Bayern Munich", "FC Bayern Munich", "FC Bayern München", "Bayern München"],
  ["Sporting Lisbon", "Sporting CP", "Sporting Clube de Portugal"],
];

function clubKey(name: string): string {
  return name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "")
    .trim();
}

function groupFor(name: string): readonly string[] | null {
  const key = clubKey(name);
  if (!key) return null;
  return (
    SOCCER_CLUB_NAME_GROUPS.find((group) =>
      group.some((alias) => clubKey(alias) === key),
    ) ?? null
  );
}

/** Every accepted label for this club, or just the input when unknown. */
export function soccerClubAliases(name: string): string[] {
  const group = groupFor(name);
  return group ? [...group] : [name];
}

/** Prefer the Odds API / board label so ESPN finals join stored fixtures. */
export function canonicalSoccerClubName(name: string): string {
  const group = groupFor(name);
  return group?.[0] ?? name;
}
