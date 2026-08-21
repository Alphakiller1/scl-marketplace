import "server-only";

import { prisma } from "@/lib/prisma";
import { getCurrentTermsVersion } from "@/lib/queries/policies";

export async function getCapperProfileByUserId(userId: string) {
  const currentPolicyVersion = await getCurrentTermsVersion();
  return prisma.capperProfile.findUnique({
    where: { userId },
    select: {
      headline: true,
      bio: true,
      avatarUrl: true,
      bannerUrl: true,
      specialties: true,
      sports: true,
      books: true,
      betTypes: true,
      dailyVolume: true,
      writtenAnalysis: true,
      biggestBetWon: true,
      providerType: true,
      storefrontTitle: true,
      storefrontDescription: true,
      storefrontEnabled: true,
      instagram: true,
      twitter: true,
      facebook: true,
      tiktok: true,
      website: true,
      user: {
        select: {
          displayName: true,
          username: true,
          accountStatus: true,
          emailVerified: true,
          termsAcceptances: {
            where: { policyVersion: currentPolicyVersion },
            select: { acceptedAt: true, policyVersion: true },
            orderBy: { acceptedAt: "desc" },
            take: 1,
          },
        },
      },
    },
  });
}

/** Some legacy accounts have a User row but no CapperProfile — create on demand. */
export async function ensureCapperProfileByUserId(userId: string) {
  const existing = await getCapperProfileByUserId(userId);
  if (existing) return existing;

  await prisma.capperProfile.create({ data: { userId } });
  return getCapperProfileByUserId(userId);
}

export type CapperProfileView = NonNullable<
  Awaited<ReturnType<typeof getCapperProfileByUserId>>
>;
