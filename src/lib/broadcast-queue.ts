import "server-only";

import { appUrl } from "@/lib/app-url";
import { brevoDailyLimit, sendBrevoCampaignEmail } from "@/lib/brevo";
import { normalizeBrevoMessageId } from "@/lib/brevo-message-id";
import { signUnsubscribeToken } from "@/lib/broadcast";
import { renderBroadcastHtml } from "@/lib/email";
import { emailImageUrlResolver } from "@/lib/email-image-url";
import { prisma } from "@/lib/prisma";

const DEFAULT_RUN_SIZE = 50;
const DAY_MS = 24 * 60 * 60_000;

/**
 * Reserve one provider call while holding a Postgres transaction-scoped lock.
 * The queue can run from both a cron request and an immediate post-response
 * task, so a process-local mutex cannot protect the account-wide daily limit.
 */
async function reserveRecipientSend(
  recipientId: string,
  now: Date,
): Promise<boolean> {
  return prisma.$transaction(async (tx) => {
    await tx.$queryRaw`SELECT 1 AS "locked" FROM pg_advisory_xact_lock(1935891554)`;
    const sentInWindow = await tx.adminBroadcastRecipient.count({
      where: { sentAt: { gte: new Date(now.getTime() - DAY_MS) } },
    });
    if (sentInWindow >= brevoDailyLimit()) return false;

    const reserved = await tx.adminBroadcastRecipient.updateMany({
      where: { id: recipientId, status: "QUEUED" },
      data: { status: "SENT", sentAt: now },
    });
    return reserved.count === 1;
  });
}

function runSize(): number {
  const value = Number(process.env.BREVO_QUEUE_BATCH_SIZE ?? DEFAULT_RUN_SIZE);
  return Number.isInteger(value) && value > 0
    ? Math.min(value, 100)
    : DEFAULT_RUN_SIZE;
}

async function refreshBroadcastCounts(broadcastId: string) {
  const [sent, delivered, opened, bounced, failed, unsubscribed, queued] =
    await Promise.all([
      prisma.adminBroadcastRecipient.count({
        where: {
          broadcastId,
          sentAt: { not: null },
        },
      }),
      prisma.adminBroadcastRecipient.count({
        where: { broadcastId, deliveredAt: { not: null } },
      }),
      prisma.adminBroadcastRecipient.count({
        where: { broadcastId, openedAt: { not: null } },
      }),
      prisma.adminBroadcastRecipient.count({
        where: { broadcastId, bouncedAt: { not: null } },
      }),
      prisma.adminBroadcastRecipient.count({
        where: { broadcastId, status: "FAILED" },
      }),
      prisma.adminBroadcastRecipient.count({
        where: { broadcastId, unsubscribedAt: { not: null } },
      }),
      prisma.adminBroadcastRecipient.count({
        where: { broadcastId, status: "QUEUED" },
      }),
    ]);

  const finished = queued === 0;
  await prisma.adminBroadcast.update({
    where: { id: broadcastId },
    data: {
      sentCount: sent,
      deliveredCount: delivered,
      openedCount: opened,
      bouncedCount: bounced,
      failedCount: failed,
      unsubscribedCount: unsubscribed,
      status: finished
        ? failed + bounced > 0
          ? "PARTIAL_FAILED"
          : "COMPLETED"
        : "QUEUED",
      completedAt: finished ? new Date() : null,
    },
  });
}

export async function processBroadcastQueue(now: Date = new Date()) {
  const sentToday = await prisma.adminBroadcastRecipient.count({
    where: {
      // A rolling window is conservative across provider/account time zones:
      // it cannot accidentally send two calendar-day allowances inside Brevo's
      // own still-open day.
      sentAt: { gte: new Date(now.getTime() - DAY_MS) },
    },
  });
  const available = Math.max(0, brevoDailyLimit() - sentToday);
  const capacity = Math.min(available, runSize());
  if (capacity === 0) return { processed: 0, remainingToday: 0 };

  await prisma.adminBroadcast.updateMany({
    where: {
      status: "PROCESSING",
      startedAt: { lt: new Date(now.getTime() - 15 * 60_000) },
    },
    data: { status: "QUEUED" },
  });

  const broadcasts = await prisma.adminBroadcast.findMany({
    where: { status: "QUEUED", scheduledAt: { lte: now } },
    orderBy: [{ scheduledAt: "asc" }, { createdAt: "asc" }],
    take: 5,
    select: { id: true },
  });

  let processed = 0;
  for (const candidate of broadcasts) {
    if (processed >= capacity) break;
    const claimed = await prisma.adminBroadcast.updateMany({
      where: { id: candidate.id, status: "QUEUED" },
      data: { status: "PROCESSING", startedAt: now },
    });
    if (claimed.count === 0) continue;

    const broadcast = await prisma.adminBroadcast.findUniqueOrThrow({
      where: { id: candidate.id },
      select: {
        id: true,
        subject: true,
        body: true,
        audience: true,
        recipients: {
          where: { status: "QUEUED" },
          orderBy: { createdAt: "asc" },
          take: capacity - processed,
          select: {
            id: true,
            userId: true,
            address: true,
            user: { select: { username: true, displayName: true } },
          },
        },
      },
    });
    const secret = process.env.AUTH_SECRET ?? "";
    if (broadcast.audience !== "SINGLE_CAPPER" && !secret.trim()) {
      await prisma.adminBroadcast.update({
        where: { id: broadcast.id },
        data: { status: "QUEUED", startedAt: null },
      });
      throw new Error(
        "AUTH_SECRET is required before mass campaigns can be delivered",
      );
    }
    const imageUrl = emailImageUrlResolver();

    for (const recipient of broadcast.recipients) {
      const reserved = await reserveRecipientSend(recipient.id, new Date());
      if (!reserved) break;

      const unsubscribeUrl =
        broadcast.audience !== "SINGLE_CAPPER" && recipient.userId && secret
          ? `${appUrl()}/unsubscribe?token=${signUnsubscribeToken(recipient.userId, secret)}`
          : undefined;
      const result = await sendBrevoCampaignEmail({
        to: recipient.address,
        name: recipient.user?.displayName ?? recipient.user?.username,
        subject: broadcast.subject,
        html: renderBroadcastHtml({
          body: broadcast.body,
          imageUrl,
          unsubscribeUrl,
        }),
        broadcastId: broadcast.id,
        recipientId: recipient.id,
      });

      await prisma.adminBroadcastRecipient.update({
        where: { id: recipient.id },
        data: result.accepted
          ? { providerMessageId: result.messageId }
          : { status: "FAILED", error: result.error },
      });
      processed += 1;
    }

    await refreshBroadcastCounts(broadcast.id);
  }

  const sentInWindow = await prisma.adminBroadcastRecipient.count({
    where: { sentAt: { gte: new Date(Date.now() - DAY_MS) } },
  });
  return {
    processed,
    remainingToday: Math.max(0, brevoDailyLimit() - sentInWindow),
  };
}

