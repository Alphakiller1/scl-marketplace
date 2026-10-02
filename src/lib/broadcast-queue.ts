import "server-only";

import { appUrl } from "@/lib/app-url";
import {
  brevoConfigured,
  brevoDailyLimit,
  sendBrevoCampaignEmail,
} from "@/lib/brevo";
import { normalizeBrevoMessageId } from "@/lib/brevo-message-id";
import {
  BREVO_MAX_ATTEMPTS,
  brevoEventTime,
  normalizeBrevoEvent,
} from "@/lib/brevo-send";
import { queuedRecipientBlock, signUnsubscribeToken } from "@/lib/broadcast";
import { renderBroadcastHtml } from "@/lib/email";
import { emailImageUrlResolver } from "@/lib/email-image-url";
import { prisma } from "@/lib/prisma";
import { listCampaignSuppressedAddresses } from "@/lib/queries/admin-audience";
import { applyMarketingOptOut } from "@/lib/unsubscribe";

const DEFAULT_RUN_SIZE = 50;
const DAY_MS = 24 * 60 * 60_000;
/** Longer than any worker can live (maxDuration 300s), so never a live run. */
const STALE_MS = 15 * 60_000;

const BLOCK_STATUS = {
  unsubscribed: "UNSUBSCRIBED",
  ineligible: "SKIPPED",
  address_changed: "SKIPPED",
  suppressed: "SKIPPED",
} as const;

function sentWindowStart(now: Date) {
  // A rolling window is conservative across provider/account time zones: it
  // cannot send two calendar-day allowances inside Brevo's still-open day.
  return new Date(now.getTime() - DAY_MS);
}

/**
 * Reserve one provider call while holding a Postgres transaction-scoped lock.
 * The queue can run from both a cron request and an immediate post-response
 * task, so a process-local mutex cannot protect the account-wide daily limit.
 */
async function reserveRecipientSend(
  recipientId: string,
  now: Date,
): Promise<"reserved" | "limit" | "gone" | "cancelled"> {
  return prisma.$transaction(async (tx) => {
    await tx.$queryRaw`SELECT 1 AS "locked" FROM pg_advisory_xact_lock(1935891554)`;
    const sentInWindow = await tx.adminBroadcastRecipient.count({
      where: { sentAt: { gte: sentWindowStart(now) } },
    });
    if (sentInWindow >= brevoDailyLimit()) return "limit";

    const recipient = await tx.adminBroadcastRecipient.findUnique({
      where: { id: recipientId },
      select: { status: true, broadcast: { select: { status: true } } },
    });
    if (!recipient || recipient.status !== "QUEUED") return "gone";
    if (recipient.broadcast.status === "CANCELLED") return "cancelled";

    const reserved = await tx.adminBroadcastRecipient.updateMany({
      where: { id: recipientId, status: "QUEUED" },
      data: { status: "SENT", sentAt: now },
    });
    return reserved.count === 1 ? "reserved" : "gone";
  });
}

function runSize(): number {
  const value = Number(process.env.BREVO_QUEUE_BATCH_SIZE ?? DEFAULT_RUN_SIZE);
  return Number.isInteger(value) && value > 0
    ? Math.min(value, 100)
    : DEFAULT_RUN_SIZE;
}

type Rollup = {
  sent: number;
  delivered: number;
  opened: number;
  bounced: number;
  failed: number;
  unsubscribed: number;
  queued: number;
};

/**
 * Recompute a campaign's report from its recipient ledger (one query).
 *
 * Only the worker moves a campaign between QUEUED and PROCESSING. A webhook
 * arriving mid-run must not release the worker's claim, a cancelled campaign
 * stays cancelled, and `completedAt` is stamped once.
 */
