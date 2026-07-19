import type { Outcome } from "@prisma/client";

import type { PickStatus } from "@/lib/mock";

/**
 * Result/lifecycle state of a pick — kept SEPARATE from its authenticity ("Verified").
 * Derived from the graded outcome plus the scheduled start; no new source of truth.
 *
 * A graded pick is Won / Lost / Push / Void. A PENDING pick splits by the schedule:
 *   pre-game        — before the scheduled start (the C1-locked, verifiable window)
 *   live            — after start, within the expected play window
 *   awaiting-grade  — past the expected finish, result not yet posted
 */

// Generous window after the scheduled start before a still-ungraded pick reads as
// "awaiting grade" — covers long games + settlement lag without flipping too early.
export const EXPECTED_FINAL_MS = 5 * 60 * 60 * 1000;

export function deriveLifecycle(params: {
  outcome: Outcome;
  eventStartsAt?: Date | string | null;
  now?: Date;
}): PickStatus {
  switch (params.outcome) {
    case "WIN":
      return "win";
    case "LOSS":
      return "loss";
    case "PUSH":
      return "push";
    case "VOID":
      return "void";
    default:
      break; // PENDING → derive from the schedule below
  }

  const start = params.eventStartsAt ? new Date(params.eventStartsAt) : null;
  if (!start || Number.isNaN(start.getTime())) return "pre-game";

  const now = params.now ?? new Date();
  if (now.getTime() < start.getTime()) return "pre-game";
  if (now.getTime() < start.getTime() + EXPECTED_FINAL_MS) return "live";
  return "awaiting-grade";
}
