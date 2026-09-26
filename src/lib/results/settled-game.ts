/** Settled final-score row from a results provider (pure type, no I/O). */
export type SettledGame = {
  sport: string;
  home: string;
  away: string;
  homeScore: number;
  awayScore: number;
  completed: boolean;
  /** Provider confirmed the fixture will not be played; every market is VOID. */
  voided?: boolean;
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
  /** MLB Stats API gamePk used by the independent official box-score backstop. */
  mlbGamePk?: string;
  /** WNBA game identity and official page slug used for quarter scores. */
  wnbaGameId?: string;
  wnbaGameSlug?: string;
  /**
   * Scheduled start. Only used to date-scope the name-matching fallback for
   * plays that carry no eventId — without it, "Yankees ML" logged today can
   * match a Yankees game from last week that happens to be in the settled pool.
   * Optional because a provider may not report it; absent means "don't filter".
   */
  startsAt?: Date;
  /** Per-inning/period scoring supplied by the settled scoreboard, when present. */
  homePeriods?: number[];
  awayPeriods?: number[];
  /**
   * Periods the format plays in regulation, when the provider states it.
   *
   * Tennis reads this as the best-of: it is the difference between a completed
   * best-of-three and a best-of-five somebody retired out of after two sets,
   * and the two have very different game scores. See `tennisGamesWon`.
   */
  regulationPeriods?: number;
  /**
   * Every feed's copy of this final that the merge collapsed into this row.
   *
   * The merge keeps one copy and used to throw the rest away, so a stale
   * "final" from one feed could publish with nothing to contradict it: the Bucs
   * were graded 16-6 winners (a third-quarter score) while every other feed
   * had the Browns winning 23-19. Keeping each copy lets the publication gate
   * refuse a final the feeds disagree on. Absent = only this row's own feed.
   */
  reports?: ScoreReport[];
};

/** One feed's account of a final score, in the fixture's home/away order. */
export type ScoreReport = {
  source: string;
  homeScore: number;
  awayScore: number;
  voided?: boolean;
};

/** The feed a settled row came from, read off the id its mapper stamps. */
export function sourceOf(game: SettledGame): string {
  const id = game.eventId ?? "";
  const prefix = id.match(/^([a-z]+):/)?.[1];
  if (prefix) return prefix;
  if (/^[0-9a-f]{32}$/i.test(id)) return "odds-api";
  return "unknown";
}

/** Each feed's copy behind a settled row (its own, when nothing merged in). */
export function reportsOf(game: SettledGame): ScoreReport[] {
  return (
    game.reports ?? [
      {
        source: sourceOf(game),
        homeScore: game.homeScore,
        awayScore: game.awayScore,
        ...(game.voided ? { voided: true } : {}),
      },
    ]
  );
}

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
const EASTERN_DAY = new Intl.DateTimeFormat("en-CA", {
  timeZone: "America/New_York",
});

/**
 * Keys for one feed's rows: clubs + Eastern calendar day + game number.
 *
 * The Eastern day, not the UTC one: an 8:05pm ET first pitch is 00:05Z the
 * next day, and keying on the UTC date collapsed consecutive games of a series.
 *
 * The game number, not the start hour: this used to bucket by the hour, which
 * split one game whenever two feeds disagreed on first pitch (ESPN's actual
 * weather-delayed kickoff vs the scheduled one) and — worse — merged the two
 * games of a doubleheader, because MLB's feed lists game 2 at a placeholder
 * five minutes after game 1 (Orioles @ Yankees, 2026-09-25: 20:05Z and 20:10Z;
 * ESPN has 23:30Z). Both finals, 10-2 and 3-6, fell into one row and whichever
 * copy merged last decided every play on either game. Numbering a feed's games
 * between the same clubs on the same day, in start order, is how the league
 * itself tells them apart. Copies of one event (same id) share a number.
 *
 * Scores stand in for the day when a provider omits the start time.
 */
