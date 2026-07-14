/**
 * Submit-time odds-movement guard (M5 PR-2 / SCL_M5_UNIFIED_BET_SLIP §3).
 *
 * Pure — no network. The server action re-fetches live prices, then classifies each
 * line here. Stale prices never write silently: Changed requires an explicit
 * acceptedMoves entry that matches the current live price; Unavailable blocks.
 *
 * Tolerance is the same named constant as C3 (`DEFAULT_TOLERANCE_PROB`) so the
 * guard and decidePickIntegrity agree on "material" movement.
 */

import {
  DEFAULT_TOLERANCE_PROB,
  impliedProbFromAmerican,
} from "@/lib/odds-verify";

/** Tolerance classes from M5 §3.1. */
export type OddsMoveClass =
  | "unchanged"
  | "favorable"
  | "minor"
  | "changed"
  | "unavailable";

export type OddsMoveAssessment = {
  class: OddsMoveClass;
  selectedOddsAmerican: number;
  /** Live price for the same {market,side,line}; null when unavailable/suspended. */
  updatedOddsAmerican: number | null;
  /** |Δ implied-prob|, or null when unavailable. */
  deltaImplied: number | null;
};

/**
 * Stable identity for a board line (price-independent) — used to match
 * needsConfirm payloads to acceptedMoves across the confirm round-trip.
 */
export function moveKey(p: {
  eventId: string;
  market: string;
  side: string;
  line?: number | null;
  player?: string | null;
}): string {
  return [
    p.eventId,
    p.market,
    (p.player ?? "").trim().toLowerCase(),
    p.side.trim().toLowerCase(),
    p.line ?? "",
  ].join("|");
}

export type AcceptedMove = {
  moveKey: string;
  selectedOddsAmerican: number;
  /** Odds the capper explicitly accepted — must match live at write time. */
  acceptedOddsAmerican: number;
};

/** Per-line payload returned when submit cannot proceed without user action. */
export type MovedLinePayload = {
  moveKey: string;
  class: "changed" | "unavailable";
  selectedOddsAmerican: number;
  updatedOddsAmerican: number | null;
  eventId: string;
  /** Display label (usually away @ home or selection context). */
  eventLabel: string;
  market: string;
  selection: string;
  side: string;
  line?: number;
  player?: string;
  book?: string | null;
  /** Server verification clock — ISO. Never client Date.now. */
  verifiedAt: string;
};

export type CaptureOddsReady = {
  status: "ready";
  /** Odds persisted on Play.oddsAmerican (captured/submitted). */
  oddsAmerican: number;
  /** What the capper originally tapped (may equal oddsAmerican). */
  selectedOddsAmerican: number;
  oddsMovedAccepted: boolean;
  /** Optional receipt sub-line, e.g. LINE MOVED -110 → -125 · ACCEPTED. */
  moveNote?: string;
};

export type CaptureOddsBlocked =
  | { status: "needs_confirm"; moved: MovedLinePayload }
  | { status: "unavailable"; moved: MovedLinePayload };

export type CaptureOddsResolution = CaptureOddsReady | CaptureOddsBlocked;

function formatOddsShort(n: number): string {
  return n > 0 ? `+${n}` : `${n}`;
}

/**
 * Classify selected vs live in implied-probability space (M5 §3.1).
 *
 * - unavailable — no live price
 * - unchanged — exact match
 * - favorable — live is better for the bettor (lower implied) → auto-accept
 * - minor — Δp ≤ tolerance and not favorable → auto-accept
 * - changed — adverse move beyond tolerance → must confirm
 */
