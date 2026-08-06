import "server-only";

import { attributionForSelection } from "@/lib/package-attribution-rule";
import { prisma } from "@/lib/prisma";
import { activePublicPackageWhere } from "@/lib/public-packages";

/**
 * Every live, sellable package the capper owns, in storefront order — the set a
 * pick falls back to when its author selected none.
 */
export async function capperDefaultPackageIds(
  capperId: string,
): Promise<string[]> {
  const packages = await prisma.package.findMany({
    where: { capperId, ...activePublicPackageWhere },
    orderBy: [{ sortOrder: "asc" }, { createdAt: "asc" }],
    select: { id: true },
  });
  return packages.map((pkg) => pkg.id);
}

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

/**
 * Which packages a pick counts toward.
 *
 * Returns null when an explicit selection names a package that is not live and
 * owned, so the caller can reject the write rather than silently dropping it.
 */
export async function resolvePackageAttribution(
  capperId: string,
  packageIds: readonly string[],
): Promise<string[] | null> {
  const explicit = await validatePackageAttribution(capperId, packageIds);
  if (explicit === null) return null;
  if (explicit.length > 0) return explicit;

  return attributionForSelection(
    explicit,
    await capperDefaultPackageIds(capperId),
  );
}
