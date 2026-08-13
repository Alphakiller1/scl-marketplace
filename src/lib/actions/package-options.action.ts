"use server";

/**
 * Package options for pick-entry attribution.
 *
 * Deliberately unreferenced right now: attribution was pulled from the bet slip
 * until cappers can opt into it, so nothing calls this. It is kept rather than
 * deleted because the server contract it feeds (`packageIds` on createPlay /
 * createPlays / createParlay) is untouched — restoring the feature is a UI
 * change, and this is the query it needs. Delete it only if attribution is
 * being dropped for good.
 */

import { prisma } from "@/lib/prisma";
import { activePublicPackageWhere } from "@/lib/public-packages";
import { getCurrentAccount } from "@/lib/session";

export type PickPackageOption = { id: string; title: string };

export async function getPickPackageOptions(): Promise<PickPackageOption[]> {
  const account = await getCurrentAccount();
  if (!account || account.accountStatus !== "ACTIVE") return [];

  const profile = await prisma.capperProfile.findUnique({
    where: { userId: account.id },
    select: {
      packages: {
        where: activePublicPackageWhere,
        orderBy: [{ sortOrder: "asc" }, { createdAt: "asc" }],
        select: { id: true, title: true },
      },
    },
  });
  return profile?.packages ?? [];
}
