/**
 * Shared slip helpers — exact-leg identity, conflict keys, mode-switch utilities.
 * Pure functions so React state / context can own the slip array.
 */

import {
  isTeamTotalMarket,
  parseTeamTotalSelection,
} from "@/lib/team-total-markets";

export type SlipPick = {
  eventId: string;
  eventLabel?: string;
  market: string;
  side: string;
  line?: number;
  oddsAmerican: number;
  player?: string;
  selection?: string;
  book?: string;
  league?: string;
};

/** Full board selection held in the unified slip (M5 PR-3). */
export type SlipSelection = SlipPick & {
  /** Stable row id — usually {@link pickKey}. */
  id: string;
  selection: string;
  eventStartsAt: string;
  sport: string;
  league?: string;
  /** Per-line stake in Singles mode (ignored for parlay submit). */
  units: number;
  /** ISO when the line was tapped onto the slip (board capture clock for UI). */
  capturedAt: string;
  /** Analysis belongs to this straight pick, never to the whole singles batch. */
  notes: string;
  notesPublic: boolean;
};

export type SlipMode = "singles" | "parlay";

export type SlipConflictKind =
  "duplicate" | "moneyline" | "spread" | "total" | "team_total" | "player_prop";

export type SlipConflict = {
  kind: SlipConflictKind;
  /** Index of the conflicting leg already on the slip. */
  index: number;
  /** Short toast copy explaining why the new leg was blocked. */
  message: string;
};

const GAME_MARKETS = {
  Moneyline: "moneyline",
  Spread: "spread",
  Total: "total",
} as const;

type GameMarket = keyof typeof GAME_MARKETS;

function isGameMarket(market: string): market is GameMarket {
  return market in GAME_MARKETS;
}

/**
 * Stable identity for an exact board line (event, market, selection, player,
 * side, point, price, book).
 *
 * `selection` is essential for team totals: the club is stored in text such as
 * "Yankees Over 4.5", while both clubs otherwise share the same market, side,
 * line and can even share the same price at the same book.
 * Used for selected-chip sync and exact-duplicate detection.
 */
export function pickKey(p: {
  eventId: string;
  market: string;
  selection?: string;
  side: string;
  line?: number;
  oddsAmerican: number;
  player?: string;
  book?: string;
}): string {
  return [
    p.eventId,
    p.market,
    p.selection ?? "",
    p.player ?? "",
    p.side,
    p.line ?? "",
    p.oddsAmerican,
    p.book ?? "",
  ].join("|");
}

/**
 * Conflict bucket for a pick — same key means only one may live on the slip.
 *
 * - Game moneyline → one side per event
 * - Game spread (incl. alternate) → one spread per event
 * - Game total (incl. alternate) → one total per event
 * - Team total → one total per event + club
 * - Player prop → one side/line per event + market + player
 *   (different players in the same prop market stay allowed)
 */
export function conflictKey(p: {
  eventId: string;
  market: string;
  selection?: string;
  player?: string;
}): string {
  if (isGameMarket(p.market)) {
    return `${p.eventId}|${GAME_MARKETS[p.market]}`;
  }
  if (isTeamTotalMarket(p.market)) {
    const team = parseTeamTotalSelection(p.selection ?? "")?.team;
    // Current board selections are canonical and always parse. Retain the
    // conservative event-level bucket for malformed legacy input rather than
    // accidentally allowing two totals for an unknown club.
    return `${p.eventId}|team_total|${team?.trim().toLowerCase() ?? ""}`;
  }
  // Props (and any other non-game market): collide on event + market + player.
  return `${p.eventId}|prop|${p.market}|${p.player ?? ""}`;
}

function conflictKindFor(
  market: string,
): Exclude<SlipConflictKind, "duplicate"> {
  if (market === "Moneyline") return "moneyline";
  if (market === "Spread") return "spread";
  if (market === "Total") return "total";
  if (isTeamTotalMarket(market)) return "team_total";
  return "player_prop";
}

