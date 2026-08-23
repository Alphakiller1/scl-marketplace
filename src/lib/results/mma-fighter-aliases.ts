/**
 * Odds API board names vs ESPN scoreboard display names for the same fighter.
 *
 * `mentions()` matches by substring / last token. That never joins
 * "Sergey Spivak" to "Serghei Spivac", which is why two UFC moneylines
 * stayed `event_not_found` after the co-main was already FINAL on ESPN.
 *
 * First name in each group is the Odds API / board label.
 */
const MMA_FIGHTER_NAME_GROUPS: readonly (readonly string[])[] = [
  ["Sergey Spivak", "Serghei Spivac", "Sergei Spivak", "Serghei Spivak"],
];

function fighterKey(name: string): string {
  return name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "")
    .trim();
}

function groupFor(name: string): readonly string[] | null {
  const key = fighterKey(name);
  if (!key) return null;
  return (
    MMA_FIGHTER_NAME_GROUPS.find((group) =>
      group.some((alias) => fighterKey(alias) === key),
    ) ?? null
  );
}

/** Every accepted label for this fighter, or just the input when unknown. */
export function mmaFighterAliases(name: string): string[] {
  const group = groupFor(name);
  return group ? [...group] : [name];
}

/** Prefer the Odds API / board label so ESPN finals join stored fixtures. */
export function canonicalMmaFighterName(name: string): string {
  const group = groupFor(name);
  return group?.[0] ?? name;
}
