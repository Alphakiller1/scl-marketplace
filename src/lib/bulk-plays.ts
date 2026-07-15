/**
 * Pure shaping for bulk-singles submit outcomes (M5 §3.4 / §3.5).
 * No network / Prisma — unit-tested independently of createPlays.
 */

import type { MovedLinePayload } from "@/lib/odds-movement";
import type { BulkSinglesReceipt, StraightReceipt } from "@/lib/verification";

export type BulkLinePrep =
  | { status: "ready"; moveKey: string; receipt: StraightReceipt }
  | { status: "needs_confirm"; moved: MovedLinePayload }
  | { status: "unavailable"; moved: MovedLinePayload }
  | { status: "error"; error: string; moveKey?: string };

/**
 * Decide whether to write, prompt, or hard-fail before any DB write.
 *
 * - Any needs_confirm → no write yet (Cancel must write nothing).
 * - Otherwise ready lines may write; unavailable becomes partial/suspended.
 */
export function shapeBulkSinglesOutcome(preps: readonly BulkLinePrep[]):
  | {
      phase: "needs_confirm";
      needsConfirm: MovedLinePayload[];
      unavailable: MovedLinePayload[];
    }
  | { phase: "unavailable_only"; unavailable: MovedLinePayload[] }
  | { phase: "error"; error: string }
  | {
      phase: "write";
      ready: Array<{ moveKey: string; receipt: StraightReceipt }>;
      unavailable: MovedLinePayload[];
    } {
  const needsConfirm: MovedLinePayload[] = [];
  const unavailable: MovedLinePayload[] = [];
  const ready: Array<{ moveKey: string; receipt: StraightReceipt }> = [];
  const errors: string[] = [];

  for (const p of preps) {
    if (p.status === "needs_confirm") needsConfirm.push(p.moved);
    else if (p.status === "unavailable") unavailable.push(p.moved);
    else if (p.status === "ready")
      ready.push({ moveKey: p.moveKey, receipt: p.receipt });
    else if (p.status === "error") errors.push(p.error);
  }

  if (errors.length && ready.length === 0 && needsConfirm.length === 0) {
    return { phase: "error", error: errors[0]! };
  }

  if (needsConfirm.length > 0) {
    return { phase: "needs_confirm", needsConfirm, unavailable };
  }

  if (ready.length === 0 && unavailable.length > 0) {
    return { phase: "unavailable_only", unavailable };
  }

  return { phase: "write", ready, unavailable };
}

export function buildBulkSinglesReceipt(params: {
  picks: StraightReceipt[];
  attemptedCount: number;
  suspendedMoveKeys: string[];
  writtenMoveKeys: string[];
}): BulkSinglesReceipt {
  const submittedCount = params.picks.length;
  const suspendedCount = params.suspendedMoveKeys.length;
  const summaryLine =
    suspendedCount > 0
      ? `${submittedCount} of ${params.attemptedCount} submitted; ${suspendedCount} line${suspendedCount === 1 ? "" : "s"} suspended`
      : `${submittedCount} pick${submittedCount === 1 ? "" : "s"} verified`;

  return {
    kind: "bulk",
    picks: params.picks,
    submittedCount,
    attemptedCount: params.attemptedCount,
    suspendedCount,
    suspendedMoveKeys: params.suspendedMoveKeys,
    writtenMoveKeys: params.writtenMoveKeys,
    summaryLine,
  };
}
