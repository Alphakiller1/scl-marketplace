import type { SettledGame } from "@/lib/results/settled-game";

/**
 * Games won by each side of a tennis match, read off the per-set line scores.
 *
 * Tennis spreads and totals are GAMES markets — every one graded by hand on
 * this platform was settled that way ("-4.5 games", "Over 21.5 games"). The
 * grader used to refuse all of them because a scores feed reports a match as
 * two numbers and never says whether they count sets or games: settling
 * "Swiatek -7.5" against a 2-0 SET score reads as a +2 margin and books a
 * confident LOSS on a bet that cleared by nine.
 *
 * ESPN's scoreboard does say. Each competitor carries `linescores` — the games
 * won in each set — which `mapEspnScoreboard` already stores as
 * `homePeriods` / `awayPeriods`. Summing those is the game score the refusal
 * was waiting for, so these markets no longer need a human.
 *
 * Everything else still defers (null). A match that did not play out to a
 * normal finish — a retirement mid-set, a walkover, a super-tiebreak decider —
 * has games on the board that no longer describe the bet, and the sport's
 * settlement rules for those vary by book. Those stay PENDING for the manual
 * queue rather than being graded on an assumption.
 */
export type TennisMatchScore = Pick<
  SettledGame,
  | "homeScore"
  | "awayScore"
  | "homePeriods"
  | "awayPeriods"
  | "regulationPeriods"
>;

/** Was this set played to a legitimate finish? 6-4, 7-5 and 7-6 are; 3-1 is not. */
function isCompletedSet(winnerGames: number, loserGames: number): boolean {
  if (!Number.isInteger(winnerGames) || !Number.isInteger(loserGames)) {
    return false;
  }
  if (loserGames < 0) return false;
  if (winnerGames === 6) return loserGames <= 4;
  if (winnerGames === 7) return loserGames === 5 || loserGames === 6;
  return false;
}

/**
 * Total games won by each side, or null when the match cannot be settled on
 * games (missing line scores, an unfinished set, or a best-of the feed did not
 * state).
 */
export function tennisGamesWon(
  game: TennisMatchScore,
): { home: number; away: number } | null {
  const home = game.homePeriods;
  const away = game.awayPeriods;
  if (!home?.length || !away?.length) return null;
  if (home.length !== away.length) return null;

  // Best-of, straight from the feed. Without it a 2-0 line score is ambiguous:
  // a completed best-of-three, or a best-of-five somebody retired out of after
  // two sets. Refusing is free — ESPN reports the format alongside the very
  // line scores this reads — and it keeps a Grand Slam retirement out of the
  // public record.
  const bestOf = game.regulationPeriods;
  if (bestOf !== 3 && bestOf !== 5) return null;
  if (home.length > bestOf) return null;

  let homeSets = 0;
  let awaySets = 0;
  for (let set = 0; set < home.length; set++) {
    const homeGames = home[set]!;
    const awayGames = away[set]!;
    if (homeGames === awayGames) return null;
    const homeWon = homeGames > awayGames;
    if (
      !isCompletedSet(
        homeWon ? homeGames : awayGames,
        homeWon ? awayGames : homeGames,
      )
    ) {
      return null;
    }
    if (homeWon) homeSets++;
    else awaySets++;
  }

  const setsToWin = (bestOf + 1) / 2;
  const winnerSets = Math.max(homeSets, awaySets);
  if (winnerSets !== setsToWin) return null;

  // The line scores must name the same winner the feed does. A disagreement
  // means one of the two is describing a different match.
  if (game.homeScore === game.awayScore) return null;
  if (game.homeScore > game.awayScore !== homeSets > awaySets) return null;

  return {
    home: home.reduce((total, games) => total + games, 0),
    away: away.reduce((total, games) => total + games, 0),
  };
}
