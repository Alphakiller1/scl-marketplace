"use server";

import {
  passwordResetRequestSchema,
  resetPasswordSchema,
  type PasswordResetRequestInput,
  type ResetPasswordInput,
} from "@/lib/schemas/auth.schema";
import {
  consumePasswordResetToken,
  createPasswordResetToken,
} from "@/lib/password-reset-tokens";
import { sendPasswordResetEmail } from "@/lib/email";
import { consumeRateLimit } from "@/lib/rate-limit";
import { getRequestIdentity } from "@/lib/request-identity";
import { findUserByEmailAndUsername } from "@/lib/user-credentials";

type PasswordResetResult = { ok: true } | { ok: false; error: string };

export async function requestPasswordResetAction(
  input: PasswordResetRequestInput,
): Promise<PasswordResetResult> {
  const parsed = passwordResetRequestSchema.safeParse(input);
  if (!parsed.success) {
    return { ok: false, error: "Enter a valid email and username." };
  }

  const { email, username } = parsed.data;
  const requestIdentity = await getRequestIdentity();
  const accountIdentity = `${email}:${username}`;
  const [emailAllowed, requestAllowed] = await Promise.all([
    consumeRateLimit({
      scope: "password-reset-email",
      identity: accountIdentity,
      limit: 5,
      windowMs: 60 * 60 * 1000,
    }),
    consumeRateLimit({
      scope: "password-reset-request",
      identity: requestIdentity,
      limit: 30,
      windowMs: 60 * 60 * 1000,
    }),
  ]);
  if (!emailAllowed || !requestAllowed) return { ok: true };

  const user = await findUserByEmailAndUsername(email, username);

  // Always return the same response so this form cannot enumerate accounts.
  if (!user || user.accountStatus === "DISABLED") return { ok: true };

  try {
    const token = await createPasswordResetToken(user.id);
    if (token) {
      await sendPasswordResetEmail(user.email, token, username);
    }
  } catch (error) {
    // Keep the response indistinguishable from a missing account.
    console.error("[password-reset] request failed:", error);
  }

  return { ok: true };
}

export async function resetPasswordAction(
  input: ResetPasswordInput,
): Promise<PasswordResetResult> {
  const parsed = resetPasswordSchema.safeParse(input);
  if (!parsed.success) {
    return {
      ok: false,
      error: parsed.error.issues[0]?.message ?? "Check the form and try again.",
    };
  }

  let reset = false;
  try {
    reset = await consumePasswordResetToken(
      parsed.data.token,
      parsed.data.password,
    );
  } catch (error) {
    console.error("[password-reset] consume failed:", error);
    return {
      ok: false,
      error: "Password recovery is temporarily unavailable.",
    };
  }
  if (!reset) {
    return {
      ok: false,
      error: "This reset link is invalid or has expired.",
    };
  }

  return { ok: true };
}