async function refreshBroadcastCounts(
  broadcastId: string,
  { fromWorker = false }: { fromWorker?: boolean } = {},
) {
  const [counts] = await prisma.$queryRaw<Rollup[]>`
    SELECT
      count(*) FILTER (WHERE "providerMessageId" IS NOT NULL)::int AS "sent",
      count(*) FILTER (WHERE "deliveredAt" IS NOT NULL)::int AS "delivered",
      count(*) FILTER (WHERE "openedAt" IS NOT NULL)::int AS "opened",
      count(*) FILTER (WHERE "bouncedAt" IS NOT NULL)::int AS "bounced",
      count(*) FILTER (WHERE "status" = 'FAILED')::int AS "failed",
      count(*) FILTER (WHERE "unsubscribedAt" IS NOT NULL)::int AS "unsubscribed",
      count(*) FILTER (WHERE "status" = 'QUEUED')::int AS "queued"
    FROM scl."AdminBroadcastRecipient"
    WHERE "broadcastId" = ${broadcastId}`;
  const current = await prisma.adminBroadcast.findUnique({
    where: { id: broadcastId },
    select: { status: true, completedAt: true },
  });
  if (!counts || !current) return;

  const finished = counts.queued === 0;
  const status =
    current.status === "CANCELLED"
      ? "CANCELLED"
      : finished
        ? counts.failed + counts.bounced > 0
          ? "PARTIAL_FAILED"
          : "COMPLETED"
        : fromWorker
          ? "QUEUED"
          : current.status;

  await prisma.adminBroadcast.update({
    where: { id: broadcastId },
    data: {
      sentCount: counts.sent,
      deliveredCount: counts.delivered,
      openedCount: counts.opened,
      bouncedCount: counts.bounced,
      failedCount: counts.failed,
      unsubscribedCount: counts.unsubscribed,
      queuedCount: counts.queued,
      status,
      completedAt:
        finished || current.status === "CANCELLED"
          ? (current.completedAt ?? new Date())
          : null,
    },
  });
}

/**
 * A recipient reserved (SENT, sentAt set) whose worker died before Brevo
 * answered has an unknown outcome. Re-sending could mail them twice, so record
 * it as failed instead of leaving it looking delivered forever.
 */
async function reconcileInterruptedSends(now: Date) {
  const stale = await prisma.adminBroadcastRecipient.findMany({
    where: {
      status: "SENT",
      providerMessageId: null,
      sentAt: { lt: new Date(now.getTime() - STALE_MS) },
    },
    select: { id: true, broadcastId: true },
    take: 500,
  });
  if (stale.length === 0) return;
  await prisma.adminBroadcastRecipient.updateMany({
    where: { id: { in: stale.map((row) => row.id) }, status: "SENT" },
    data: {
      status: "FAILED",
      error: "Outcome unknown: the send was interrupted before Brevo answered",
    },
  });
  for (const broadcastId of new Set(stale.map((row) => row.broadcastId))) {
    await refreshBroadcastCounts(broadcastId);
  }
}

