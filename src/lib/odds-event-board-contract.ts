import { coalesceBoardSelections, type OddsSelection } from "@/lib/odds-board";

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
 * rungs, and adds books to rungs; it moves no price a book already has.
 */
export function addMissingEventBoardSelections(
  cached: readonly OddsSelection[],
  fresh: readonly OddsSelection[],
): OddsSelection[] {
  const index = new Map<string, number>();
  cached.forEach((row, i) => index.set(selectionIdentity(row), i));
  const rows = [...cached];
  for (const selection of fresh) {
    const identity = selectionIdentity(selection);
    const at = index.get(identity);
    if (at == null) {
      index.set(identity, rows.length);
      // A top-up adds rungs; the main line is the buy's to decide. DraftKings
      // files its alt run lines on the featured `spreads` key, so its rungs
      // arrive flagged featured — kept that way they would read as a second
      // main line and never count as the DK alternates the gap check wants.
      rows.push(
        selection.market === "Spread" || selection.market === "Total"
          ? { ...selection, featured: false }
          : selection,
      );
      continue;
    }
    // A line the board already carries: add the books it is missing, and
    // nothing else. Skipping the row outright is how a DraftKings companion
    // top-up threw away DK's price on every rung FanDuel had already posted,
    // leaving -2.5/+2.5 greyed on the DK tab however often it ran.
    const row = rows[at]!;
    const prices = { ...(row.bookPrices ?? {}) };
    const captured = { ...(row.bookCapturedAt ?? {}) };
    let changed = false;
    for (const [book, price] of Object.entries(selection.bookPrices ?? {})) {
      if (typeof price !== "number" || typeof prices[book] === "number") {
        continue;
      }
      prices[book] = price;
      const capturedAt = selection.bookCapturedAt?.[book];
      if (typeof capturedAt === "string") captured[book] = capturedAt;
      changed = true;
    }
    if (!changed) continue;
    rows[at] = {
      ...row,
      bookPrices: prices,
      ...(Object.keys(captured).length ? { bookCapturedAt: captured } : {}),
    };
  }
  return rows;
}

/**
 * Union per-book prices on the same line, then keep last-good rows the
 * refresh did not return.
 *
 * A wholesale replace dropped DraftKings MLB alt rungs: those prices live on
 * the surface `spreads` snapshot, FanDuel's live on `alternate_spreads`, and
 * the event-detail merge used the same identity for both.
 */
export function mergeEventBoardSelections(
  cached: readonly OddsSelection[],
  fresh: readonly OddsSelection[],
  sport?: string,
): OddsSelection[] {
  return coalesceBoardSelections([...cached, ...fresh], sport);
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
