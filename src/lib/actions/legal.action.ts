"use server";

import { revalidatePath } from "next/cache";

import { prisma } from "@/lib/prisma";
import { getCurrentAccount } from "@/lib/session";
import { CURRENT_POLICY_VERSION, legalAcceptanceSchema } from "@/lib/legal";

type LegalAcceptanceResult = { ok: true } | { ok: false; error: string };

export async function acceptCurrentTermsAction(input: {
  acceptTerms: boolean;
}): Promise<LegalAcceptanceResult> {
  const account = await getCurrentAccount();
  if (!account) return { ok: false, error: "Log in to continue." };
  if (
    account.accountStatus === "SUSPENDED" ||
    account.accountStatus === "DISABLED"
  ) {
    return { ok: false, error: "This account is restricted." };
  }

  const parsed = legalAcceptanceSchema.safeParse(input);
  if (!parsed.success) {
    return {
      ok: false,
      error:
        parsed.error.issues[0]?.message ?? "Accept the policies to continue.",
    };
  }

  if (!account.legalAcceptance) {
    await prisma.termsAcceptance.create({
      data: {
        userId: account.id,
        policyVersion: CURRENT_POLICY_VERSION,
      },
    });
  }

  revalidatePath("/dashboard");
  revalidatePath("/dashboard/profile");
  return { ok: true };
}
