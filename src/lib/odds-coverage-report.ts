import "server-only";

import { ODDS_BOARD_SPORTS, preGameEvents } from "@/lib/game-picker";
import { loadCachedOddsBoard } from "@/lib/odds-board-cache";
import {
  loadCachedEventBoard,
  loadEventBoard,
} from "@/lib/odds-event-board-cache";
import { getLastOddsApiRemaining } from "@/lib/odds-api";
import {
  buildOddsCoverageReport,
  summarizeEventMarketCoverage,
  type OddsCoverageReport,
} from "@/lib/odds-market-coverage";
import { nearTermEvents } from "@/lib/slate";

/** Cache-only audit of every selectable game today and tomorrow. */
export async function getCachedOddsCoverageReport() {
  const boards = await Promise.all(
    ODDS_BOARD_SPORTS.map((sport) => loadCachedOddsBoard(sport.key)),
  );
  const events = nearTermEvents(
    preGameEvents(boards.flatMap((board) => board.events)),
  ).filter((event) => event.sport === "MLB" || event.sport === "WNBA");
  const games = await Promise.all(
    events.map(async (event) => {
      const board = await loadCachedEventBoard(event.sport, event.id);
      return summarizeEventMarketCoverage(
        event,
        board.selections,
        board.source,
        board.stale,
      );
    }),
  );
  return buildOddsCoverageReport(games);
}

/**
 * Explicit operator action that fills only missing per-event boards.
 *
 * Sequential calls make the provider's remaining-credit header effective
 * before another event is attempted. The first empty/failing response stops
 * the run so an exhausted or invalid key is never hammered across the slate.
 */
export async function warmMissingOddsCoverage(report: OddsCoverageReport) {
  // A basic or partially populated event board is still missing. MLB is not
  // complete until alternates, player props, F3, F5 and F7 all survive durable
  // read-back; WNBA likewise requires its complete expanded matrix.
  const missing = report.games.filter((game) => !game.fullyCovered);
  let attempted = 0;
  let populated = 0;
  let stoppedReason: "provider_empty" | "credits_exhausted" | null = null;

  for (const game of missing) {
    const board = await loadEventBoard(game.sport, game.eventId, {
      forceRefresh: true,
    });
    attempted++;
    if (board.selections.length === 0) {
      stoppedReason = "provider_empty";
      break;
    }
    populated++;
    const remaining = getLastOddsApiRemaining();
    if (remaining !== null && remaining <= 0) {
      stoppedReason = "credits_exhausted";
      break;
    }
  }

  return {
    requested: missing.length,
    attempted,
    populated,
    stoppedReason,
    remaining: getLastOddsApiRemaining(),
  };
}
