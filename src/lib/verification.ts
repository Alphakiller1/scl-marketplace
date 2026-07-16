/**
 * Verification-tier presentation + math (pick integrity, see docs/SCL_PICK_INTEGRITY.md).
 *
 * The tier is the single public trust signal on a pick: it's computed from facts at submission
 * (timing, event binding, odds check) and never self-asserted. This module is the one place the
 * UI reads tier labels/copy/tone from, plus the helper that rolls picks up into a per-capper
 * "verified share." Pure + client-safe (no `server-only`, no Prisma value import).
 */

/** Mirrors the Prisma `VerificationTier` enum. */
export type VerificationTier = "AUTO_VERIFIED" | "VERIFIED" | "SELF_REPORTED";

export type VerificationTierMeta = {
  /** Full label, e.g. for tooltips/legends. */
  label: string;
  /** Compact badge text. */
  short: string;
  /** One-line explanation of what the tier means. */
  description: string;
  /** Visual weight: a real trust signal vs. a neutral "counts, but unverified" marker. */
  tone: "verified" | "muted";
};

export const VERIFICATION_TIER_META: Record<
  VerificationTier,
  VerificationTierMeta
> = {
  AUTO_VERIFIED: {
    label: "Auto-verified",
    short: "Verified",
    description:
      "Captured automatically from an authorized source, logged pre-game, with odds checked against the market.",
    tone: "verified",
  },
  VERIFIED: {
    label: "Verified",
    short: "Verified",
    description:
      "Logged pre-game against a real event, with the claimed odds checked against the live market.",
    tone: "verified",
  },
  SELF_REPORTED: {
    label: "Logged",
    short: "Logged",
    description:
      "Historical entry not board-checked; does not count toward verified rank.",
    tone: "muted",
  },
};

export function verificationTierMeta(
  tier: VerificationTier,
): VerificationTierMeta {
  return VERIFICATION_TIER_META[tier] ?? VERIFICATION_TIER_META.SELF_REPORTED;
}

/** AUTO_VERIFIED and VERIFIED both clear the trust bar; SELF_REPORTED does not. */
export function isVerifiedTier(tier: VerificationTier): boolean {
  return tier === "VERIFIED" || tier === "AUTO_VERIFIED";
}

/** Share (0–100) of the given picks that carry a verified tier; 0 for an empty list. */
export function computeVerifiedShare(tiers: VerificationTier[]): number {
  if (tiers.length === 0) return 0;
  const verified = tiers.filter(isVerifiedTier).length;
  return (verified / tiers.length) * 100;
}

// ── post-submit receipt (trust ceremony; copy must match decidePickIntegrity) ─

/** Payload returned by createPlay on success — facts from the server decision. */
export type StraightReceipt = {
  kind: "straight";
  selection: string;
  market: string;
  oddsAmerican: number;
  /** ISO timestamp from the persisted play row when the odds were locked. */
  capturedAt: string;
  loggedPreGame: boolean;
  oddsVerified: boolean;
  tier: VerificationTier;
  /** Stake in units — for Ticket receipt face. */
  units?: number;
  /** Potential win in units at capture (stake × decimal−1). */
  toWinUnits?: number;
  /** Honest move sub-line when selected ≠ captured (M5). */
  moveNote?: string;
  /** Odds API bookmaker key at capture, when known. */
  book?: string | null;
};

/** One non-written line surfaced on a bulk receipt (PR-5 honesty). */
export type BulkReceiptIssue = {
  kind: "failed" | "suspended";
  selection: string;
  reason: string;
  moveKey?: string;
  market?: string;
};

/** Bulk singles stack (M5 PR-4 / §6.2 + PR-5 failed honesty). */
export type BulkSinglesReceipt = {
  kind: "bulk";
  picks: StraightReceipt[];
  submittedCount: number;
  attemptedCount: number;
  suspendedCount: number;
  suspendedMoveKeys: string[];
  /** Keys of Plays that were written — slip drops these; others stay. */
  writtenMoveKeys: string[];
  /** Integrity / prep rejects that did not write (distinct from suspended). */
  failedCount: number;
  failed: BulkReceiptIssue[];
  /** Unavailable lines kept in the slip. */
  suspended: BulkReceiptIssue[];
  summaryLine: string;
};

