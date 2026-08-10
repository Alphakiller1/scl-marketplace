/**
 * Pure shaping for bulk-singles submit outcomes (M5 §3.4 / §3.5 / PR-5 honesty).
 * No network / Prisma — unit-tested independently of createPlays.
 */

import type { MovedLinePayload } from "@/lib/odds-movement";
import type {
  BulkReceiptIssue,
  BulkSinglesReceipt,
  StraightReceipt,
} from "@/lib/verification";

export type BulkFailedPrep = {
  error: string;
  moveKey?: string;
  selection?: string;
  market?: string;
};

export type BulkLinePrep =
  | { status: "ready"; moveKey: string; receipt: StraightReceipt }
  | { status: "needs_confirm"; moved: MovedLinePayload }
  | { status: "unavailable"; moved: MovedLinePayload }
  | ({ status: "error" } & BulkFailedPrep);

/** Short display reason for ReceiptStack muted rows (PR-5). */
export function shortenBulkFailReason(reason: string): string {
  if (/already started|lock at the scheduled/i.test(reason)) {
    return "no longer pre-game";
  }
  if (/free-text|Pick a line from the board/i.test(reason)) {
    return "board selection required";
  }
  if (/Odds unavailable/i.test(reason)) return "odds unavailable";
  if (/No capper profile|logged in|email|terms|active/i.test(reason)) {
    return reason;
  }
  return reason.length > 80 ? `${reason.slice(0, 77)}…` : reason;
}

function failedFromPrep(p: BulkFailedPrep): BulkReceiptIssue {
  return {
    kind: "failed",
    selection: p.selection?.trim() || "Pick",
    reason: shortenBulkFailReason(p.error),
    moveKey: p.moveKey,
    market: p.market,
  };
}

function suspendedFromMoved(m: MovedLinePayload): BulkReceiptIssue {
  return {
    kind: "suspended",
    selection: m.selection,
    reason: "line unavailable or suspended",
    moveKey: m.moveKey,
    market: m.market,
  };
}

/**
 * Decide whether to write, prompt, or hard-fail before any DB write.
 *
 * - Any needs_confirm → no write yet (Cancel must write nothing).
 * - Otherwise ready lines may write; unavailable → suspended; integrity
 *   errors → failed (surfaced on receipt; still not written).
 */
export function shapeBulkSinglesOutcome(preps: readonly BulkLinePrep[]):
  | {
      phase: "needs_confirm";
      needsConfirm: MovedLinePayload[];
      unavailable: MovedLinePayload[];
    }
  | {
      phase: "unavailable_only";
      unavailable: MovedLinePayload[];
      failed: BulkReceiptIssue[];
    }
  | { phase: "error"; error: string }
  | {
      phase: "write";
      ready: Array<{ moveKey: string; receipt: StraightReceipt }>;
      unavailable: MovedLinePayload[];
      failed: BulkReceiptIssue[];
    } {
  const needsConfirm: MovedLinePayload[] = [];
  const unavailable: MovedLinePayload[] = [];
  const ready: Array<{ moveKey: string; receipt: StraightReceipt }> = [];
  const failedPreps: BulkFailedPrep[] = [];

  for (const p of preps) {
    if (p.status === "needs_confirm") needsConfirm.push(p.moved);
    else if (p.status === "unavailable") unavailable.push(p.moved);
    else if (p.status === "ready")
      ready.push({ moveKey: p.moveKey, receipt: p.receipt });
    else if (p.status === "error") {
      failedPreps.push({
        error: p.error,
        moveKey: p.moveKey,
        selection: p.selection,
        market: p.market,
      });
    }
  }

  const failed = failedPreps.map(failedFromPrep);

  if (
    failedPreps.length &&
    ready.length === 0 &&
    needsConfirm.length === 0 &&
    unavailable.length === 0
  ) {
    return { phase: "error", error: failedPreps[0]!.error };
  }

  if (needsConfirm.length > 0) {
    return { phase: "needs_confirm", needsConfirm, unavailable };
  }

  if (ready.length === 0 && unavailable.length > 0) {
    return { phase: "unavailable_only", unavailable, failed };
  }

  return { phase: "write", ready, unavailable, failed };
}

export function buildBulkSinglesReceipt(params: {
  picks: StraightReceipt[];
  attemptedCount: number;
  writtenMoveKeys: string[];
  suspended?: BulkReceiptIssue[];
  failed?: BulkReceiptIssue[];
}): BulkSinglesReceipt {
  const submittedCount = params.picks.length;
  const suspended = params.suspended ?? [];
  const failed = params.failed ?? [];
  const suspendedCount = suspended.length;
  const failedCount = failed.length;

  const parts: string[] = [];
  if (failedCount === 0 && suspendedCount === 0) {
    parts.push(
      `${submittedCount} pick${submittedCount === 1 ? "" : "s"} submitted`,
    );
  } else {
    parts.push(`${submittedCount} of ${params.attemptedCount} submitted`);
    if (failedCount > 0) {
      parts.push(`${failedCount} couldn't be submitted`);
    }
    if (suspendedCount > 0) {
      parts.push(`${suspendedCount} suspended`);
    }
  }

  return {
    kind: "bulk",
    picks: params.picks,
    submittedCount,
    attemptedCount: params.attemptedCount,
    suspendedCount,
    suspendedMoveKeys: suspended
      .map((s) => s.moveKey)
      .filter((k): k is string => Boolean(k)),
    writtenMoveKeys: params.writtenMoveKeys,
    failedCount,
    failed,
    suspended,
    summaryLine: parts.join(" · "),
  };
}

export { suspendedFromMoved };