export async function processBroadcastQueue(now: Date = new Date()) {
  if (!brevoConfigured()) {
    return { processed: 0, remainingToday: 0, skipped: "brevo_not_configured" };
  }

  await reconcileInterruptedSends(now);
  await prisma.adminBroadcast.updateMany({
    where: {
      status: "PROCESSING",
      startedAt: { lt: new Date(now.getTime() - STALE_MS) },
    },
    data: { status: "QUEUED" },
  });

  const sentInWindow = await prisma.adminBroadcastRecipient.count({
    where: { sentAt: { gte: sentWindowStart(now) } },
  });
  const capacity = Math.min(
    Math.max(0, brevoDailyLimit() - sentInWindow),
    runSize(),
  );
  if (capacity === 0) return { processed: 0, remainingToday: 0 };

  const secret = process.env.AUTH_SECRET ?? "";
  const broadcasts = await prisma.adminBroadcast.findMany({
    where: {
      status: "QUEUED",
      scheduledAt: { lte: now },
      // Only rows the queue path created. Anything else was already mailed by
      // the previous sender and must never be sent again.
      provider: "BREVO",
      requestKey: { not: null },
    },
    orderBy: [{ scheduledAt: "asc" }, { createdAt: "asc" }],
    take: 5,
    select: { id: true, audience: true },
  });

  let processed = 0;
  let halt: string | null = null;
  for (const candidate of broadcasts) {
    if (processed >= capacity || halt) break;
    if (candidate.audience !== "SINGLE_CAPPER" && !secret.trim()) {
      // Every mass email must carry a working unsubscribe link.
      halt = "AUTH_SECRET is required before mass campaigns can be delivered";
      break;
    }
    const claimed = await prisma.adminBroadcast.updateMany({
      where: { id: candidate.id, status: "QUEUED" },
      data: { status: "PROCESSING", startedAt: new Date() },
    });
    if (claimed.count === 0) continue;

    try {
      const result = await sendClaimedBroadcast(
        candidate.id,
        capacity - processed,
        secret,
      );
      processed += result.sent;
      halt = result.halt;
    } finally {
      await refreshBroadcastCounts(candidate.id, { fromWorker: true });
    }
  }

  const sentAfter = await prisma.adminBroadcastRecipient.count({
    where: { sentAt: { gte: sentWindowStart(new Date()) } },
  });
  return {
    processed,
    remainingToday: Math.max(0, brevoDailyLimit() - sentAfter),
    ...(halt ? { halted: halt } : {}),
  };
}

async function sendClaimedBroadcast(
  broadcastId: string,
  budget: number,
  secret: string,
): Promise<{ sent: number; halt: string | null }> {
  const [broadcast, suppressed] = await Promise.all([
    prisma.adminBroadcast.findUniqueOrThrow({
      where: { id: broadcastId },
      select: {
        id: true,
        subject: true,
        body: true,
        audience: true,
        recipients: {
          where: { status: "QUEUED" },
          orderBy: { createdAt: "asc" },
          // Some rows may be skipped at send time; over-fetch a little so a
          // run still fills its budget.
          take: budget * 2,
          select: {
            id: true,
            userId: true,
            address: true,
            attempts: true,
            user: {
              select: {
                id: true,
                email: true,
                username: true,
                displayName: true,
                emailVerified: true,
                accountStatus: true,
                isTest: true,
                marketingOptOut: true,
              },
            },
          },
        },
      },
    }),
    listCampaignSuppressedAddresses(),
  ]);
  const imageUrl = emailImageUrlResolver();
  const isMass = broadcast.audience !== "SINGLE_CAPPER";

  let sent = 0;
  for (const recipient of broadcast.recipients) {
    if (sent >= budget) break;

    const block = queuedRecipientBlock(
      broadcast.audience,
      recipient.address,
      recipient.user,
      suppressed,
    );
    if (block) {
      await prisma.adminBroadcastRecipient.updateMany({
        where: { id: recipient.id, status: "QUEUED" },
        data: {
          status: BLOCK_STATUS[block],
          error: `Not sent: ${block.replace(/_/g, " ")}`,
          ...(block === "unsubscribed" ? { unsubscribedAt: new Date() } : {}),
        },
      });
      continue;
    }

    const reserved = await reserveRecipientSend(recipient.id, new Date());
    if (reserved === "limit") return { sent, halt: "daily_limit_reached" };
    if (reserved === "cancelled") return { sent, halt: null };
    if (reserved === "gone") continue;

    const unsubscribeUrl =
      isMass && recipient.userId && secret
        ? `${appUrl()}/unsubscribe?token=${signUnsubscribeToken(recipient.userId, secret)}`
        : undefined;
    const oneClickUrl =
      isMass && recipient.userId && secret
        ? `${appUrl()}/api/unsubscribe?token=${signUnsubscribeToken(recipient.userId, secret)}`
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
      unsubscribeUrl: oneClickUrl,
    });

    if (result.accepted) {
      await prisma.adminBroadcastRecipient.update({
        where: { id: recipient.id },
        data: { providerMessageId: result.messageId, error: null },
      });
      sent += 1;
      continue;
    }

    if (result.kind === "permanent") {
      await prisma.adminBroadcastRecipient.update({
        where: { id: recipient.id },
        data: { status: "FAILED", error: result.error },
      });
      sent += 1;
      continue;
    }

    // Brevo answered and refused: nothing was sent, so release the quota slot.
    const attempts = recipient.attempts + (result.kind === "retryable" ? 1 : 0);
    const exhausted = attempts >= BREVO_MAX_ATTEMPTS;
    await prisma.adminBroadcastRecipient.update({
      where: { id: recipient.id },
      data: exhausted
        ? { status: "FAILED", error: result.error, attempts }
        : { status: "QUEUED", sentAt: null, error: result.error, attempts },
    });
    if (result.kind === "fatal") {
      // Every further call this run would be refused the same way.
      return { sent, halt: `Brevo refused the account: ${result.error}` };
    }
  }
  return { sent, halt: null };
}