export function classifyOddsMove(params: {
  selectedAmerican: number;
  liveAmerican: number | null;
  toleranceProb?: number;
}): OddsMoveAssessment {
  const selected = params.selectedAmerican;
  const live = params.liveAmerican;
  const tolerance = params.toleranceProb ?? DEFAULT_TOLERANCE_PROB;

  if (live === null) {
    return {
      class: "unavailable",
      selectedOddsAmerican: selected,
      updatedOddsAmerican: null,
      deltaImplied: null,
    };
  }
  if (live === selected) {
    return {
      class: "unchanged",
      selectedOddsAmerican: selected,
      updatedOddsAmerican: live,
      deltaImplied: 0,
    };
  }

  const selectedImplied = impliedProbFromAmerican(selected);
  const liveImplied = impliedProbFromAmerican(live);
  const delta = Math.abs(liveImplied - selectedImplied);
  const favorable = liveImplied < selectedImplied;

  if (favorable) {
    return {
      class: "favorable",
      selectedOddsAmerican: selected,
      updatedOddsAmerican: live,
      deltaImplied: delta,
    };
  }
  if (delta <= tolerance) {
    return {
      class: "minor",
      selectedOddsAmerican: selected,
      updatedOddsAmerican: live,
      deltaImplied: delta,
    };
  }
  return {
    class: "changed",
    selectedOddsAmerican: selected,
    updatedOddsAmerican: live,
    deltaImplied: delta,
  };
}

export function findAcceptedMove(
  accepted: readonly AcceptedMove[] | undefined,
  key: string,
): AcceptedMove | undefined {
  if (!accepted?.length) return undefined;
  return accepted.find((m) => m.moveKey === key);
}

/**
 * Resolve what odds to persist for one board line given live re-verification
 * and any explicit acceptedMoves from a prior confirm round-trip.
 *
 * Never trusts client-supplied "updated" odds: when accepting a move, the live
 * price must equal the accepted entry before write.
 */
export function resolveCaptureOdds(params: {
  selectedAmerican: number;
  liveAmerican: number | null;
  acceptedMoves?: readonly AcceptedMove[];
  moveKey: string;
  eventId: string;
  eventLabel: string;
  market: string;
  selection: string;
  side: string;
  line?: number;
  player?: string;
  book?: string | null;
  verifiedAt: Date;
  toleranceProb?: number;
}): CaptureOddsResolution {
  const assessment = classifyOddsMove({
    selectedAmerican: params.selectedAmerican,
    liveAmerican: params.liveAmerican,
    toleranceProb: params.toleranceProb,
  });

  const baseMoved = {
    moveKey: params.moveKey,
    selectedOddsAmerican: params.selectedAmerican,
    eventId: params.eventId,
    eventLabel: params.eventLabel,
    market: params.market,
    selection: params.selection,
    side: params.side,
    line: params.line,
    player: params.player,
    book: params.book ?? null,
    verifiedAt: params.verifiedAt.toISOString(),
  };

  if (assessment.class === "unavailable") {
    return {
      status: "unavailable",
      moved: {
        ...baseMoved,
        class: "unavailable",
        updatedOddsAmerican: null,
      },
    };
  }

  const live = assessment.updatedOddsAmerican as number;

  if (assessment.class === "changed") {
    const acceptance = findAcceptedMove(params.acceptedMoves, params.moveKey);
    const acceptanceMatches =
      acceptance != null &&
      acceptance.selectedOddsAmerican === params.selectedAmerican &&
      acceptance.acceptedOddsAmerican === live;

    if (!acceptanceMatches) {
      return {
        status: "needs_confirm",
        moved: {
          ...baseMoved,
          class: "changed",
          updatedOddsAmerican: live,
        },
      };
    }

    return {
      status: "ready",
      oddsAmerican: live,
      selectedOddsAmerican: params.selectedAmerican,
      oddsMovedAccepted: true,
      moveNote: `LINE MOVED ${formatOddsShort(params.selectedAmerican)} → ${formatOddsShort(live)} · ACCEPTED`,
    };
  }

  // unchanged | favorable | minor — auto-proceed; persist live when it differs
  const oddsAmerican = live;
  const moved = oddsAmerican !== params.selectedAmerican;
  let moveNote: string | undefined;
  if (assessment.class === "favorable" && moved) {
    moveNote = `LINE IMPROVED ${formatOddsShort(params.selectedAmerican)} → ${formatOddsShort(live)}`;
  } else if (assessment.class === "minor" && moved) {
    moveNote = `LINE MOVED ${formatOddsShort(params.selectedAmerican)} → ${formatOddsShort(live)} (within tolerance)`;
  }

  return {
    status: "ready",
    oddsAmerican,
    selectedOddsAmerican: params.selectedAmerican,
    oddsMovedAccepted: false,
    moveNote,
  };
}
