"use server";

import { prisma } from "@/lib/prisma";
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

type PasswordResetResult = { ok: true } | { ok: false; error: string };

export async function requestPasswordResetAction(
  input: PasswordResetRequestInput,
): Promise<PasswordResetResult> {
  const parsed = passwordResetRequestSchema.safeParse(input);
  if (!parsed.success) {
    return { ok: false, error: "Enter a valid email address." };
  }

  const email = parsed.data.email.toLowerCase();
  const requestIdentity = await getRequestIdentity();
  const [emailAllowed, requestAllowed] = await Promise.all([
    consumeRateLimit({
      scope: "password-reset-email",
      identity: email,
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

  const user = await prisma.user.findUnique({
    where: { email },
    select: { id: true, email: true, accountStatus: true },
  });

  // Always return the same response so this form cannot enumerate accounts.
  if (!user || user.accountStatus === "DISABLED") return { ok: true };

  try {
    const token = await createPasswordResetToken(user.id);
    if (token) await sendPasswordResetEmail(user.email, token);
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
