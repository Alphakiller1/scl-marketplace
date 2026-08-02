"use server";

import { revalidatePath } from "next/cache";

import { prisma } from "@/lib/prisma";
import { getCurrentAccount } from "@/lib/session";
import { CONSENT_TEXT_VERSION, legalAcceptanceSchema } from "@/lib/legal";
import { getCurrentPolicyBundle } from "@/lib/queries/policies";

type LegalAcceptanceResult = { ok: true } | { ok: false; error: string };

export async function acceptCurrentTermsAction(input: {
  confirmEligibility: boolean;
  acceptPolicies: boolean;
  acknowledgeResponsibleGaming: boolean;
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
    const policyBundle = await getCurrentPolicyBundle();
    await prisma.termsAcceptance.create({
      data: {
        userId: account.id,
        policyVersion: policyBundle.id,
        termsVersion: policyBundle.termsVersion,
        privacyVersion: policyBundle.privacyVersion,
        responsibleGamingVersion: policyBundle.responsibleGamingVersion,
        refundVersion: policyBundle.refundVersion,
        consentTextVersion: CONSENT_TEXT_VERSION,
        acceptanceSource: "RECONSENT",
      },
    });
  }

  revalidatePath("/dashboard");
  revalidatePath("/dashboard/profile");
  return { ok: true };
}
