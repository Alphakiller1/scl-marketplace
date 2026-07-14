"use server";

import { revalidatePath } from "next/cache";

import { prisma } from "@/lib/prisma";
import { getCurrentAccount } from "@/lib/session";
import { profileSchema, type ProfileInput } from "@/lib/schemas/profile.schema";

type ProfileResult = { ok: true } | { ok: false; error: string };

const nullify = (v?: string) => (v && v.trim() ? v.trim() : null);

export async function updateProfileAction(
  input: ProfileInput,
): Promise<ProfileResult> {
  const account = await getCurrentAccount();
  if (!account) return { ok: false, error: "You must be logged in." };
  if (account.accountStatus !== "ACTIVE" || !account.emailVerified) {
    return {
      ok: false,
      error: "Verify your email before updating your profile.",
    };
  }
  if (!account.legalAcceptance) {
    return { ok: false, error: "Accept the current terms to continue." };
  }

  const parsed = profileSchema.safeParse(input);
  if (!parsed.success) {
    return { ok: false, error: "Please check the form and try again." };
  }
  const d = parsed.data;

  const updated = await prisma.capperProfile.update({
    where: { userId: account.id },
    data: {
      headline: nullify(d.headline),
      bio: nullify(d.bio),
      providerType: d.providerType,
      sports: d.sports,
      books: d.books,
      specialties: d.specialties,
      betTypes: d.betTypes,
      dailyVolume: d.dailyVolume ? d.dailyVolume : null,
      writtenAnalysis: d.writtenAnalysis,
      biggestBetWon: nullify(d.biggestBetWon),
      storefrontTitle: nullify(d.storefrontTitle),
      storefrontDescription: nullify(d.storefrontDescription),
      storefrontEnabled: d.storefrontEnabled,
      // Social / website columns intentionally untouched — dormant legacy values.
    },
    select: { user: { select: { username: true } } },
  });

  revalidatePath("/dashboard/profile");
  revalidatePath("/cappers");
  revalidatePath("/leaderboard");
  if (updated.user.username) {
    revalidatePath(`/cappers/${updated.user.username}`);
  }
  return { ok: true };
}
