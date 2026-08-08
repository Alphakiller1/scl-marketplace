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
   * ESPN's numeric event id for this fixture, when a provider knows it.
   *
   * Kept SEPARATE from `eventId` because the two are needed for different
   * things and only one of them can win the merge: `eventId` is the Odds API
   * hash that event-bound plays are matched on, while box-score grading (player
   * props, first-N-innings segments) has to call ESPN's summary endpoint, which
   * only accepts this id. Folding both into one field is what stopped every
   * prop grading — see `mergeSettledGames`.
   */
  espnEventId?: string;
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

/**
 * The ESPN id a settled game carries, from either shape a provider can use.
 * The scoreboard mapper stamps `eventId: "espn:<id>"` on its own copy; the
 * merged copy carries the bare id in `espnEventId`.
 */
export function espnIdOf(game: SettledGame): string | null {
  if (game.espnEventId) return game.espnEventId;
  const id = game.eventId;
  return id?.startsWith("espn:") ? id.slice("espn:".length) : null;
}

/** Clubs only — the fixture without the clock the two providers can disagree on. */
function clubsKey(g: SettledGame): string {
  const team = (name: string) => name.toLowerCase().replace(/[^a-z0-9]/g, "");
  return [g.sport.toLowerCase(), team(g.home), team(g.away)].join("|");
}

const SAME_GAME_HOURS = 12;

/**
 * The ESPN id for a fixture, looking past the merge when it did not collapse.
 *
 * `fixtureKey` buckets by the hour, so if the two feeds disagree about first
 * pitch by more than the rounding absorbs — a delayed start one of them updated
 * — the same game stays as two entries. The Odds API copy is the one an
 * event-bound play matches (it carries the hash), and it has no ESPN id, so
 * box-score grading deferred that play forever while the id sat on the other
 * copy of the very same game.
 *
 * Matching on clubs alone would cross-match a series, so a candidate must also
 * start within half a day. A doubleheader yields two candidates and settles
 * neither: an ambiguous id would grade a prop against the wrong game, which is
 * worse than leaving it pending.
 */
export function espnIdForFixture(
  game: SettledGame,
  pool: readonly SettledGame[],
): string | null {
  const direct = espnIdOf(game);
  if (direct) return direct;

  const key = clubsKey(game);
  const candidates = pool.filter(
    (g) => g !== game && clubsKey(g) === key && espnIdOf(g) != null,
  );
  const near =
    game.startsAt == null
      ? candidates
      : candidates.filter(
          (g) =>
            g.startsAt != null &&
            Math.abs(g.startsAt.getTime() - game.startsAt!.getTime()) <=
              SAME_GAME_HOURS * 3_600_000,
        );

  return near.length === 1 ? espnIdOf(near[0]!) : null;
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
  //
  // Carry the loser's ESPN id onto the winner, though. Box-score grading (every
  // player prop, every F3/F5/F7 segment) can only call ESPN's summary endpoint,
  // which needs ESPN's numeric id — and the Odds API copy, which wins any
  // fixture inside its 3-day scores window, has only a hash. Dropping the ESPN
  // id here meant no recent prop could EVER auto-grade: the grader read the
  // merged game, found no ESPN id, and deferred the play every single run.
  for (const g of primary) {
    const key = fixtureKey(g);
    const espnEventId = espnIdOf(g) ?? espnIdOf(byKey.get(key) ?? g);
    byKey.set(key, espnEventId ? { ...g, espnEventId } : g);
  }
  return [...byKey.values()];
}
