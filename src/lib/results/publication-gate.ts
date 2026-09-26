import type { GradablePlay } from "@/lib/results/match";
import { reportsOf, type SettledGame } from "@/lib/results/settled-game";

/**
 * The last check before a grade becomes a public, "verified" result.
 *
 * Matching decides WHICH game a play belongs to; this decides whether that
 * game's final is trustworthy enough to publish. Every wrong grade in
 * September 2026 passed matching and would have failed here:
 *
 * - Rutgers -41.5 (NCAAF) settled 94 minutes after kickoff, against Army's
 *   final. No college football game finishes in 94 minutes.
 * - Buccaneers ML / -7.5 / -8.5 settled as 16-6 winners — a third-quarter
 *   score — from a backstop feed's early "final" while ESPN had not finished
 *   the game. The Browns won 23-19.
 *
 * A blocked play stays PENDING and is retried on the next run. A late grade is
 * an inconvenience; a wrong one is a false entry on a verified record.
 */

/**
 * Feeds that may not settle a game on their own word.
 *
 * SportsPuff is a third-party aggregator kept as a backstop. It still counts:
 * its copy must agree with the others, but it cannot be the only one.
 */
const CORROBORATION_ONLY_SOURCES = new Set(["sportspuff", "unknown"]);

/**
 * The shortest a game in each sport can plausibly take, kickoff to final.
 *
 * Deliberately below the real minimum — this is a floor that catches "this
 * cannot be over yet", not an estimate of when it will be. A rain-shortened
 * five-inning MLB game can finish near 75 minutes; the fastest NFL and college
 * games still run well past two and a half hours. MMA has no floor: a fight
 * can end in seconds, and ESPN stamps every bout with the card's start.
 */
const MIN_GAME_MINUTES: Record<string, number> = {
  NFL: 150,
  NCAAF: 150,
  CFL: 150,
  MLB: 75,
  NBA: 105,
  NCAAB: 95,
  WNBA: 90,
  NHL: 100,
  SOCCER: 100,
  TENNIS: 40,
  MMA: 0,
};
const DEFAULT_MIN_GAME_MINUTES = 60;

export function minGameMinutes(sport: string): number {
  return (
    MIN_GAME_MINUTES[sport.trim().toUpperCase()] ?? DEFAULT_MIN_GAME_MINUTES
  );
}

export type PublicationBlock =
  | "too_early"
  | "sources_disagree"
  | "unconfirmed_source";

export type PublicationVerdict =
  | { ok: true }
  | { ok: false; block: PublicationBlock; detail: string };

/**
 * Has enough time passed since kickoff for this game to possibly be over?
 *
 * Measured from the LATER of the two starts. The slip keeps the scheduled time
 * while the scoreboard records the real one, and a weather delay (Mississippi
 * State–South Carolina went off 80 minutes late) is exactly when a game is
 * still being played long after the slip says it should be finished.
 */
export function tooEarlyToSettle(
  play: Pick<GradablePlay, "sport" | "eventStartsAt">,
  game: Pick<SettledGame, "startsAt"> | null,
  now: Date,
): boolean {
  return !pastKickoff(play, game, now, minGameMinutes(play.sport));
}

/** Minutes a disagreeing backstop can hold a grade before it is outvoted. */
const BACKSTOP_VETO_WINDOW_MINUTES = 6 * 60;

function pastKickoff(
  play: Pick<GradablePlay, "eventStartsAt">,
  game: Pick<SettledGame, "startsAt"> | null,
  now: Date,
  minutes: number,
): boolean {
  const starts = [play.eventStartsAt, game?.startsAt]
    .filter((d): d is Date => d instanceof Date && !Number.isNaN(d.getTime()))
    .map((d) => d.getTime());
  if (starts.length === 0) return true;
  return now.getTime() >= Math.max(...starts) + minutes * 60_000;
}

export function publicationVerdict(
  play: Pick<GradablePlay, "sport" | "eventStartsAt">,
  game: SettledGame,
  now: Date,
): PublicationVerdict {
  if (tooEarlyToSettle(play, game, now)) {
    return {
      ok: false,
      block: "too_early",
      detail: `${game.away} @ ${game.home} cannot be final ${minGameMinutes(play.sport)} min after kickoff`,
    };
  }

  const reports = reportsOf(game);
  const primary = reports.filter(
    (r) => !CORROBORATION_ONLY_SOURCES.has(r.source),
  );
  // A backstop that disagrees holds the grade while the feeds may still be
  // catching up. Past the grace window the primary feeds' agreed score stands,
  // so a backstop that never refreshes cannot pin a play PENDING forever.
  // Primary feeds disagreeing with each other always blocks.
  const backstopMayVeto = !pastKickoff(
    play,
    game,
    now,
    BACKSTOP_VETO_WINDOW_MINUTES,
  );
  const compared = backstopMayVeto || primary.length === 0 ? reports : primary;
  const first = compared[0]!;
  const disagreement = compared.find(
    (r) =>
      Boolean(r.voided) !== Boolean(first.voided) ||
      (!r.voided &&
        (r.homeScore !== first.homeScore || r.awayScore !== first.awayScore)),
  );
  if (disagreement) {
    return {
      ok: false,
      block: "sources_disagree",
      detail: reports
        .map(
          (r) =>
            `${r.source}=${r.voided ? "void" : `${r.awayScore}-${r.homeScore}`}`,
        )
        .join(" "),
    };
  }

  if (reports.every((r) => CORROBORATION_ONLY_SOURCES.has(r.source))) {
    return {
      ok: false,
      block: "unconfirmed_source",
      detail: `only ${reports.map((r) => r.source).join("+")} reports ${game.away} @ ${game.home} final`,
    };
  }

  return { ok: true };
}