export async function applyBrevoWebhookEvent(payload: unknown) {
  if (!payload || typeof payload !== "object") return false;
  const event = payload as Record<string, unknown>;
  const messageId =
    typeof event["message-id"] === "string"
      ? event["message-id"]
      : typeof event.messageId === "string"
        ? event.messageId
        : null;
  const eventName = typeof event.event === "string" ? event.event : null;
  if (!messageId || !eventName) return false;

  const normalizedMessageId = normalizeBrevoMessageId(messageId);

  const recipient = await prisma.adminBroadcastRecipient.findFirst({
    where: { providerMessageId: normalizedMessageId },
    select: {
      id: true,
      broadcastId: true,
      userId: true,
      status: true,
      error: true,
      deliveredAt: true,
      openedAt: true,
    },
  });
  if (!recipient) return false;

  const at = new Date();
  const normalized = eventName.toLowerCase();
  if (normalized === "delivered") {
    if (
      recipient.status === "UNSUBSCRIBED" ||
      (recipient.status === "BOUNCED" && recipient.error !== "soft_bounce")
    ) {
      return true;
    }
    await prisma.adminBroadcastRecipient.update({
      where: { id: recipient.id },
      data: {
        status: recipient.status === "OPENED" ? "OPENED" : "DELIVERED",
        delivered: true,
        deliveredAt: recipient.deliveredAt ?? at,
        bouncedAt: null,
        error: null,
      },
    });
  } else if (
    normalized === "opened" ||
    normalized === "unique_opened" ||
    normalized === "proxy_open" ||
    normalized === "unique_proxy_open"
  ) {
    if (recipient.status === "UNSUBSCRIBED") return true;
    await prisma.adminBroadcastRecipient.update({
      where: { id: recipient.id },
      data: {
        status: "OPENED",
        delivered: true,
        deliveredAt: recipient.deliveredAt ?? at,
        openedAt: recipient.openedAt ?? at,
        bouncedAt: null,
        error: null,
      },
    });
  } else if (
    normalized === "hard_bounce" ||
    normalized === "soft_bounce" ||
    normalized === "blocked" ||
    normalized === "invalid"
  ) {
    if (recipient.status === "UNSUBSCRIBED" || recipient.status === "OPENED") {
      return true;
    }
    await prisma.adminBroadcastRecipient.update({
      where: { id: recipient.id },
      data: { status: "BOUNCED", bouncedAt: at, error: normalized },
    });
  } else if (normalized === "unsubscribed" || normalized === "spam") {
    await prisma.$transaction([
      prisma.adminBroadcastRecipient.update({
        where: { id: recipient.id },
        data: { status: "UNSUBSCRIBED", unsubscribedAt: at },
      }),
      ...(recipient.userId
        ? [
            prisma.user.update({
              where: { id: recipient.userId },
              data: { marketingOptOut: true },
            }),
          ]
        : []),
    ]);
  } else if (normalized === "error") {
    if (
      recipient.status === "DELIVERED" ||
      recipient.status === "OPENED" ||
      recipient.status === "BOUNCED" ||
      recipient.status === "UNSUBSCRIBED"
    ) {
      return true;
    }
    await prisma.adminBroadcastRecipient.update({
      where: { id: recipient.id },
      data: { status: "FAILED", error: normalized },
    });
  } else {
    return true;
  }

  await refreshBroadcastCounts(recipient.broadcastId);
  return true;
}
