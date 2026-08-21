"use server";

import { after } from "next/server";

import {
  passwordResetRequestSchema,
  resetPasswordSchema,
  type PasswordResetRequestInput,
  type ResetPasswordInput,
} from "@/lib/schemas/auth.schema";
import {
  consumePasswordResetToken,
  createPasswordResetToken,
  type ConsumedPasswordReset,
} from "@/lib/password-reset-tokens";
import { sendPasswordResetEmail, sendWelcomeEmail } from "@/lib/email";
import { appUrl } from "@/lib/app-url";
import { signUnsubscribeToken } from "@/lib/broadcast";
import { consumeRateLimit } from "@/lib/rate-limit";
import { getRequestIdentity } from "@/lib/request-identity";
import { classifyLoginIdentifier } from "@/lib/schemas/auth.schema";
import { findLoginCandidates } from "@/lib/user-credentials";

type PasswordResetResult = { ok: true } | { ok: false; error: string };

export async function requestPasswordResetAction(
  input: PasswordResetRequestInput,
): Promise<PasswordResetResult> {
  const parsed = passwordResetRequestSchema.safeParse(input);
  if (!parsed.success) {
    return { ok: false, error: "Enter your username or email." };
  }

  const { identifier } = parsed.data;
  const kind = classifyLoginIdentifier(identifier);
  const requestIdentity = await getRequestIdentity();
  const accountIdentity = `${kind}:${identifier}`;
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

  const candidates = await findLoginCandidates(identifier, kind);

  // Always return the same response so this form cannot enumerate accounts.
  try {
    // An inbox can carry more than one account; each gets its own link, named
    // by handle in the mail, so the reader can tell which is which.
    for (const user of candidates) {
      if (user.accountStatus === "DISABLED") continue;
      const token = await createPasswordResetToken(user.id);
      if (token) {
        await sendPasswordResetEmail(
          user.email,
          token,
          user.username ?? undefined,
        );
      }
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

  let reset: ConsumedPasswordReset | null = null;
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

  // A reset that also verified the email is somebody's first working day on
  // SCL — a legacy capper claiming an imported profile, or an unverified signup
  // recovering this way instead of through the verification link. They never
  // pass through /verify, so without this they would be the only active cappers
  // who never got a welcome. A routine reset for an already-verified account
  // sets `activated: false` and sends nothing.
  if (reset.activated && !reset.marketingOptOut) {
    const secret = process.env.AUTH_SECRET ?? "";
    const claimed = reset;
    after(async () => {
      await sendWelcomeEmail({
        email: claimed.email,
        unsubscribeUrl: secret
          ? `${appUrl()}/unsubscribe?token=${signUnsubscribeToken(claimed.userId, secret)}`
          : undefined,
      });
    });
  }

  return { ok: true };
}