/** Payload returned by createParlay on success — rolled-up leg trust facts. */
export type ParlayReceipt = {
  kind: "parlay";
  legCount: number;
  combinedOddsAmerican: number;
  /** ISO timestamp from the persisted parlay row when the odds were locked. */
  capturedAt: string;
  allLoggedPreGame: boolean;
  verifiedLegCount: number;
  tiers: VerificationTier[];
  units?: number;
  toWinUnits?: number;
  /** Per-leg move notes when any leg auto-accepted or explicitly accepted a move. */
  moveNotes?: string[];
  /**
   * Book when every priced leg shares one key; null when mixed/unknown → LIVE BOARD.
   */
  book?: string | null;
};

export type SubmissionReceipt =
  | StraightReceipt
  | ParlayReceipt
  | BulkSinglesReceipt;

/** Presentation strings for the post-submit confirmation card. */
export type ReceiptCopy = {
  headline: string;
  /** Primary pick/parlay line (selection + odds, or leg count + combined). */
  summary: string;
  /** Market / context line under the summary. */
  context: string | null;
  /** Pre-game / board lock / self-reported status. */
  statusLine: string;
  /** Automatic grading promise — never overclaims market verification. */
  gradingLine: string;
  tone: "verified" | "muted";
};

/** Trust-forward receipt copy from server return facts — no client-side tier guessing. */
export function submissionReceiptCopy(receipt: SubmissionReceipt): ReceiptCopy {
  if (receipt.kind === "bulk") {
    const allVerified =
      receipt.picks.length > 0 &&
      receipt.picks.every((p) => isVerifiedTier(p.tier));
    const issueBits: string[] = [];
    if (receipt.failedCount > 0) {
      issueBits.push(`${receipt.failedCount} couldn't be verified`);
    }
    if (receipt.suspendedCount > 0) {
      issueBits.push(
        `${receipt.suspendedCount} line${receipt.suspendedCount === 1 ? "" : "s"} suspended — kept in your slip`,
      );
    }
    return {
      headline:
        receipt.submittedCount === 1
          ? "Pick Verified"
          : receipt.submittedCount === 0
            ? "No Picks Submitted"
            : `${receipt.submittedCount} Picks Verified`,
      summary: receipt.summaryLine,
      context: null,
      statusLine:
        issueBits.length > 0 ? issueBits.join(" · ") : "Odds captured pre-game",
      gradingLine: "Graded automatically after final",
      tone: allVerified && receipt.failedCount === 0 ? "verified" : "muted",
    };
  }

  if (receipt.kind === "straight") {
    const verified = isVerifiedTier(receipt.tier);
    const odds =
      receipt.oddsAmerican > 0
        ? `+${receipt.oddsAmerican}`
        : `${receipt.oddsAmerican}`;
    if (verified) {
      return {
        headline: "Pick Verified",
        summary: `${receipt.selection} ${odds}`,
        context: receipt.market,
        statusLine: receipt.loggedPreGame
          ? "Odds captured pre-game"
          : "Logged against a real event",
        gradingLine: "Graded automatically after final",
        tone: "verified",
      };
    }
    return {
      headline: "Logged",
      summary: `${receipt.selection} ${odds}`,
      context: receipt.market,
      statusLine:
        "Odds could not be verified — saved to your record, not board-verified",
      gradingLine: "Still graded automatically after the event settles",
      tone: "muted",
    };
  }

  const odds =
    receipt.combinedOddsAmerican > 0
      ? `+${receipt.combinedOddsAmerican}`
      : `${receipt.combinedOddsAmerican}`;
  const allVerified = receipt.verifiedLegCount === receipt.legCount;
  const noneVerified = receipt.verifiedLegCount === 0;
  const summary = `${receipt.legCount} legs · ${odds}`;

  if (allVerified) {
    return {
      headline: "Parlay Submitted",
      summary,
      context: null,
      statusLine: receipt.allLoggedPreGame
        ? "All legs locked from the board"
        : "All legs verified against the market",
      gradingLine: "Graded automatically after results settle",
      tone: "verified",
    };
  }
  if (noneVerified) {
    return {
      headline: "Parlay Submitted",
      summary,
      context: null,
      statusLine:
        "Odds could not be verified on every leg — saved, not board-verified",
      gradingLine: "Still graded automatically after results settle",
      tone: "muted",
    };
  }
  return {
    headline: "Parlay Submitted",
    summary,
    context: null,
    statusLine: `${receipt.verifiedLegCount} of ${receipt.legCount} legs odds-verified — unverified legs count as self-reported`,
    gradingLine: "Graded automatically after results settle",
    tone: "muted",
  };
}
