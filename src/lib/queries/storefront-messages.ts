import "server-only";

import type { StorefrontMessageSender } from "@prisma/client";

import { prisma } from "@/lib/prisma";

const GHOST_DOMAIN = "@ghost.scl.demo";

export type StorefrontMessageRow = {
  id: string;
  body: string;
  senderRole: StorefrontMessageSender;
  createdAt: Date;
  sender: {
    displayName: string | null;
    username: string | null;
    email: string;
  };
};

export async function getStorefrontMessages(
  storeConnectionId: string,
): Promise<StorefrontMessageRow[]> {
  try {
    return await prisma.storefrontMessage.findMany({
      where: { storeConnectionId },
      orderBy: { createdAt: "asc" },
      select: {
        id: true,
        body: true,
        senderRole: true,
        createdAt: true,
        sender: {
          select: {
            displayName: true,
            username: true,
            email: true,
          },
        },
      },
    });
  } catch (error) {
    console.error("[getStorefrontMessages] database unavailable:", error);
    return [];
  }
}

export async function countUnreadStorefrontMessagesForAdmin(): Promise<number> {
  try {
    return await prisma.storefrontMessage.count({
      where: {
        senderRole: "CAPPER",
        readByAdminAt: null,
        storeConnection: {
          capper: {
            user: { NOT: { email: { endsWith: GHOST_DOMAIN } } },
          },
        },
      },
    });
  } catch (error) {
    console.error(
      "[countUnreadStorefrontMessagesForAdmin] database unavailable:",
      error,
    );
    return 0;
  }
}

export async function countUnreadStorefrontMessagesForCapper(
  userId: string,
): Promise<number> {
  try {
    return await prisma.storefrontMessage.count({
      where: {
        senderRole: "ADMIN",
        readByCapperAt: null,
        storeConnection: {
          capper: { userId },
        },
      },
    });
  } catch (error) {
    console.error(
      "[countUnreadStorefrontMessagesForCapper] database unavailable:",
      error,
    );
    return 0;
  }
}

export async function getStorefrontMessagesForCapper(
  capperId: string,
  connectionIds: string[],
): Promise<Record<string, StorefrontMessageRow[]>> {
  if (!connectionIds.length) return {};
  try {
    const rows = await prisma.storefrontMessage.findMany({
      where: {
        storeConnectionId: { in: connectionIds },
        storeConnection: { capperId },
      },
      orderBy: { createdAt: "asc" },
      select: {
        id: true,
        storeConnectionId: true,
        body: true,
        senderRole: true,
        createdAt: true,
        sender: {
          select: {
            displayName: true,
            username: true,
            email: true,
          },
        },
      },
    });
    const grouped: Record<string, StorefrontMessageRow[]> = {};
    for (const row of rows) {
      const bucket = grouped[row.storeConnectionId] ?? [];
      bucket.push({
        id: row.id,
        body: row.body,
        senderRole: row.senderRole,
        createdAt: row.createdAt,
        sender: row.sender,
      });
      grouped[row.storeConnectionId] = bucket;
    }
    return grouped;
  } catch (error) {
    console.error(
      "[getStorefrontMessagesForCapper] database unavailable:",
      error,
    );
    return {};
  }
}
