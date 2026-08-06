"use server";

import bcrypt from "bcryptjs";
import { revalidatePath } from "next/cache";

import { prisma } from "@/lib/prisma";
import { verifyLegacyPassword } from "@/lib/legacy-password";
import { consumeRateLimit } from "@/lib/rate-limit";
import {
  adminDeleteCapperSchema,
  deleteOwnAccountSchema,
  type AdminDeleteCapperInput,
  type DeleteOwnAccountInput,
} from "@/lib/schemas/account-delete.schema";
import { requireActiveUser, requireAdmin } from "@/lib/session";

type AccountDeleteResult = { ok: true } | { ok: false; error: string };

type PasswordUser = {
  id: string;
  passwordHash: string | null;
  legacyPasswordHash: string | null;
  legacyPasswordFormat: string | null;
};

async function verifyUserPassword(
  user: PasswordUser,
  password: string,
): Promise<boolean> {
  const currentMatches = user.passwordHash
    ? await bcrypt.compare(password, user.passwordHash)
    : false;
  if (currentMatches) return true;

  return verifyLegacyPassword(
    password,
    user.legacyPasswordHash,
    user.legacyPasswordFormat,
  );
}

/**
 * Hard-delete a capper user and everything that cascades from them.
 *
 * A few audit tables reference the actor with `onDelete: Restrict`, so those
 * rows are cleared first. Grading and policy audit trails that only null the
 * actor are left intact.
 */
async function deleteCapperUser(userId: string): Promise<AccountDeleteResult> {
  try {
    await prisma.$transaction(async (tx) => {
      const statusActorCount = await tx.accountStatusAudit.count({
        where: { changedById: userId },
      });
      if (statusActorCount > 0) {
        throw new Error("ACCOUNT_HAS_ADMIN_HISTORY");
      }

      await tx.packageAuditEvent.deleteMany({ where: { actorId: userId } });
      await tx.storefrontReviewEvent.deleteMany({
        where: { reviewedById: userId },
      });

      const deleted = await tx.user.deleteMany({
        where: { id: userId, role: "CAPPER" },
      });
      if (deleted.count !== 1) {
        throw new Error("CAPPER_NOT_FOUND");
      }
    });
  } catch (error) {
    if (error instanceof Error) {
      if (error.message === "ACCOUNT_HAS_ADMIN_HISTORY") {
        return {
          ok: false,
          error:
            "This account has administrative history and cannot be deleted automatically. Contact support.",
        };
      }
      if (error.message === "CAPPER_NOT_FOUND") {
        return { ok: false, error: "Capper account not found." };
      }
    }
    console.error("[account-delete] delete failed:", error);
    return { ok: false, error: "We couldn't delete this account." };
  }

  return { ok: true };
}

function revalidateAfterCapperDelete(username: string | null) {
  revalidatePath("/admin/cappers");
  revalidatePath("/dashboard");
  revalidatePath("/");
  revalidatePath("/cappers");
  revalidatePath("/discover");
  revalidatePath("/leaderboard");
  revalidatePath("/picks");
  if (username) {
    revalidatePath(`/cappers/${username.replace(/^@/, "")}`);
  }
}

export async function deleteOwnAccountAction(
  input: DeleteOwnAccountInput,
): Promise<AccountDeleteResult> {
  const account = await requireActiveUser();
  const parsed = deleteOwnAccountSchema.safeParse(input);
  if (!parsed.success) {
    return {
      ok: false,
      error: parsed.error.issues[0]?.message ?? "Check the form and try again.",
    };
  }

  const allowed = await consumeRateLimit({
    scope: "account-delete",
    identity: account.id,
    limit: 5,
    windowMs: 15 * 60 * 1000,
  });
  if (!allowed) {
    return { ok: false, error: "Too many attempts. Try again later." };
  }

  const user = await prisma.user.findUnique({
    where: { id: account.id },
    select: {
      id: true,
      role: true,
      username: true,
      passwordHash: true,
      legacyPasswordHash: true,
      legacyPasswordFormat: true,
    },
  });
  if (!user || user.role !== "CAPPER") {
    return { ok: false, error: "Only capper accounts can be deleted here." };
  }

  const storedUsername = user.username?.replace(/^@/, "").toLowerCase() ?? null;
  if (!storedUsername) {
    return {
      ok: false,
      error: "Set a username on your profile before deleting your account.",
    };
  }
  if (parsed.data.username !== storedUsername) {
    return { ok: false, error: "That username does not match your account." };
  }

  const passwordMatches = await verifyUserPassword(user, parsed.data.password);
  if (!passwordMatches) {
    return { ok: false, error: "That password is incorrect." };
  }

  const result = await deleteCapperUser(user.id);
  if (!result.ok) return result;

  revalidateAfterCapperDelete(storedUsername);
  revalidatePath("/dashboard/security");
  return { ok: true };
}

export async function adminDeleteCapperAction(
  input: AdminDeleteCapperInput,
): Promise<AccountDeleteResult> {
  const admin = await requireAdmin();
  const parsed = adminDeleteCapperSchema.safeParse(input);
  if (!parsed.success) {
    return {
      ok: false,
      error: parsed.error.issues[0]?.message ?? "Check the form and try again.",
    };
  }

  if (parsed.data.userId === admin.id) {
    return { ok: false, error: "You cannot delete your own account here." };
  }

  const allowed = await consumeRateLimit({
    scope: "admin-account-delete",
    identity: admin.id,
    limit: 10,
    windowMs: 15 * 60 * 1000,
  });
  if (!allowed) {
    return { ok: false, error: "Too many attempts. Try again later." };
  }

  const [adminCredentials, target] = await Promise.all([
    prisma.user.findUnique({
      where: { id: admin.id },
      select: {
        id: true,
        passwordHash: true,
        legacyPasswordHash: true,
        legacyPasswordFormat: true,
      },
    }),
    prisma.user.findFirst({
      where: { id: parsed.data.userId, role: "CAPPER" },
      select: { id: true, username: true },
    }),
  ]);

  if (
    !adminCredentials?.passwordHash &&
    !adminCredentials?.legacyPasswordHash
  ) {
    return {
      ok: false,
      error: "Set an admin password before deleting accounts.",
    };
  }
  if (!target) {
    return { ok: false, error: "Capper account not found." };
  }

  const passwordMatches = await verifyUserPassword(
    adminCredentials,
    parsed.data.adminPassword,
  );
  if (!passwordMatches) {
    return { ok: false, error: "That admin password is incorrect." };
  }

  const result = await deleteCapperUser(target.id);
  if (!result.ok) return result;

  revalidateAfterCapperDelete(target.username);
  revalidatePath(`/admin/cappers/${target.id}`);
  return { ok: true };
}
