"use server";

import { revalidatePath } from "next/cache";

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

  const target = await prisma.user.findFirst({
    where: { id: parsed.data.userId, role: "CAPPER" },
    select: { id: true, accountStatus: true },
  });
  if (!target) return { ok: false, error: "Capper account not found." };
  if (target.accountStatus === parsed.data.status) return { ok: true };

  await prisma.$transaction([
    prisma.user.update({
      where: { id: target.id },
      data: { accountStatus: parsed.data.status },
    }),
    prisma.accountStatusAudit.create({
      data: {
        userId: target.id,
        previousStatus: target.accountStatus,
        newStatus: parsed.data.status,
        changedById: admin.id,
        reason: parsed.data.reason || null,
      },
    }),
  ]);

  revalidatePath("/admin/cappers");
  revalidatePath("/dashboard");
  return { ok: true };
}
