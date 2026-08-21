import {
  HANDLE_TAKEN_MESSAGE,
  UNCLAIMED_HANDLE_MESSAGE,
  isUnclaimedAccount,
} from "@/lib/account-claim";
import type { AccountStatus } from "@prisma/client";
import { emailsShareInbox } from "@/lib/user-credentials";

export const SAME_INBOX_HANDLE_IN_USE =
  "That handle is already on another account with this email. Sign in as that username to use it.";

export type HandleOccupantCounts = {
  plays: number;
  parlays: number;
  legacyRecords: number;
  packages: number;
  storeConnections: number;
};

export type HandleOccupant = {
  id: string;
  email: string;
  passwordHash: string | null;
  accountStatus: AccountStatus;
  capperProfile: { _count: HandleOccupantCounts } | null;
};

export type HandleCollisionDecision =
  | { action: "allow" }
  | { action: "reject"; error: string }
  | { action: "release"; occupantId: string };

export type HandleCollisionOptions = {
  currentEmail?: string | null;
};

/** True when the occupant already has a record, packages, or storefront work. */
export function handleOccupantHasPublicRecord(
  occupant: HandleOccupant,
): boolean {
  const counts = occupant.capperProfile?._count;
  if (!counts) return false;
  return (
    counts.plays > 0 ||
    counts.parlays > 0 ||
    counts.legacyRecords > 0 ||
    counts.packages > 0 ||
    counts.storeConnections > 0
  );
}

/**
 * Whether a live capper may take a handle another row currently holds.
 *
 * Empty unclaimed imports are parking spots. Empty accounts on the same inbox
 * (including `user+handle@domain` legacy rows) are too — that is the
 * `mtndegwn` → `mtndegen` case, where the intended handle was a second signup
 * or import on the same email. A claimed stranger, a restricted account, or
 * any row with a public record keeps the handle.
 */
export function decideHandleCollision(
  occupant: HandleOccupant | null,
  options: HandleCollisionOptions = {},
): HandleCollisionDecision {
  if (!occupant) return { action: "allow" };
  if (
    occupant.accountStatus === "SUSPENDED" ||
    occupant.accountStatus === "DISABLED"
  ) {
    return { action: "reject", error: HANDLE_TAKEN_MESSAGE };
  }

  const sameInbox = emailsShareInbox(options.currentEmail, occupant.email);
  const hasRecord = handleOccupantHasPublicRecord(occupant);

  if (hasRecord) {
    if (sameInbox) {
      return { action: "reject", error: SAME_INBOX_HANDLE_IN_USE };
    }
    return {
      action: "reject",
      error: isUnclaimedAccount(occupant)
        ? UNCLAIMED_HANDLE_MESSAGE
        : HANDLE_TAKEN_MESSAGE,
    };
  }

  if (isUnclaimedAccount(occupant) || sameInbox) {
    return { action: "release", occupantId: occupant.id };
  }

  return { action: "reject", error: HANDLE_TAKEN_MESSAGE };
}

/**
 * Park an empty imported stub under a unique, valid handle so the requested
 * name can be assigned. Cuid ids are 25 chars; `rel_` + id stays within the
 * 30-character public handle ceiling.
 */
export function parkedReleasedHandle(userId: string, attempt = 0): string {
  const compact = userId.replace(/[^a-z0-9]/gi, "").toLowerCase();
  const suffix = attempt > 0 ? String(attempt) : "";
  const parked = `rel_${compact}${suffix}`.slice(0, 30);
  return parked.length >= 3 ? parked : `rel_${compact || "x"}`;
}
