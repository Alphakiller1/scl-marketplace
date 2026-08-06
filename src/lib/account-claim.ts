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
  | { claimable: true; reason: "UNCLAIMED" }
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
 * Whether a signup on an existing handle may take over that account.
 *
 * One rule: an account that has a password is never claimable. A signup form
 * must not be able to overwrite somebody's credential, because the password on
 * an account is the one they last set — carried over from the previous platform
 * at import, or chosen since — and nothing but that account proving itself may
 * replace it.
 *
 * Being unverified is NOT an exception, though it used to be. That carve-out was
 * written to rescue a signup whose verification email never landed, and it was
 * near-unreachable while signup stamped `emailVerified` on every new row. Once
 * that stamp was removed (accounts now stay unverified until someone actually
 * clicks the link) the carve-out meant any account that had not yet verified —
 * including established cappers with plays and history — could be taken over by
 * anyone who submitted the signup form with their handle. The rescue path is
 * `/resend-verification`, which needs no password and cannot change one.
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
  if (!isUnclaimedAccount(account)) {
    return { claimable: false, error: ACCOUNT_TAKEN_MESSAGE };
  }
  return { claimable: true, reason: "UNCLAIMED" };
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
