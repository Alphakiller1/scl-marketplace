/**
 * Canonical Proof Receipt — state machine + honest field formatters (§37).
 * Pure / client-safe. Lifecycle for PENDING plays reuses deriveLifecycle.
 */

import type { Outcome } from "@prisma/client";

import { formatOdds } from "@/lib/format";
import { deriveLifecycle } from "@/lib/lifecycle";
import type { VerificationTier } from "@/lib/verification";
import { isVerifiedTier } from "@/lib/verification";

/** Full Proof-mode state machine. */
export type ProofReceiptState =
  | "capturing"
  | "captured"
  | "pending"
  | "line-moved"
  | "live"
  | "awaiting-grade"
  | "won"
  | "loss"
  | "push"
  | "void"
  | "corrected"
  | "disputed"
  | "source-unavailable";

export type ProofReceiptDensity =
  | "feed"
  | "expanded-paper"
  | "mobile"
  | "share-image"
  | "text-only";

export type DeriveProofReceiptStateInput = {
  outcome?: Outcome | null;
  eventStartsAt?: Date | string | null;
  /** Board-checked (VERIFIED / AUTO_VERIFIED). */
  verified?: boolean;
  verificationTier?: VerificationTier | null;
  /** Transient: odds being locked / stamp animation. */
  capturing?: boolean;
  /** Transient: submit-time line-moved confirm. */
  lineMoved?: boolean;
  /** Odds book/source unavailable at capture or move. */
  sourceUnavailable?: boolean;
  /** Reserved for grading-audit corrections (unused until flags exist). */
  corrected?: boolean;
  disputed?: boolean;
  now?: Date;
};

export function deriveProofReceiptState(
  input: DeriveProofReceiptStateInput,
): ProofReceiptState {
  if (input.capturing) return "capturing";
  if (input.lineMoved) return "line-moved";
  if (input.sourceUnavailable) return "source-unavailable";
  if (input.disputed) return "disputed";
  if (input.corrected) return "corrected";

  const lifecycle = deriveLifecycle({
    outcome: input.outcome ?? "PENDING",
    eventStartsAt: input.eventStartsAt,
    now: input.now,
  });

  switch (lifecycle) {
    case "win":
      return "won";
    case "loss":
      return "loss";
    case "push":
      return "push";
    case "void":
      return "void";
    case "live":
      return "live";
    case "awaiting-grade":
      return "awaiting-grade";
    case "pre-game":
    case "pending":
    default: {
      const verified =
        input.verified ??
        (input.verificationTier
          ? isVerifiedTier(input.verificationTier)
          : false);
      return verified ? "captured" : "pending";
    }
  }
}

/** Stamp label on the receipt face. */
export function proofStampLabel(state: ProofReceiptState): string {
  switch (state) {
    case "capturing":
      return "Capturing";
    case "captured":
      return "Odds Verified";
    case "pending":
      return "Pending";
    case "line-moved":
      return "Line moved";
    case "live":
      return "Pending";
    case "awaiting-grade":
      return "Awaiting";
    case "won":
      return "Win";
    case "loss":
      return "Loss";
    case "push":
      return "Push";
    case "void":
      return "Void";
    case "corrected":
      return "Corrected";
    case "disputed":
      return "Disputed";
    case "source-unavailable":
      return "Unavailable";
    default:
      return "Recorded";
  }
}

/** Visual stamp tone — pink only for conviction/verified; settlement colors separate. */
export function proofStampTone(
  state: ProofReceiptState,
): "pink" | "win" | "loss" | "push" | "muted" {
  switch (state) {
    case "captured":
    case "capturing":
      return "pink";
    case "won":
      return "win";
    case "loss":
      return "loss";
    case "push":
    case "void":
      return "push";
    default:
      return "muted";
  }
}

/**
 * Closing line display — honest em-dash until a closing snapshot exists.
 */
export function formatClosingLine(
  closingOddsAmerican: number | null | undefined,
): string {
  if (closingOddsAmerican == null || !Number.isFinite(closingOddsAmerican)) {
    return "—";
  }
  if (Math.abs(closingOddsAmerican) < 100) return "—";
  return formatOdds(closingOddsAmerican);
}

/**
 * CLV display — honest em-dash until computed (cold start default).
 */
export function formatClvPts(clvPts: number | null | undefined): string {
  if (clvPts == null || !Number.isFinite(clvPts)) return "—";
  const sign = clvPts > 0 ? "+" : "";
  return `${sign}${clvPts.toFixed(2)} pts`;
}

/**
 * Tooltip for empty Close / CLV fields (value stays em-dash).
 * Future event → "Not Captured Yet"; otherwise "Not Available"
 * (never claim the event window is still open — most historical plays simply
 * have no closing snapshot).
 */
export function missingCloseOrClvTooltip(
  eventStartsAt?: Date | string | null,
  now: Date = new Date(),
): string {
  if (eventStartsAt != null) {
    const start = new Date(eventStartsAt);
    if (!Number.isNaN(start.getTime()) && start.getTime() > now.getTime()) {
      return "Not Captured Yet";
    }
  }
  return "Not Available";
}

/** Short Evidence ID for the face; full id in title/aria. */
export function formatEvidenceId(id: string | null | undefined): string {
  if (!id) return "—";
  const clean = id.trim();
  if (clean.length <= 10) return clean.toUpperCase();
  return `${clean.slice(0, 4)}…${clean.slice(-4)}`.toUpperCase();
}

export function isSettledProofState(state: ProofReceiptState): boolean {
  return (
    state === "won" ||
    state === "loss" ||
    state === "push" ||
    state === "void" ||
    state === "corrected"
  );
}

/** A graded unit outcome is a result, never a projected "to win" amount. */
export function proofUnitsLabel(state: ProofReceiptState): "Result" | "To win" {
  return isSettledProofState(state) ? "Result" : "To win";
}

/** Plain-text summary for text-only density / a11y. */
export function proofReceiptTextSummary(opts: {
  selection: string;
  eventLine?: string | null;
  odds: string;
  stake: string;
  state: ProofReceiptState;
  clv: string;
  evidenceId: string;
}): string {
  const bits = [
    opts.selection,
    opts.eventLine,
    `Odds ${opts.odds}`,
    `Stake ${opts.stake}`,
    proofStampLabel(opts.state),
    `CLV ${opts.clv}`,
    `Receipt ID ${opts.evidenceId}`,
  ].filter(Boolean);
  return bits.join(" · ");
}
