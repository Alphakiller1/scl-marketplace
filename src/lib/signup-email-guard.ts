import type { AccountStatus } from "@prisma/client";

import { ACCOUNT_RESTRICTED_MESSAGE } from "@/lib/account-claim";

/**
 * One account per email address.
 *
 * Signup only ever looked itself up by USERNAME, and the schema's uniqueness is
 * the composite `@@unique([email, username])` — so the same address opened as
 * many accounts as it had spare handles, and four addresses in production had
 * done exactly that (one of them three times, twice verified).
 *
 * A second account on a verified address is the case the owner named: the
 * person already has one and should sign in, not start again. An UNVERIFIED
 * address is blocked too, or the rule only holds for people who finished the
 * flow — two of the four live duplicates are pairs where neither side ever
 * verified. That path is never a dead end: the copy points at the link already
 * sent and at resend, which needs no password.
 *
 * Pure — no network, no server-only, unit-testable.
 */

/** Exact copy the owner asked for on the verified case. */
export const EMAIL_ALREADY_REGISTERED_MESSAGE =
  "An account already exists with this email address. Please log in to your " +
  "existing account. If you\u2019ve forgotten your password, click \u201CForgot " +
  "Password\u201D to reset it.";

/**
 * The unverified case. Deliberately different copy: telling someone to log in
 * would send them to a password they may never have finished setting, and the
 * thing they actually need is the link.
 */
export const EMAIL_AWAITING_VERIFICATION_MESSAGE =
  "An account with this email address is already awaiting verification. Check " +
  "your inbox for the verification link, or use Resend verification to get a " +
  "new one.";

export type ExistingEmailAccount = {
  id: string;
  emailVerified: Date | null;
  accountStatus: AccountStatus;
};

export type EmailAvailability =
  | { available: true }
  | { available: false; error: string };

/**
 * Whether a signup may use this address, given every account already holding it.
 *
 * `claimingAccountId` is the record a handle-claim is about to take over. It
 * holds the address being submitted in the ordinary case, and matching against
 * itself would refuse every legitimate claim.
 */
export function evaluateEmailAvailability(
  existing: readonly ExistingEmailAccount[],
  claimingAccountId?: string,
): EmailAvailability {
  const others = existing.filter((account) => account.id !== claimingAccountId);
  if (others.length === 0) return { available: true };

  // Restricted first: "please log in to your existing account" is wrong advice
  // for an account that has been suspended, and support is the only route back.
  if (
    others.some(
      (account) =>
        account.accountStatus === "SUSPENDED" ||
        account.accountStatus === "DISABLED",
    )
  ) {
    return { available: false, error: ACCOUNT_RESTRICTED_MESSAGE };
  }

  if (others.some((account) => account.emailVerified != null)) {
    return { available: false, error: EMAIL_ALREADY_REGISTERED_MESSAGE };
  }

  return { available: false, error: EMAIL_AWAITING_VERIFICATION_MESSAGE };
}

/** The unique index that enforces one account per address, case-insensitively. */
export const EMAIL_UNIQUE_INDEX = "User_email_lower_key";

/**
 * Did this unique-constraint failure come from the email rule?
 *
 * The guard above reads before it writes, so two submissions for the same
 * address can both pass it and race to the insert. The database settles that,
 * and the loser has to be told the same thing the guard would have told it —
 * not the composite `[email, username]` wording, which describes a different
 * collision and reads as nonsense when the handles differ.
 *
 * Prisma reports the constraint on `meta.target`, as a string or an array
 * depending on the driver and the shape of the index, so both are handled.
 */
export function isEmailUniqueViolation(error: { meta?: unknown }): boolean {
  const target = (error.meta as { target?: unknown } | undefined)?.target;
  const names = Array.isArray(target)
    ? target.map(String)
    : typeof target === "string"
      ? [target]
      : [];
  return names.some(
    (name) => name === EMAIL_UNIQUE_INDEX || name.toLowerCase() === "email",
  );
}
