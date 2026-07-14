import "server-only";

import { prisma } from "@/lib/prisma";

/** CapperProfile.books for the logged-in user; [] when no profile / empty = regions=us. */
export async function getCapperBooks(userId: string): Promise<string[]> {
  const profile = await prisma.capperProfile.findUnique({
    where: { userId },
    select: { books: true },
  });
  return profile?.books ?? [];
}