function fixtureKeys(games: readonly SettledGame[]): string[] {
  const team = (name: string) => name.toLowerCase().replace(/[^a-z0-9]/g, "");
  const base = games.map((g) =>
    [
      g.sport.toLowerCase(),
      team(g.home),
      team(g.away),
      g.startsAt
        ? EASTERN_DAY.format(g.startsAt)
        : `${g.homeScore}-${g.awayScore}`,
    ].join("|"),
  );
  const eventsByBase = new Map<string, { id: string; at: number }[]>();
  games.forEach((g, i) => {
    const id = g.eventId ?? `row${i}`;
    const events = eventsByBase.get(base[i]!) ?? [];
    if (!events.some((e) => e.id === id)) {
      events.push({ id, at: g.startsAt?.getTime() ?? 0 });
    }
    eventsByBase.set(base[i]!, events);
  });
  for (const events of eventsByBase.values()) {
    events.sort((a, b) => a.at - b.at);
  }
  return games.map((g, i) => {
    const id = g.eventId ?? `row${i}`;
    const number =
      eventsByBase.get(base[i]!)!.findIndex((e) => e.id === id) + 1;
    return `${base[i]}|${number}`;
  });
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
 * `fixtureKey` used to bucket by the hour, so if the two feeds disagreed about first
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

/** MLB gamePk for the same confidently matched fixture. */
export function mlbGamePkForFixture(
  game: SettledGame,
  pool: readonly SettledGame[],
): string | null {
  if (game.mlbGamePk) return game.mlbGamePk;
  const key = clubsKey(game);
  const candidates = pool.filter(
    (candidate) =>
      candidate !== game &&
      clubsKey(candidate) === key &&
      candidate.mlbGamePk != null,
  );
  const near =
    game.startsAt == null
      ? candidates
      : candidates.filter(
          (candidate) =>
            candidate.startsAt != null &&
            Math.abs(candidate.startsAt.getTime() - game.startsAt!.getTime()) <=
              SAME_GAME_HOURS * 3_600_000,
        );
  return near.length === 1 ? (near[0]!.mlbGamePk ?? null) : null;
}

/** Per-set / per-period scores and the format they were played in. */
export type FixtureLineScores = Pick<
  SettledGame,
  "homePeriods" | "awayPeriods" | "regulationPeriods"
>;

/**
 * The line scores for a fixture, looking past the merge when it did not
 * collapse — the same problem `espnIdForFixture` solves for the ESPN id.
 *
 * An event-bound play matches the Odds API copy, which carries the hash and
 * nothing else. Tennis games spreads and totals are settled from the per-set
 * scores, and only the free scoreboard reports those, so a fixture the two
 * feeds time differently would defer forever with the numbers sitting on the
 * other copy of the same match.
 *
 * A doubleheader-style pair of candidates settles nothing: line scores from the
 * wrong game would grade a real result against it.
 */
export function lineScoresForFixture(
  game: SettledGame,
  pool: readonly SettledGame[],
): FixtureLineScores | null {
  if (game.homePeriods?.length && game.awayPeriods?.length) {
    return {
      homePeriods: game.homePeriods,
      awayPeriods: game.awayPeriods,
      regulationPeriods: game.regulationPeriods,
    };
  }

  const key = clubsKey(game);
  const candidates = pool.filter(
    (candidate) =>
      candidate !== game &&
      clubsKey(candidate) === key &&
      candidate.homePeriods?.length &&
      candidate.awayPeriods?.length,
  );
  const near =
    game.startsAt == null
      ? candidates
      : candidates.filter(
          (candidate) =>
            candidate.startsAt != null &&
            Math.abs(candidate.startsAt.getTime() - game.startsAt!.getTime()) <=
              SAME_GAME_HOURS * 3_600_000,
        );
  if (near.length !== 1) return null;
  const match = near[0]!;
  return {
    homePeriods: match.homePeriods,
    awayPeriods: match.awayPeriods,
    regulationPeriods: match.regulationPeriods,
  };
}

export function mergeSettledGames(
  primary: SettledGame[],
  secondary: SettledGame[],
): SettledGame[] {
  const byKey = new Map<string, SettledGame>();
  const secondaryKeys = fixtureKeys(secondary);
  secondary.forEach((g, i) => byKey.set(secondaryKeys[i]!, g));
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
  const primaryKeys = fixtureKeys(primary);
  primary.forEach((g, i) => {
    const key = primaryKeys[i]!;
    const secondaryCopy = byKey.get(key);
    const espnEventId = espnIdOf(g) ?? espnIdOf(secondaryCopy ?? g);
    const mlbGamePk = g.mlbGamePk ?? secondaryCopy?.mlbGamePk;
    const wnbaGameId = g.wnbaGameId ?? secondaryCopy?.wnbaGameId;
    const wnbaGameSlug = g.wnbaGameSlug ?? secondaryCopy?.wnbaGameSlug;
    const homePeriods = g.homePeriods ?? secondaryCopy?.homePeriods;
    const awayPeriods = g.awayPeriods ?? secondaryCopy?.awayPeriods;
    const regulationPeriods =
      g.regulationPeriods ?? secondaryCopy?.regulationPeriods;
    const reports = secondaryCopy
      ? [...reportsOf(secondaryCopy), ...reportsOf(g)]
      : g.reports;
    byKey.set(key, {
      ...g,
      ...(reports ? { reports } : {}),
      ...(espnEventId ? { espnEventId } : {}),
      ...(mlbGamePk ? { mlbGamePk } : {}),
      ...(wnbaGameId ? { wnbaGameId } : {}),
      ...(wnbaGameSlug ? { wnbaGameSlug } : {}),
      ...(homePeriods ? { homePeriods } : {}),
      ...(awayPeriods ? { awayPeriods } : {}),
      ...(regulationPeriods ? { regulationPeriods } : {}),
    });
  });
  return [...byKey.values()];
}
