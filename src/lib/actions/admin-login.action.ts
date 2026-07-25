"use server";

import {
  createAdminLoginChallenge,
  findChallengeOwner,
} from "@/lib/admin-login-challenge";
import { verifyLoginCredentials } from "@/lib/credentials";
import { sendAdminLoginCodeEmail } from "@/lib/email";
import { consumeRateLimit } from "@/lib/rate-limit";
import { loginSchema, type LoginInput } from "@/lib/schemas/auth.schema";

export type StartLoginResult =
  /** Not an admin — the caller signs in with the password it already has. */
  | { ok: true; mode: "password" }
  /** Admin — a code was emailed and must be redeemed to finish signing in. */
  | { ok: true; mode: "code"; challengeId: string; devCode?: string }
  | { ok: false; error: string };

const GENERIC_ERROR = "Unable to sign in with those credentials";

/**
 * First step of sign-in. Verifies the password, then decides whether a second
 * factor is required. Only a correct password reveals that an account is an
 * admin, and the check runs under the shared login throttle.
 */
export async function startLoginAction(
  input: LoginInput,
): Promise<StartLoginResult> {
  const parsed = loginSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: GENERIC_ERROR };

  const user = await verifyLoginCredentials(
    parsed.data.email,
    parsed.data.password,
  );
  if (!user) return { ok: false, error: GENERIC_ERROR };

  if (user.role !== "ADMIN") return { ok: true, mode: "password" };

  // A correct password shouldn't be a mail-bombing tool either. Start and resend
  // share one budget per account.
  const allowed = await consumeRateLimit({
    scope: "admin-login-code",
    identity: user.id,
    limit: 5,
    windowMs: 10 * 60 * 1000,
  });
  if (!allowed) {
    return { ok: false, error: "Too many code requests. Try again shortly." };
  }

  const { challengeId, code } = await createAdminLoginChallenge(user.id);
  const sent = await sendAdminLoginCodeEmail(user.email, code);

  // With no email provider configured (local dev) the code is logged and handed
  // back so the flow stays testable. A configured provider that fails is a real
  // lockout, so say so instead of showing a code box that can never be filled.
  if (!sent.delivered && sent.configured) {
    return {
      ok: false,
      error: "We couldn't send your sign-in code. Try again in a moment.",
    };
  }

  return {
    ok: true,
    mode: "code",
    challengeId,
    ...(sent.delivered ? {} : { devCode: code }),
  };
}

/** Re-issue a code for an admin who never received the first one. */
export async function resendLoginCodeAction(
  challengeId: string,
): Promise<StartLoginResult> {
  if (!challengeId) return { ok: false, error: GENERIC_ERROR };

  const owner = await findChallengeOwner(challengeId);
  // An expired or unknown challenge means starting over from the password.
  if (!owner) {
    return { ok: false, error: "That code expired. Sign in again." };
  }

  // Throttle on the account: the challenge id changes with every resend, so
  // keying on it would reset the budget each time and allow mail bombing.
  const allowed = await consumeRateLimit({
    scope: "admin-login-code",
    identity: owner.userId,
    limit: 5,
    windowMs: 10 * 60 * 1000,
  });
  if (!allowed) {
    return { ok: false, error: "Too many code requests. Try again shortly." };
  }

  const issued = await createAdminLoginChallenge(owner.userId);
  const sent = await sendAdminLoginCodeEmail(owner.email, issued.code);
  if (!sent.delivered && sent.configured) {
    return {
      ok: false,
      error: "We couldn't send your sign-in code. Try again in a moment.",
    };
  }

  return {
    ok: true,
    mode: "code",
    challengeId: issued.challengeId,
    ...(sent.delivered ? {} : { devCode: issued.code }),
  };
}
