import "server-only";

import { ODDS_BOARD_SPORTS, preGameEvents } from "@/lib/game-picker";
import { loadCachedOddsBoard } from "@/lib/odds-board-cache";
import { loadCachedEventBoard } from "@/lib/odds-event-board-cache";
import {
  buildOddsCoverageReport,
  summarizeEventMarketCoverage,
} from "@/lib/odds-market-coverage";
import { nearTermEvents } from "@/lib/slate";

/** Cache-only audit of every selectable game today and tomorrow. */
export async function getCachedOddsCoverageReport() {
  const boards = await Promise.all(
    ODDS_BOARD_SPORTS.map((sport) => loadCachedOddsBoard(sport.key)),
  );
  const events = nearTermEvents(
    preGameEvents(boards.flatMap((board) => board.events)),
  );
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
