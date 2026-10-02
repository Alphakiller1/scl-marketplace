import "server-only";

import { verifyUnsubscribeToken } from "@/lib/broadcast";
import { prisma } from "@/lib/prisma";

/**
 * Turn announcements off for one account and withdraw it from every campaign
 * still waiting in the queue. Direct one-capper messages are operational (the
 * same reason a password reset ignores the opt-out), so they stay queued.
 *
 * Deliberately not a server action: it takes a bare user id, so it must only be
 * reachable behind a verified unsubscribe token.
 */
export async function applyMarketingOptOut(
  userId: string,
  at: Date = new Date(),
): Promise<void> {
  await prisma.$transaction([
    prisma.user.update({
      where: { id: userId },
      data: { marketingOptOut: true },
    }),
    prisma.adminBroadcastRecipient.updateMany({
      where: {
        userId,
        status: "QUEUED",
        broadcast: { audience: { not: "SINGLE_CAPPER" } },
      },
      data: { status: "UNSUBSCRIBED", unsubscribedAt: at },
    }),
  ]);
}

/** Resolve a signed token to its user id, or null when it does not verify. */
export function unsubscribeTokenUserId(token: string | null | undefined) {
  const secret = process.env.AUTH_SECRET ?? "";
  if (!token || !secret.trim()) return null;
  return verifyUnsubscribeToken(token, secret);
}

/** Verify the token and opt the account out. Never throws. */
export async function unsubscribeWithToken(
  token: string | null | undefined,
): Promise<boolean> {
  const userId = unsubscribeTokenUserId(token);
  if (!userId) return false;
  try {
    await applyMarketingOptOut(userId);
    return true;
  } catch {
    return false;
  }
}
