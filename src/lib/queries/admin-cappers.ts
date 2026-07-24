import "server-only";

import { prisma } from "@/lib/prisma";

export async function getAdminCapperAccounts() {
  return prisma.user.findMany({
    where: { role: "CAPPER" },
    select: {
      id: true,
      displayName: true,
      username: true,
      email: true,
      emailVerified: true,
      accountStatus: true,
      createdAt: true,
      capperProfile: {
        select: {
          id: true,
          sports: true,
          storefrontStatus: true,
          commercePlatform: true,
          _count: { select: { plays: true, packages: true } },
        },
      },
    },
    orderBy: { createdAt: "desc" },
  });
}

export type AdminCapperAccount = Awaited<
  ReturnType<typeof getAdminCapperAccounts>
>[number];
