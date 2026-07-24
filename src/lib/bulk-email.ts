import type { BulkEmailAudience, EmailRecipientKind } from "@prisma/client";

import { prisma } from "@/lib/prisma";

const CAPPER_AUDIENCES: BulkEmailAudience[] = [
  "ALL_CAPPERS",
  "ACTIVE_CAPPERS",
  "VERIFIED_CAPPERS",
  "STOREFRONT_LIVE",
  "NEEDS_ATTENTION",
];

const CUSTOMER_AUDIENCES: BulkEmailAudience[] = [
  "ALL_CUSTOMERS",
  "ACTIVE_CUSTOMERS",
  "MARKETING_OPT_IN_CUSTOMERS",
];

export function isCapperAudience(audience: BulkEmailAudience): boolean {
  return CAPPER_AUDIENCES.includes(audience);
}

export function isCustomerAudience(audience: BulkEmailAudience): boolean {
  return CUSTOMER_AUDIENCES.includes(audience);
}

export async function resolveBulkEmailRecipients(
  audience: BulkEmailAudience,
  recipientKind: EmailRecipientKind,
) {
  if (recipientKind === "CUSTOMER") {
    const baseWhere = { role: "CUSTOMER" as const };
    switch (audience) {
      case "ACTIVE_CUSTOMERS":
        return prisma.user.findMany({
          where: { ...baseWhere, accountStatus: "ACTIVE" },
          select: { id: true, email: true, displayName: true, username: true },
        });
      case "MARKETING_OPT_IN_CUSTOMERS":
        return prisma.user.findMany({
          where: {
            ...baseWhere,
            customerProfile: { marketingOptIn: true },
          },
          select: { id: true, email: true, displayName: true, username: true },
        });
      default:
        return prisma.user.findMany({
          where: baseWhere,
          select: { id: true, email: true, displayName: true, username: true },
        });
    }
  }

  const baseWhere = { role: "CAPPER" as const };
  switch (audience) {
    case "ACTIVE_CAPPERS":
      return prisma.user.findMany({
        where: { ...baseWhere, accountStatus: "ACTIVE" },
        select: { id: true, email: true, displayName: true, username: true },
      });
    case "VERIFIED_CAPPERS":
      return prisma.user.findMany({
        where: { ...baseWhere, emailVerified: { not: null } },
        select: { id: true, email: true, displayName: true, username: true },
      });
    case "STOREFRONT_LIVE":
      return prisma.user.findMany({
        where: {
          ...baseWhere,
          capperProfile: { storefrontStatus: "STOREFRONT_LIVE" },
        },
        select: { id: true, email: true, displayName: true, username: true },
      });
    case "NEEDS_ATTENTION":
      return prisma.user.findMany({
        where: {
          ...baseWhere,
          capperProfile: { storefrontStatus: "NEEDS_ATTENTION" },
        },
        select: { id: true, email: true, displayName: true, username: true },
      });
    default:
      return prisma.user.findMany({
        where: baseWhere,
        select: { id: true, email: true, displayName: true, username: true },
      });
  }
}