/** Cancel a campaign that has not finished. Queued recipients are skipped. */
export async function cancelBroadcast(broadcastId: string): Promise<boolean> {
  const cancelled = await prisma.adminBroadcast.updateMany({
    where: { id: broadcastId, status: { in: ["QUEUED", "PROCESSING"] } },
    data: { status: "CANCELLED" },
  });
  if (cancelled.count === 0) return false;
  await prisma.adminBroadcastRecipient.updateMany({
    where: { broadcastId, status: "QUEUED" },
    data: { status: "SKIPPED", error: "Campaign cancelled" },
  });
  await refreshBroadcastCounts(broadcastId);
  return true;
}

/** Apply one Brevo webhook event. Returns whether it matched a recipient. */
export async function applyBrevoWebhookEvent(payload: unknown) {
  if (!payload || typeof payload !== "object") return false;
  const event = payload as Record<string, unknown>;
  const messageId =
    typeof event["message-id"] === "string"
      ? event["message-id"]
      : typeof event.messageId === "string"
        ? event.messageId
        : null;
  const eventName =
    typeof event.event === "string" ? normalizeBrevoEvent(event.event) : null;
  if (!messageId || !eventName) return false;

  const recipient = await prisma.adminBroadcastRecipient.findFirst({
    where: { providerMessageId: normalizeBrevoMessageId(messageId) },
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

  const at = brevoEventTime(event);
  const terminal =
    recipient.status === "UNSUBSCRIBED" ||
    (recipient.status === "BOUNCED" && recipient.error !== "soft_bounce");

  switch (eventName) {
    case "delivered":
    case "proxy_open": {
      if (terminal) return true;
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
      break;
    }
    case "opened": {
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
      break;
    }
    case "hard_bounce":
    case "soft_bounce":
    case "blocked":
    case "invalid": {
      if (
        recipient.status === "UNSUBSCRIBED" ||
        recipient.status === "OPENED"
      ) {
        return true;
      }
      // A soft bounce never downgrades a hard one.
      if (eventName === "soft_bounce" && terminal) return true;
      await prisma.adminBroadcastRecipient.update({
        where: { id: recipient.id },
        data: { status: "BOUNCED", bouncedAt: at, error: eventName },
      });
      break;
    }
    case "unsubscribed":
    case "spam": {
      await prisma.adminBroadcastRecipient.update({
        where: { id: recipient.id },
        data: { status: "UNSUBSCRIBED", unsubscribedAt: at },
      });
      // A complaint or unsubscribe withdraws them from everything queued, not
      // just future previews.
      if (recipient.userId) await applyMarketingOptOut(recipient.userId, at);
      break;
    }
    case "error": {
      if (recipient.status !== "SENT") return true;
      await prisma.adminBroadcastRecipient.update({
        where: { id: recipient.id },
        data: { status: "FAILED", error: eventName },
      });
      break;
    }
  }

  await refreshBroadcastCounts(recipient.broadcastId);
  return true;
}
