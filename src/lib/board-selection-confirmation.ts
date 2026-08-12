import "server-only";

import { loadCachedOddsBoard } from "@/lib/odds-board-cache";
import { loadCachedEventBoard } from "@/lib/odds-event-board-cache";
import { mergeEventBoardSelections } from "@/lib/odds-event-board-contract";
import {
  matchesBoardSelection,
  type BoardSelectionClaim,
  type OddsEvent,
} from "@/lib/odds-board";

export type BoardSelectionConfirmation = BoardSelectionClaim & {
  sport: string;
  eventId: string;
  eventStartsAt: Date;
};

/**
 * Confirm a submitted line against SCL's last-good caches without refreshing the
 * provider or spending odds credits. Both board endpoints populate these caches
 * before a user can select a line.
 */
export async function confirmBoardSelection(
  claim: BoardSelectionConfirmation,
): Promise<boolean> {
  return (await confirmedBoardEvent(claim)) !== null;
}

/**
 * Confirm the line and return the server-owned fixture behind it.
 * Callers persist this identity instead of trusting an optional client label.
 */
export async function confirmedBoardEvent(
  claim: BoardSelectionConfirmation,
): Promise<OddsEvent | null> {
  const [slate, detail] = await Promise.all([
    loadCachedOddsBoard(claim.sport),
    loadCachedEventBoard(claim.sport, claim.eventId),
  ]);
  const event = slate.events.find(
    (candidate) => candidate.id === claim.eventId,
  );
  if (!event) return null;

  const expectedStart = Date.parse(event.commenceTime);
  if (
    Number.isNaN(expectedStart) ||
    expectedStart !== claim.eventStartsAt.getTime()
  ) {
    return null;
  }

  const selections = mergeEventBoardSelections(
    event.selections,
    detail.selections,
  );
  return selections.some((selection) => matchesBoardSelection(selection, claim))
    ? event
    : null;
}
