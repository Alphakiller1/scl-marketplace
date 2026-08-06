"use server";

import {
  classifyLoginIdentifier,
  verificationRequestSchema,
  type VerificationRequestInput,
} from "@/lib/schemas/auth.schema";
import { createVerificationToken } from "@/lib/tokens";
import { sendVerificationEmail } from "@/lib/email";
import { consumeRateLimit } from "@/lib/rate-limit";
import { getRequestIdentity } from "@/lib/request-identity";
import { findLoginCandidates } from "@/lib/user-credentials";

type VerificationRequestResult = { ok: true } | { ok: false; error: string };

export async function resendVerificationAction(
  input: VerificationRequestInput,
): Promise<VerificationRequestResult> {
  const parsed = verificationRequestSchema.safeParse(input);
  if (!parsed.success) {
    return { ok: false, error: "Enter your username or email." };
  }

  const { identifier } = parsed.data;
  const kind = classifyLoginIdentifier(identifier);
  const requestIdentity = await getRequestIdentity();
  const accountIdentity = `${kind}:${identifier}`;
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

  const candidates = await findLoginCandidates(identifier, kind);

  // Match password recovery: never expose whether an account exists.
  try {
    for (const user of candidates) {
      if (
        user.emailVerified ||
        user.accountStatus === "DISABLED" ||
        user.accountStatus === "SUSPENDED"
      ) {
        continue;
      }
      const token = await createVerificationToken(user.id);
      if (token) {
        await sendVerificationEmail(
          user.email,
          token,
          user.username ?? undefined,
        );
      }
    }
  } catch (error) {
    // Keep the response indistinguishable from a missing account.
    console.error("[verification] resend failed:", error);
  }
  return { ok: true };
}
