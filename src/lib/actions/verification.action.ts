"use server";

import {
  verificationRequestSchema,
  type VerificationRequestInput,
} from "@/lib/schemas/auth.schema";
import { createVerificationToken } from "@/lib/tokens";
import { sendVerificationEmail } from "@/lib/email";
import { consumeRateLimit } from "@/lib/rate-limit";
import { getRequestIdentity } from "@/lib/request-identity";
import { findUserByEmailAndUsername } from "@/lib/user-credentials";

type VerificationRequestResult = { ok: true } | { ok: false; error: string };

export async function resendVerificationAction(
  input: VerificationRequestInput,
): Promise<VerificationRequestResult> {
  const parsed = verificationRequestSchema.safeParse(input);
  if (!parsed.success) {
    return { ok: false, error: "Enter a valid email and username." };
  }

  const { email, username } = parsed.data;
  const requestIdentity = await getRequestIdentity();
  const accountIdentity = `${email}:${username}`;
  const [emailAllowed, requestAllowed] = await Promise.all([
    consumeRateLimit({
      scope: "verification-email",
      identity: accountIdentity,
      limit: 5,
      windowMs: 60 * 60 * 1000,
    }),
    consumeRateLimit({
      scope: "verification-request",
      identity: requestIdentity,
      limit: 30,
      windowMs: 60 * 60 * 1000,
    }),
  ]);
  if (!emailAllowed || !requestAllowed) return { ok: true };

  const user = await findUserByEmailAndUsername(email, username);

  // Match password recovery: never expose whether an account exists.
  if (
    !user ||
    user.emailVerified ||
    user.accountStatus === "DISABLED" ||
    user.accountStatus === "SUSPENDED"
  ) {
    return { ok: true };
  }

  try {
    const token = await createVerificationToken(user.id);
    if (token) {
      await sendVerificationEmail(user.email, token, username);
    }
  } catch (error) {
    // Keep the response indistinguishable from a missing account.
    console.error("[verification] resend failed:", error);
  }
  return { ok: true };
}
