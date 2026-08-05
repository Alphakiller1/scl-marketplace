import type { AccountStatus } from "@prisma/client";

/**
 * Accounts carried over from the previous platform are imported without a
 * password (see `scripts/import-legacy-cappers.ts`) — the record and the public
 * profile exist, but nobody has ever signed in to them. That is the "unclaimed"
 * state, and it is the one thing that must never dead-end: every pre-existing
 * user has to be able to set credentials and accept the current policies.
 *
 * An unclaimed account is claimable regardless of `emailVerified`, because the
 * import marks a capper verified from the old platform's records — that flag
 * says nothing about whether anyone has ever held credentials here.
 */

/** Synthesized address used when a legacy export carried no real email. */
export const LEGACY_PLACEHOLDER_EMAIL_DOMAIN = "legacy.scl";

export const ACCOUNT_TAKEN_MESSAGE =
  "An account with that email already exists. Try logging in.";
export const ACCOUNT_RESTRICTED_MESSAGE =
  "That account is restricted. Contact support to restore access.";
export const HANDLE_TAKEN_MESSAGE = "That handle is already taken.";
export const UNCLAIMED_HANDLE_MESSAGE =
  "That handle belongs to a profile imported from the previous platform. Sign up with the email on that profile, or contact support to claim it.";

export type ClaimableAccountState = {
  passwordHash: string | null;
  emailVerified: Date | null;
  accountStatus: AccountStatus;
};

export type AccountClaim =
  | { claimable: true; reason: "UNCLAIMED" | "UNVERIFIED" }
  | { claimable: false; error: string };

/** No password has ever been set on this account, so nobody can be signed in to it. */
export function isUnclaimedAccount(account: {
  passwordHash: string | null;
}): boolean {
  return !account.passwordHash;
}

/** A synthesized legacy address can't receive mail — a claim link has to be handed over directly. */
export function hasDeliverableEmail(email: string): boolean {
  return !email
    .trim()
    .toLowerCase()
    .endsWith(`@${LEGACY_PLACEHOLDER_EMAIL_DOMAIN}`);
}

/**
 * Whether a signup on an existing email may take over that account, and why.
 * A real, credentialed account is never claimable — only imported records that
 * were never claimed, and unverified signups whose verification email never landed.
 */
export function evaluateAccountClaim(
  account: ClaimableAccountState,
): AccountClaim {
  if (
    account.accountStatus === "SUSPENDED" ||
    account.accountStatus === "DISABLED"
  ) {
    return { claimable: false, error: ACCOUNT_RESTRICTED_MESSAGE };
  }
  if (isUnclaimedAccount(account)) {
    return { claimable: true, reason: "UNCLAIMED" };
  }
  if (!account.emailVerified) {
    return { claimable: true, reason: "UNVERIFIED" };
  }
  return { claimable: false, error: ACCOUNT_TAKEN_MESSAGE };
}

/**
 * A taken handle on an unclaimed profile is a recoverable situation, not a wall —
 * say so, instead of sending an imported capper away from their own record.
 * Handle claims are never granted on the handle alone (they are public on the
 * leaderboard); the email on the profile, or an admin-issued link, is the proof.
 */
export function handleTakenMessage(account: {
  passwordHash: string | null;
}): string {
  return isUnclaimedAccount(account)
    ? UNCLAIMED_HANDLE_MESSAGE
    : HANDLE_TAKEN_MESSAGE;
}
