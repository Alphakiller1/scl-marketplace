import {
  HANDLE_TAKEN_MESSAGE,
  UNCLAIMED_HANDLE_MESSAGE,
  isUnclaimedAccount,
} from "@/lib/account-claim";
import type { AccountStatus } from "@prisma/client";

export type HandleOccupantCounts = {
  plays: number;
  parlays: number;
  legacyRecords: number;
  packages: number;
  storeConnections: number;
};

export type HandleOccupant = {
  id: string;
  passwordHash: string | null;
  accountStatus: AccountStatus;
  capperProfile: { _count: HandleOccupantCounts } | null;
};

export type HandleCollisionDecision =
  | { action: "allow" }
  | { action: "reject"; error: string }
  | { action: "release"; occupantId: string };

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
 * Empty unclaimed imports are parking spots, not identities — release them so a
 * typo fix (`mtndegwn` → `mtndegen`) is not blocked by a stub. A claimed
 * account, a restricted account, or an imported profile with a record keeps
 * the handle.
 */
export function decideHandleCollision(
  occupant: HandleOccupant | null,
): HandleCollisionDecision {
  if (!occupant) return { action: "allow" };
  if (
    occupant.accountStatus === "SUSPENDED" ||
    occupant.accountStatus === "DISABLED"
  ) {
    return { action: "reject", error: HANDLE_TAKEN_MESSAGE };
  }
  if (!isUnclaimedAccount(occupant)) {
    return { action: "reject", error: HANDLE_TAKEN_MESSAGE };
  }
  if (handleOccupantHasPublicRecord(occupant)) {
    return { action: "reject", error: UNCLAIMED_HANDLE_MESSAGE };
  }
  return { action: "release", occupantId: occupant.id };
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
