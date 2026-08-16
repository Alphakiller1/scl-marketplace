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
 * How many empty event boards in a row mean the provider — not the fixture —
 * is the problem.
 *
 * One empty board is ordinary: books post props and alternate ladders close to
 * first pitch, so a game a day out legitimately prices nothing beyond the game
 * lines. A run of them is the signature of a spent or invalid key.
 */
const MAX_CONSECUTIVE_EMPTY = 3;

/**
 * Explicit operator action that fills only missing per-event boards.
 *
 * Sequential calls make the provider's remaining-credit header effective before
 * another event is attempted.
 *
 * An empty board SKIPS that event and moves on; it used to abort the whole run.
 * That conflated "this fixture has no expanded markets yet" with "the key is
 * dead", and the two are indistinguishable from one response — so a single
 * game a day out, priced by nobody, stopped the warm before it reached the
 * games starting in an hour. In practice the first fixture in the slate was
 * empty most runs, which is why team totals, props and the F-innings ladder
 * never populated no matter how often the refresh ran.
 *
 * The dead-key case is still caught, by the two signals that actually mean it:
 * exhausted credits, and a run of consecutive empty responses.
 */
export async function warmMissingOddsCoverage(report: OddsCoverageReport) {
  // A basic or partially populated event board is still missing. MLB is not
  // complete until alternates, player props, F3, F5 and F7 all survive durable
  // read-back; WNBA likewise requires its complete expanded matrix.
  const missing = report.games.filter((game) => !game.fullyCovered);
  let attempted = 0;
  let populated = 0;
  let skippedEmpty = 0;
  let consecutiveEmpty = 0;
  let stoppedReason:
    | "provider_empty"
    | "credits_exhausted"
    | "credit_reserve"
    | null = null;

  for (const game of missing) {
    const board = await loadEventBoard(game.sport, game.eventId, {
      forceRefresh: true,
    });
    attempted++;

    // The breaker fired: remaining credits are down to the reserve the plan
    // holds back for pick verification. Stop on the FIRST such answer rather
    // than letting it look like three empty fixtures and burning the
    // consecutive-empty budget to reach the same conclusion.
    if (
      board.source === "circuit_break_empty" ||
      board.source === "stale_circuit_break"
    ) {
      stoppedReason = "credit_reserve";
      break;
    }

    if (board.selections.length === 0) {
      skippedEmpty++;
      consecutiveEmpty++;
      if (consecutiveEmpty >= MAX_CONSECUTIVE_EMPTY) {
        stoppedReason = "provider_empty";
        break;
      }
      continue;
    }

    consecutiveEmpty = 0;
    populated++;

    // Checked after every populated event, so the run stops on the response
    // that spends the last credit rather than on the next one that fails.
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
    skippedEmpty,
    stoppedReason,
    remaining: getLastOddsApiRemaining(),
  };
}
