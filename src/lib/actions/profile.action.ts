"use server";

import { revalidatePath } from "next/cache";

import { prisma } from "@/lib/prisma";
import { getCurrentUser } from "@/lib/session";
import { profileSchema, type ProfileInput } from "@/lib/schemas/profile.schema";

type ProfileResult = { ok: true } | { ok: false; error: string };

const nullify = (v?: string) => (v && v.trim() ? v.trim() : null);

export async function updateProfileAction(
  input: ProfileInput,
): Promise<ProfileResult> {
  const user = await getCurrentUser();
  if (!user) return { ok: false, error: "You must be logged in." };

  const parsed = profileSchema.safeParse(input);
  if (!parsed.success) {
    return { ok: false, error: "Please check the form and try again." };
  }
  const d = parsed.data;

  await prisma.capperProfile.update({
    where: { userId: user.id },
    data: {
      headline: nullify(d.headline),
      bio: nullify(d.bio),
      providerType: d.providerType,
      sports: d.sports,
      betTypes: d.betTypes,
      dailyVolume: d.dailyVolume ? d.dailyVolume : null,
      writtenAnalysis: d.writtenAnalysis,
      biggestBetWon: nullify(d.biggestBetWon),
      instagram: nullify(d.instagram),
      twitter: nullify(d.twitter),
      facebook: nullify(d.facebook),
      tiktok: nullify(d.tiktok),
      website: nullify(d.website),
    },
  });

  revalidatePath("/dashboard/profile");
  return { ok: true };
}
