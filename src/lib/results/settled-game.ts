/** Settled final-score row from a results provider (pure type, no I/O). */
export type SettledGame = {
  sport: string;
  home: string;
  away: string;
  homeScore: number;
  awayScore: number;
  completed: boolean;
  /** Odds API event id when available — preferred join key for grading. */
  eventId?: string;
  /**
   * Scheduled start. Only used to date-scope the name-matching fallback for
   * plays that carry no eventId — without it, "Yankees ML" logged today can
   * match a Yankees game from last week that happens to be in the settled pool.
   * Optional because a provider may not report it; absent means "don't filter".
   */
  startsAt?: Date;
};

/**
 * Identity of a FIXTURE, not of a provider's record of it.
 *
 * This used to key on `eventId`, but the two providers issue completely
 * different ids for the same game — the Odds API a hash, ESPN a numeric id —
 * so nothing ever deduped and every fixture appeared twice in the merged pool.
 * `findGame` then saw two candidates for every name match and `sole()` refused
 * them all, which stopped the grader settling ANY play with no eventId: every
 * imported legacy pick. Keying on the fixture itself collapses the two copies.
 *
 * The date keeps a series apart when two games between the same clubs end on
 * the same score; scores stand in when a provider omits the start time.
 */
function fixtureKey(g: SettledGame): string {
  const team = (name: string) => name.toLowerCase().replace(/[^a-z0-9]/g, "");
  // Hour bucket, NOT the calendar date. A late Eastern game rolls into the next
  // UTC day — an 8:05pm ET first pitch is 00:05Z tomorrow — so keying on the date
  // collapsed consecutive games of a series between the same clubs into one, and
  // the wrong one survived. Rounding absorbs small disagreements between
  // providers (22:59 vs 23:01) while staying finer than the fixture window, so a
  // doubleheader's two games remain distinct.
  const when = g.startsAt
    ? String(Math.round(g.startsAt.getTime() / 3_600_000))
    : `${g.homeScore}-${g.awayScore}`;
  return [g.sport.toLowerCase(), team(g.home), team(g.away), when].join("|");
}

export function mergeSettledGames(
  primary: SettledGame[],
  secondary: SettledGame[],
): SettledGame[] {
  const byKey = new Map<string, SettledGame>();
  for (const g of secondary) byKey.set(fixtureKey(g), g);
  // Primary last so its copy wins: it carries the eventId that event-bound
  // plays are matched on. When only the backstop has the game — anything past
  // the Odds API lookback — its copy is the one that survives, which is the
  // whole point of having a backstop.
  for (const g of primary) byKey.set(fixtureKey(g), g);
  return [...byKey.values()];
}