function conflictMessage(
  kind: Exclude<SlipConflictKind, "duplicate">,
  market: string,
): string {
  switch (kind) {
    case "moneyline":
      return "This parlay already has a Moneyline for this game.";
    case "spread":
      return "This parlay already has a Spread for this game.";
    case "total":
      return "This parlay already has a Total for this game.";
    case "team_total":
      return "This parlay already has a Team Total for this team.";
    case "player_prop":
      return `This parlay already has a ${market} pick for this player.`;
  }
}

/**
 * Find an exact duplicate or same-bucket conflict among existing legs.
 * Exact duplicates win over conflict messaging when both would match.
 */
export function findConflict(
  existingLegs: readonly SlipPick[],
  pick: SlipPick,
): SlipConflict | null {
  const nextPickKey = pickKey(pick);
  const nextConflictKey = conflictKey(pick);

  for (let i = 0; i < existingLegs.length; i++) {
    const leg = existingLegs[i];
    if (!leg) continue;
    if (pickKey(leg) === nextPickKey) {
      return {
        kind: "duplicate",
        index: i,
        message: "That leg is already in your slip",
      };
    }
  }

  for (let i = 0; i < existingLegs.length; i++) {
    const leg = existingLegs[i];
    if (!leg) continue;
    if (conflictKey(leg) === nextConflictKey) {
      const kind = conflictKindFor(pick.market);
      return {
        kind,
        index: i,
        message: conflictMessage(kind, pick.market),
      };
    }
  }

  return null;
}

export function canAddLeg(
  existingLegs: readonly SlipPick[],
  pick: SlipPick,
): boolean {
  return findConflict(existingLegs, pick) === null;
}

/** Map a board pick into a parlay leg payload ready for `append`. */
export function toSlipLeg(
  pick: SlipPick & {
    selection: string;
    eventStartsAt: string;
    sport: string;
  },
) {
  return {
    sport: pick.sport,
    league: pick.league,
    market: pick.market,
    selection: pick.selection,
    oddsAmerican: pick.oddsAmerican,
    eventId: pick.eventId,
    eventLabel: pick.eventLabel,
    eventStartsAt: pick.eventStartsAt,
    side: pick.side,
    line: pick.line,
    player: pick.player,
    book: pick.book,
  };
}

/** Build a slip selection from a board OddsPick-shaped object. */
export function toSlipSelection(
  pick: SlipPick & {
    selection: string;
    eventStartsAt: string;
    sport: string;
  },
  units: number,
  capturedAt: string = new Date().toISOString(),
): SlipSelection {
  return {
    id: pickKey(pick),
    sport: pick.sport,
    league: pick.league,
    market: pick.market,
    selection: pick.selection,
    oddsAmerican: pick.oddsAmerican,
    eventId: pick.eventId,
    eventStartsAt: pick.eventStartsAt,
    side: pick.side,
    line: pick.line,
    player: pick.player,
    book: pick.book,
    units,
    capturedAt,
    notes: "",
    notesPublic: true,
  };
}

/**
 * Same-market conflicts already present in the slip (for Singles→Parlay mode switch).
 * Returns pairs of indices that share a conflictKey but are not exact duplicates.
 */
export function findInternalParlayConflicts(
  selections: readonly SlipPick[],
): Array<{ a: number; b: number; message: string }> {
  const out: Array<{ a: number; b: number; message: string }> = [];
  for (let i = 0; i < selections.length; i++) {
    for (let j = i + 1; j < selections.length; j++) {
      const a = selections[i]!;
      const b = selections[j]!;
      if (pickKey(a) === pickKey(b)) continue;
      if (conflictKey(a) !== conflictKey(b)) continue;
      const kind = conflictKindFor(b.market);
      out.push({ a: i, b: j, message: conflictMessage(kind, b.market) });
    }
  }
  return out;
}

/** Selected-chip keys for GamePicker sync. */
export function selectedKeysFromSelections(
  selections: readonly SlipPick[],
): Set<string> {
  return new Set(selections.map((s) => pickKey(s)));
}

/** Seed every singles row with the parlay stake (Parlay→Singles, §2.4). */
export function seedSinglesUnitsFromParlayStake(
  selections: readonly SlipSelection[],
  parlayUnits: number,
): SlipSelection[] {
  return selections.map((s) => ({ ...s, units: parlayUnits }));
}
