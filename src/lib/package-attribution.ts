import "server-only";

import { prisma } from "@/lib/prisma";
import { activePublicPackageWhere } from "@/lib/public-packages";

/** Deduplicate untrusted ids and verify every selected package is live and owned. */
export async function validatePackageAttribution(
  capperId: string,
  packageIds: readonly string[],
): Promise<string[] | null> {
  const uniqueIds = [
    ...new Set(packageIds.map((id) => id.trim()).filter(Boolean)),
  ];
  if (uniqueIds.length === 0) return [];

  const owned = await prisma.package.findMany({
    where: {
      id: { in: uniqueIds },
      capperId,
      ...activePublicPackageWhere,
    },
    select: { id: true },
  });
  return owned.length === uniqueIds.length ? uniqueIds : null;
}
