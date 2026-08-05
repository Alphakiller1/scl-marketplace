"use server";

import bcrypt from "bcryptjs";
import { revalidatePath } from "next/cache";

import { prisma } from "@/lib/prisma";
import { requireActiveUser } from "@/lib/session";
import {
  changePasswordSchema,
  type ChangePasswordInput,
} from "@/lib/schemas/auth.schema";
import { verifyLegacyPassword } from "@/lib/legacy-password";
import { consumeRateLimit } from "@/lib/rate-limit";

type ChangePasswordResult = { ok: true } | { ok: false; error: string };

/**
 * Change the signed-in account's password.
 *
 * The current password may still be the one carried over from the previous
 * platform — that is the whole point of this form — so it is checked against the
 * imported hash too, and a successful change retires that credential for good.
 */
export async function changePasswordAction(
  input: ChangePasswordInput,
): Promise<ChangePasswordResult> {
  const account = await requireActiveUser();

  const parsed = changePasswordSchema.safeParse(input);
  if (!parsed.success) {
    return {
      ok: false,
      error: parsed.error.issues[0]?.message ?? "Check the form and try again.",
    };
  }

  // Throttled on the account, not the request: this endpoint verifies a
  // password, so it would otherwise be an authenticated guessing oracle.
  const allowed = await consumeRateLimit({
    scope: "password-change",
    identity: account.id,
    limit: 10,
    windowMs: 15 * 60 * 1000,
  });
  if (!allowed) {
    return { ok: false, error: "Too many attempts. Try again later." };
  }

  const user = await prisma.user.findUnique({
    where: { id: account.id },
    select: {
      id: true,
      passwordHash: true,
      legacyPasswordHash: true,
      legacyPasswordFormat: true,
    },
  });
  if (!user) return { ok: false, error: "Log in to continue." };

  const currentMatches = user.passwordHash
    ? await bcrypt.compare(parsed.data.currentPassword, user.passwordHash)
    : false;
  const legacyMatches = currentMatches
    ? false
    : await verifyLegacyPassword(
        parsed.data.currentPassword,
        user.legacyPasswordHash,
        user.legacyPasswordFormat,
      );
  if (!currentMatches && !legacyMatches) {
    return { ok: false, error: "That current password is incorrect." };
  }

  try {
    await prisma.user.update({
      where: { id: user.id },
      data: {
        passwordHash: await bcrypt.hash(parsed.data.password, 12),
        legacyPasswordHash: null,
        legacyPasswordFormat: null,
        passwordUpdateRequiredAt: null,
        passwordNoticeSentAt: null,
      },
    });
  } catch (error) {
    console.error("[password] change failed:", error);
    return { ok: false, error: "We couldn't update your password." };
  }

  revalidatePath("/dashboard");
  revalidatePath("/dashboard/security");
  return { ok: true };
}
