import { createHmac, timingSafeEqual } from "crypto";

import { hasDeliverableEmail } from "@/lib/account-claim";

/**
 * Admin broadcasts — one capper, or the whole roster.
 *
 * Pure: audience rules, batching, and unsubscribe tokens. No network, no DB, no
 * `server-only`, so every rule below is unit-testable. The action and the mailer
 * consume this.
 *
 * Three properties this file exists to guarantee:
 *
 *   1. **Recipients never see each other.** Every send carries exactly one `to`.
 *      A shared To/CC on a roster mail leaks the customer list, and it is one
 *      keystroke away in any hand-rolled loop.
 *   2. **An opt-out is honoured.** A mass mail is not transactional; a capper
 *      who has opted out must not receive one, whatever the admin selects.
 *   3. **Undeliverable addresses are skipped.** 108 imported cappers may carry a
 *      synthesized `@legacy.scl` address with no inbox behind it. Mailing those
 *      earns hard bounces, which is how a sender reputation dies — and it would
 *      take verification and password resets down with it.
 */

export type BroadcastAudienceKind =
  | "ALL_CAPPERS"
  | "VERIFIED_CAPPERS"
  | "SINGLE_CAPPER";

/** The account fields an audience decision needs. */
export type BroadcastCandidate = {
  id: string;
  email: string;
  username: string | null;
  emailVerified: Date | null;
  accountStatus: string;
  isTest: boolean;
  marketingOptOut: boolean;
};

export type BroadcastRecipient = {
  userId: string;
  email: string;
  username: string | null;
};

/**
 * Resend accepts up to 100 messages per batch call. Chunking is not an
 * optimisation here — a single call with the whole roster is rejected outright.
 */
export const BROADCAST_BATCH_SIZE = 100;

/**
 * Ceiling on one broadcast. Well above the current roster and far below
 * anything that would outrun a serverless invocation, so a mistake in the
 * audience query cannot turn into thousands of sends.
 */
export const BROADCAST_MAX_RECIPIENTS = 2000;

/** Never mail a suspended or disabled account, whatever the audience. */
function isMailableStatus(status: string): boolean {
  return status !== "SUSPENDED" && status !== "DISABLED";
}

/**
 * Who actually receives this broadcast.
 *
 * `SINGLE_CAPPER` is an operational message an admin is sending to one person
 * about their own account, so it ignores the marketing opt-out — the same
 * reason a password reset does. It still refuses an undeliverable address and a
 * restricted account.
 */
export function resolveBroadcastRecipients(
  audience: BroadcastAudienceKind,
  candidates: readonly BroadcastCandidate[],
): BroadcastRecipient[] {
  const out: BroadcastRecipient[] = [];
  const seen = new Set<string>();

  for (const c of candidates) {
    if (!isMailableStatus(c.accountStatus)) continue;
    if (!hasDeliverableEmail(c.email)) continue;
    if (audience !== "SINGLE_CAPPER") {
      if (c.isTest) continue;
      if (c.marketingOptOut) continue;
      if (audience === "VERIFIED_CAPPERS" && !c.emailVerified) continue;
    }
    // One inbox can carry several accounts, and a roster mail that lands three
    // times reads as a malfunction. Address wins over account here.
    const key = c.email.trim().toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    out.push({ userId: c.id, email: c.email, username: c.username });
  }
  return out;
}

/** Split into batches the provider will accept. */
export function chunkRecipients<T>(
  recipients: readonly T[],
  size: number = BROADCAST_BATCH_SIZE,
): T[][] {
  if (size < 1) throw new Error("batch size must be at least 1");
  const chunks: T[][] = [];
  for (let i = 0; i < recipients.length; i += size) {
    chunks.push(recipients.slice(i, i + size));
  }
  return chunks;
}

/**
 * Stateless unsubscribe token: `userId.signature`.
 *
 * HMAC over the user id rather than a stored token, so opting out needs no table
 * and no lookup, and a link cannot be guessed for someone else's account. Signed
 * with `AUTH_SECRET`, which every deployment already has.
 */
export function signUnsubscribeToken(userId: string, secret: string): string {
  const sig = createHmac("sha256", secret).update(userId).digest("hex");
  return `${userId}.${sig}`;
}

/** Returns the user id when the signature checks out, else null. */
export function verifyUnsubscribeToken(
  token: string,
  secret: string,
): string | null {
  const at = token.lastIndexOf(".");
  if (at <= 0) return null;
  const userId = token.slice(0, at);
  const provided = token.slice(at + 1);
  const expected = createHmac("sha256", secret).update(userId).digest("hex");
  // Compare fixed-width buffers so a length mismatch cannot throw and cannot be
  // distinguished by timing.
  const a = Buffer.from(
    provided.padEnd(expected.length, "\0").slice(0, expected.length),
  );
  const b = Buffer.from(expected);
  if (!timingSafeEqual(a, b)) return null;
  return provided.length === expected.length ? userId : null;
}
