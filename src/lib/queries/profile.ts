import "server-only";

import { prisma } from "@/lib/prisma";

export async function getCapperProfileByUserId(userId: string) {
  return prisma.capperProfile.findUnique({
    where: { userId },
    select: {
      headline: true,
      bio: true,
      avatarUrl: true,
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
    },
  });
}

export type CapperProfileView = NonNullable<
  Awaited<ReturnType<typeof getCapperProfileByUserId>>
>;
