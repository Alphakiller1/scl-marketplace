"use server";

import { revalidatePath, revalidateTag } from "next/cache";

import { prisma } from "@/lib/prisma";
import { requireAdmin } from "@/lib/session";
import {
  accountStatusUpdateSchema,
  type AccountStatusUpdateInput,
} from "@/lib/schemas/account-status.schema";

type AccountStatusResult = { ok: true } | { ok: false; error: string };

export async function updateAccountStatusAction(
  input: AccountStatusUpdateInput,
): Promise<AccountStatusResult> {
  const admin = await requireAdmin();
  const parsed = accountStatusUpdateSchema.safeParse(input);
  if (!parsed.success) {
    return {
      ok: false,
      error: parsed.error.issues[0]?.message ?? "Check the account status.",
    };
  }

  const result = await prisma.$transaction(async (tx) => {
    const target = await tx.user.findFirst({
      where: { id: parsed.data.userId, role: "CAPPER" },
      select: {
        id: true,
        username: true,
        accountStatus: true,
      },
    });
    if (!target) {
      return { ok: false as const, error: "Capper account not found." };
    }
    if (
      parsed.data.expectedStatus &&
      target.accountStatus !== parsed.data.expectedStatus
    ) {
      return {
        ok: false as const,
        error:
          "This account changed after you opened it. Refresh and review the latest status.",
      };
    }
    if (target.accountStatus === parsed.data.status) {
      return { ok: true as const, username: target.username };
    }

    const updated = await tx.user.updateMany({
      where: {
        id: target.id,
        role: "CAPPER",
        accountStatus: target.accountStatus,
      },
      data: { accountStatus: parsed.data.status },
    });
    if (updated.count !== 1) {
      return {
        ok: false as const,
        error:
          "This account changed while you were saving. Refresh and try again.",
      };
    }

    await tx.accountStatusAudit.create({
      data: {
        userId: target.id,
        previousStatus: target.accountStatus,
        newStatus: parsed.data.status,
        changedById: admin.id,
        reason: parsed.data.reason || null,
      },
    });
    return { ok: true as const, username: target.username };
  });
  if (!result.ok) return result;

  // Leaderboard and Discover use a tagged cross-request cache. Page
  // revalidation alone can leave a disabled capper in those cached results.
  revalidateTag("leaderboard", { expire: 0 });
  revalidatePath("/admin/cappers");
  revalidatePath(`/admin/cappers/${parsed.data.userId}`);
  revalidatePath("/dashboard");
  revalidatePath("/");
  revalidatePath("/cappers");
  revalidatePath("/discover");
  revalidatePath("/leaderboard");
  revalidatePath("/picks");
  if (result.username) {
    revalidatePath(`/cappers/${result.username.replace(/^@/, "")}`);
  }
  return { ok: true };
}
