import type { OddsSelection } from "@/lib/odds-board";

export type EventBoardSnapshot = {
  version: 1;
  sport: string;
  eventId: string;
  selections: OddsSelection[];
  savedAt: number;
  /**
   * Epoch millis of each paid refresh of this event inside the current buy day.
   *
   * Optional, and absent on every snapshot written before the daily buy cap
   * shipped. A missing log reads as "no buys recorded yet", which lets the cap
   * start counting from the next refresh instead of rejecting the snapshot and
   * throwing away a cached board that cost real credits.
   */
  buys?: number[];
  /**
   * Epoch millis of each team-total top-up attempt in the current buy day.
   *
   * Kept apart from `buys` because a top-up is not a buy: it asks for one or
   * two markets, a credit or two a game, and must not spend the allowance a
   * full refresh needs. It still needs its own ceiling — a book that never
   * posts a game's ladder would otherwise be asked every hour until first
   * pitch. Optional for the same reason `buys` is.
   */
  topUps?: number[];
};

function selectionIdentity(selection: OddsSelection): string {
  return [
    selection.market.trim().toLowerCase(),
    selection.selection.trim().toLowerCase(),
    selection.side.trim().toLowerCase(),
    selection.line ?? "",
    selection.player?.trim().toLowerCase() ?? "",
  ].join("|");
}

/**
 * Add the rows a top-up found that the board does not already carry.
 *
 * Unlike {@link mergeEventBoardSelections}, a fresh row never replaces a cached
 * one. The ladder request can come back with its own price for a line the board
 * already holds, from a different set of books, and letting it win would swap
 * the board's best price on a line nobody asked to reprice. A top-up adds
 * rungs; it moves no prices.
 */
export function addMissingEventBoardSelections(
  cached: readonly OddsSelection[],
  fresh: readonly OddsSelection[],
): OddsSelection[] {
  const seen = new Set(cached.map(selectionIdentity));
  const added: OddsSelection[] = [];
  for (const selection of fresh) {
    const identity = selectionIdentity(selection);
    if (seen.has(identity)) continue;
    seen.add(identity);
    added.push(selection);
  }
  return [...cached, ...added];
}

/** Fresh rows win, while temporarily absent market groups retain their last-good rows. */
export function mergeEventBoardSelections(
  cached: readonly OddsSelection[],
  fresh: readonly OddsSelection[],
): OddsSelection[] {
  const merged = new Map(
    cached.map((selection) => [selectionIdentity(selection), selection]),
  );
  for (const selection of fresh) {
    merged.set(selectionIdentity(selection), selection);
  }
  return [...merged.values()];
}

function isOddsSelection(value: unknown): value is OddsSelection {
  if (!value || typeof value !== "object") return false;
  const row = value as Record<string, unknown>;
  return (
    typeof row.market === "string" &&
    typeof row.selection === "string" &&
    typeof row.side === "string" &&
    typeof row.oddsAmerican === "number"
  );
}

export function parseEventBoardSnapshot(
  value: unknown,
  sport: string,
  eventId: string,
): EventBoardSnapshot | null {
  if (!value || typeof value !== "object") return null;
  const row = value as Record<string, unknown>;
  if (
    row.version !== 1 ||
    row.sport !== sport.toUpperCase() ||
    row.eventId !== eventId ||
    typeof row.savedAt !== "number" ||
    !Number.isFinite(row.savedAt) ||
    !Array.isArray(row.selections) ||
    row.selections.length === 0 ||
    !row.selections.every(isOddsSelection)
  ) {
    return null;
  }
  const snapshot = row as EventBoardSnapshot;
  return {
    ...snapshot,
    buys: finiteTimes(row.buys),
    topUps: finiteTimes(row.topUps),
  };
}

function finiteTimes(value: unknown): number[] {
  return Array.isArray(value)
    ? value.filter(
        (at): at is number => typeof at === "number" && Number.isFinite(at),
      )
    : [];
}
