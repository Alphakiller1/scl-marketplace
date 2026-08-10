import type { OddsSelection } from "@/lib/odds-board";

export type EventBoardSnapshot = {
  version: 1;
  sport: string;
  eventId: string;
  selections: OddsSelection[];
  savedAt: number;
};

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
  return row as EventBoardSnapshot;
}
