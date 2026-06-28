import "server-only";

import { prisma } from "@/lib/prisma";
import { CURRENT_POLICY_VERSION } from "@/lib/legal";

export async function getCapperProfileByUserId(userId: string) {
  return prisma.capperProfile.findUnique({
    where: { userId },
    select: {
      headline: true,
      bio: true,
      avatarUrl: true,
      bannerUrl: true,
      specialties: true,
      sports: true,
      betTypes: true,
      dailyVolume: true,
      writtenAnalysis: true,
      biggestBetWon: true,
      providerType: true,
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
            where: { policyVersion: CURRENT_POLICY_VERSION },
            select: { acceptedAt: true, policyVersion: true },
            orderBy: { acceptedAt: "desc" },
            take: 1,
          },
        },
      },
    },
  });
}

export type CapperProfileView = NonNullable<
  Awaited<ReturnType<typeof getCapperProfileByUserId>>
>;
