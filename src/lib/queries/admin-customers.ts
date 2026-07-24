import "server-only";

import { prisma } from "@/lib/prisma";

export async function getAdminCustomerAccounts() {
  return prisma.user.findMany({
    where: { role: "CUSTOMER" },
    select: {
      id: true,
      email: true,
      displayName: true,
      accountStatus: true,
      emailVerified: true,
      createdAt: true,
      customerProfile: {
        select: {
          marketingOptIn: true,
          adminNotes: true,
          _count: { select: { purchases: true } },
        },
      },
    },
    orderBy: { createdAt: "desc" },
  });
}

export type AdminCustomerAccount = Awaited<
  ReturnType<typeof getAdminCustomerAccounts>
>[number];
