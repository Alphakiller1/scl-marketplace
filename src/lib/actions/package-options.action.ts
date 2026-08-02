"use server";

import { prisma } from "@/lib/prisma";
import { getCurrentAccount } from "@/lib/session";

export type PickPackageOption = { id: string; title: string };

export async function getPickPackageOptions(): Promise<PickPackageOption[]> {
  const account = await getCurrentAccount();
  if (!account || account.accountStatus !== "ACTIVE") return [];

  const profile = await prisma.capperProfile.findUnique({
    where: { userId: account.id },
    select: {
      packages: {
        where: {
          isActive: true,
          checkoutUrl: { not: null },
          trackingUrls: { some: {} },
        },
        orderBy: [{ sortOrder: "asc" }, { createdAt: "asc" }],
        select: { id: true, title: true },
      },
    },
  });
  return profile?.packages ?? [];
}
