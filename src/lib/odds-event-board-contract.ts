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
    buys: Array.isArray(row.buys)
      ? row.buys.filter(
          (at): at is number => typeof at === "number" && Number.isFinite(at),
        )
      : [],
  };
}
