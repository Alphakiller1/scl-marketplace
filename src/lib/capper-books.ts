import "server-only";

import { withTransientDatabaseRetry } from "@/lib/database-retry";
import { prisma } from "@/lib/prisma";

/** CapperProfile.books for the logged-in user; [] when no profile / empty = regions=us. */
export async function getCapperBooks(userId: string): Promise<string[]> {
  const profile = await withTransientDatabaseRetry(
    () =>
      prisma.capperProfile.findUnique({
        where: { userId },
        select: { books: true },
      }),
    { label: "odds board capper books" },
  );
  return profile?.books ?? [];
}
