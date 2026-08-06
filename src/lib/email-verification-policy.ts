import { DEFAULT_EMAIL_FROM } from "@/lib/email-sender";

/**
 * Email verification, split into the two questions that were previously one.
 *
 * They were entangled by a single `REQUIRE_EMAIL_VERIFICATION` flag: with it
 * unset, signup wrote `emailVerified` itself so nobody would be locked out by an
 * undeliverable email. That made the flag decide *what the database claims*, not
 * just who gets in — so the admin roster reported "Verified" for cappers who had
 * never opened an email, and the resend endpoint (which skips verified accounts)
 * had nothing left to do for exactly the people asking for a link.
 *
 * The two questions are now answered separately, and only one of them is
 * configurable:
 *
 *   - What do we record?  A real verification click, always. Not configurable.
 *   - Who do we let in?   `emailVerificationEnforced()`.
 */

/**
 * Whether SCL can actually put mail in somebody's inbox.
 *
 * Both halves are required: a key with no sender domain, or a sender domain with
 * no key, delivers nothing. `EMAIL_FROM` left at the placeholder counts as unset
 * — `no-reply@scl.local` is not a domain any provider will send for.
 */
export function mailerConfigured(): boolean {
  const from = process.env.EMAIL_FROM?.trim();
  return (
    Boolean(process.env.RESEND_API_KEY?.trim()) &&
    Boolean(from) &&
    from !== DEFAULT_EMAIL_FROM
  );
}

/**
 * Whether an unverified email blocks the capper and admin areas.
 *
 * Opt-in on purpose. Turning the gate on while mail is undeliverable locks out
 * every new signup, which is the outage this setting exists to prevent — so the
 * safe default is to let people in. Verify delivery first (`/api/health` reports
 * `email.deliverable` from a live provider check), then set
 * `REQUIRE_EMAIL_VERIFICATION=true`.
 *
 * Whatever this returns, `emailVerified` in the database stays honest.
 */
export function emailVerificationEnforced(): boolean {
  return process.env.REQUIRE_EMAIL_VERIFICATION === "true";
}
