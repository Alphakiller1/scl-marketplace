"use server";

import { createHash } from "crypto";

import { Prisma } from "@prisma/client";
import { revalidatePath } from "next/cache";

import { audienceLabel } from "@/lib/admin-audience";
import { afterResponse } from "@/lib/after-response";
import { brevoConfigured } from "@/lib/brevo";
import {
  BROADCAST_MAX_RECIPIENTS,
  resolveBroadcastRecipients,
  type BroadcastCandidate,
  type BroadcastRecipient,
} from "@/lib/broadcast";
import { cancelBroadcast, processBroadcastQueue } from "@/lib/broadcast-queue";
import { verifyEmailImagesDeliverable } from "@/lib/email-image-url";
import { prisma } from "@/lib/prisma";
import {
  listCampaignSuppressedAddresses,
  listEligibleAudienceMembers,
} from "@/lib/queries/admin-audience";
import {
  audienceFiltersSchema,
  saveAudienceGroupSchema,
  type AudienceFilters,
} from "@/lib/schemas/audience.schema";
import {
  broadcastSchema,
  type BroadcastInput,
} from "@/lib/schemas/broadcast.schema";
import { requireAdmin } from "@/lib/session";

type BroadcastResult =
  | {
      ok: true;
      broadcastId: string;
      recipientCount: number;
      scheduledAt: string | null;
    }
  | { ok: false; error: string; code?: "DUPLICATE" | "AUDIENCE_CHANGED" };

type PreviewMember = {
  id: string;
  label: string;
  email: string;
  lastPlayAt: string | null;
  playCount: number;
  hasConnectedStorefront: boolean;
};

const CANDIDATE_SELECT = {
  id: true,
  email: true,
  username: true,
  emailVerified: true,
  accountStatus: true,
  isTest: true,
  marketingOptOut: true,
} as const;

/**
 * Identifies the exact recipient set the admin reviewed. The count alone can
 * match while the people differ (one opted out, another joined).
 */
function recipientFingerprint(recipients: readonly BroadcastRecipient[]) {
  return createHash("sha256")
    .update(
      recipients
        .map((recipient) => recipient.userId)
        .sort()
        .join(","),
    )
    .digest("hex")
    .slice(0, 32);
}

/** How far ahead a campaign may be scheduled. */
const MAX_SCHEDULE_AHEAD_MS = 60 * 24 * 60 * 60_000;
/** A schedule this close to now (or slightly past, from clock skew) sends now. */
const SCHEDULE_GRACE_MS = 2 * 60_000;
/** The same subject and body inside this window needs an explicit confirm. */
const DUPLICATE_WINDOW_MS = 24 * 60 * 60_000;

async function loadRecipients(input: {
  audience: BroadcastInput["audience"];
  userId?: string;
  filters?: unknown;
}): Promise<{
  recipients: BroadcastRecipient[];
  members: PreviewMember[];
  filters: AudienceFilters | null;
}> {
  if (input.audience === "FILTERED_CAPPERS") {
    const parsed = audienceFiltersSchema.safeParse(input.filters ?? {});
    if (!parsed.success) throw new Error("Those audience filters are invalid.");
    const members = await listEligibleAudienceMembers(parsed.data);
    return {
      filters: parsed.data,
      recipients: members.map((member) => ({
        userId: member.id,
        email: member.email,
        username: member.username,
      })),
      members: members.map((member) => ({
        id: member.id,
        label: member.username
          ? `@${member.username}`
          : member.displayName || member.email,
        email: member.email,
        lastPlayAt: member.lastPlayAt?.toISOString() ?? null,
        playCount: member.playCount + member.parlayCount,
        hasConnectedStorefront: member.hasConnectedStorefront,
      })),
    };
  }

  const [candidates, suppressedAddresses]: [BroadcastCandidate[], Set<string>] =
    await Promise.all([
      prisma.user.findMany({
        where:
          input.audience === "SINGLE_CAPPER"
            ? { id: input.userId, role: "CAPPER" }
            : { role: "CAPPER" },
        select: CANDIDATE_SELECT,
        orderBy: [{ createdAt: "asc" }, { id: "asc" }],
      }),
      listCampaignSuppressedAddresses(),
    ]);
  const exclusions = audienceFiltersSchema.safeParse(input.filters ?? {});
  const excludedIds = new Set(
    exclusions.success && input.audience !== "SINGLE_CAPPER"
      ? exclusions.data.excludeUserIds
      : [],
  );
  // Removing a person removes their inbox, not just one of its accounts.
  const excludedInboxes = new Set(
    candidates
      .filter((candidate) => excludedIds.has(candidate.id))
      .map((candidate) => candidate.email.trim().toLowerCase()),
  );
  const recipients = resolveBroadcastRecipients(
    input.audience,
    candidates.filter(
      (candidate) => !excludedInboxes.has(candidate.email.trim().toLowerCase()),
    ),
  ).filter(
    (recipient) =>
      !suppressedAddresses.has(recipient.email.trim().toLowerCase()),
  );
  return {
    recipients,
    filters:
      excludedIds.size > 0
        ? audienceFiltersSchema.parse({ excludeUserIds: [...excludedIds] })
        : null,
    members: recipients.map((recipient) => ({
      id: recipient.userId,
      label: recipient.username ? `@${recipient.username}` : recipient.email,
      email: recipient.email,
      lastPlayAt: null,
      playCount: 0,
      hasConnectedStorefront: false,
    })),
  };
}

export async function previewBroadcastAudienceAction(input: {
  audience: BroadcastInput["audience"];
  userId?: string;
  filters?: unknown;
}): Promise<
  | { ok: true; count: number; fingerprint: string; members: PreviewMember[] }
  | { ok: false; error: string }
> {
  await requireAdmin();
  if (input.audience === "SINGLE_CAPPER" && !input.userId) {
    return { ok: false, error: "Choose which capper to message." };
  }
  try {
    const result = await loadRecipients(input);
    return {
      ok: true,
      count: result.recipients.length,
      fingerprint: recipientFingerprint(result.recipients),
      members: result.members,
    };
  } catch (error) {
    return {
      ok: false,
      error:
        error instanceof Error
          ? error.message
          : "Couldn't work out who that would reach.",
    };
  }
}

export async function saveAudienceGroupAction(input: unknown) {
  const admin = await requireAdmin();
  const parsed = saveAudienceGroupSchema.safeParse(input);
  if (!parsed.success) {
    return {
      ok: false as const,
      error: parsed.error.issues[0]?.message ?? "Check the group.",
    };
  }
  try {
    const group = await prisma.audienceGroup.upsert({
      where: {
        createdById_name: { createdById: admin.id, name: parsed.data.name },
      },
      create: {
        name: parsed.data.name,
        description: parsed.data.description || null,
        filters: parsed.data.filters,
        createdById: admin.id,
      },
      update: {
        description: parsed.data.description || null,
        filters: parsed.data.filters,
      },
      select: { id: true, name: true },
    });
    revalidatePath("/admin/messages");
    revalidatePath("/admin/audiences");
    return { ok: true as const, group };
  } catch {
    return { ok: false as const, error: "Couldn't save that group." };
  }
}

export async function deleteAudienceGroupAction(groupId: string) {
  const admin = await requireAdmin();
  await prisma.audienceGroup.deleteMany({
    where: { id: groupId, createdById: admin.id },
  });
  revalidatePath("/admin/messages");
  revalidatePath("/admin/audiences");
  return { ok: true as const };
}

export async function cancelBroadcastAction(broadcastId: string) {
  await requireAdmin();
  const cancelled = await cancelBroadcast(broadcastId);
  revalidatePath("/admin/messages");
  return cancelled
    ? { ok: true as const }
    : {
        ok: false as const,
        error: "That campaign has already finished or was cancelled.",
      };
}

function isUniqueViolation(error: unknown) {
  return (
    error instanceof Prisma.PrismaClientKnownRequestError &&
    error.code === "P2002"
  );
}

export async function sendBroadcastAction(
  input: BroadcastInput,
): Promise<BroadcastResult> {
  const admin = await requireAdmin();
  const parsed = broadcastSchema.safeParse(input);
  if (!parsed.success) {
    return {
      ok: false,
      error: parsed.error.issues[0]?.message ?? "Check the message.",
    };
  }
  const {
    audience,
    userId,
    subject,
    body,
    confirmRecipientCount,
    confirmFingerprint,
    scheduledAt,
    groupId,
    requestKey,
    confirmDuplicate,
  } = parsed.data;

  // A retried submission returns the campaign it already created.
  const existing = await prisma.adminBroadcast.findUnique({
    where: { requestKey },
    select: { id: true, recipientCount: true, scheduledAt: true },
  });
  if (existing) {
    return {
      ok: true,
      broadcastId: existing.id,
      recipientCount: existing.recipientCount,
      scheduledAt: existing.scheduledAt.toISOString(),
    };
  }

  if (!brevoConfigured()) {
    return {
      ok: false,
      error:
        "Campaign delivery is not configured. Add the Brevo settings first.",
    };
  }
  if (audience !== "SINGLE_CAPPER" && !process.env.AUTH_SECRET?.trim()) {
    return {
      ok: false,
      error:
        "Campaign delivery needs AUTH_SECRET so every mass email has a secure unsubscribe link.",
    };
  }

  const now = new Date();
  if (scheduledAt) {
    if (scheduledAt.getTime() < now.getTime() - SCHEDULE_GRACE_MS) {
      return {
        ok: false,
        error: "That scheduled time has passed. Pick a future time.",
      };
    }
    if (scheduledAt.getTime() > now.getTime() + MAX_SCHEDULE_AHEAD_MS) {
      return {
        ok: false,
        error: "Schedule campaigns at most 60 days ahead.",
      };
    }
  }
  const sendAt =
    scheduledAt && scheduledAt.getTime() > now.getTime() + SCHEDULE_GRACE_MS
      ? scheduledAt
      : now;

  if (!confirmDuplicate) {
    const recent = await prisma.adminBroadcast.findFirst({
      where: {
        subject,
        body,
        status: { not: "CANCELLED" },
        createdAt: { gte: new Date(now.getTime() - DUPLICATE_WINDOW_MS) },
      },
      orderBy: { createdAt: "desc" },
      select: { createdAt: true, recipientCount: true },
    });
    if (recent) {
      return {
        ok: false,
        code: "DUPLICATE",
        error: `This exact message was already queued for ${recent.recipientCount} recipients in the last 24 hours. Confirm to send it again.`,
      };
    }
  }

  const imagesOk = await verifyEmailImagesDeliverable(body);
  if (!imagesOk.ok) return imagesOk;

  let loaded;
  try {
    loaded = await loadRecipients({
      audience,
      userId,
      filters: parsed.data.filters,
    });
  } catch (error) {
    return {
      ok: false,
      error: error instanceof Error ? error.message : "Invalid audience.",
    };
  }
  const { recipients, filters } = loaded;
  if (recipients.length === 0) {
    return { ok: false, error: "That audience has nobody in it." };
  }
  if (recipients.length > BROADCAST_MAX_RECIPIENTS) {
    return {
      ok: false,
      error: `That would reach ${recipients.length} people, above the ${BROADCAST_MAX_RECIPIENTS} safety cap.`,
    };
  }
  if (
    audience !== "SINGLE_CAPPER" &&
    (confirmRecipientCount !== recipients.length ||
      confirmFingerprint !== recipientFingerprint(recipients))
  ) {
    return {
      ok: false,
      code: "AUDIENCE_CHANGED",
      error:
        confirmRecipientCount === recipients.length
          ? "The recipients changed since your preview. Review and confirm again."
          : `The audience changed to ${recipients.length} recipients. Review and confirm again.`,
    };
  }

  let group: { id: string; name: string } | null = null;
  if (groupId) {
    group = await prisma.audienceGroup.findFirst({
      where: { id: groupId, createdById: admin.id },
      select: { id: true, name: true },
    });
    if (!group)
      return { ok: false, error: "That saved group no longer exists." };
  }

  let broadcast: { id: string };
  try {
    broadcast = await prisma.adminBroadcast.create({
      data: {
        subject,
        body,
        audience,
        audienceName:
          group?.name ??
          (audience === "FILTERED_CAPPERS" && filters
            ? audienceLabel(filters)
            : undefined),
        filters: filters ?? undefined,
        groupId: group?.id,
        sentById: admin.id,
        recipientCount: recipients.length,
        queuedCount: recipients.length,
        scheduledAt: sendAt,
        provider: "BREVO",
        requestKey,
        recipients: {
          create: recipients.map((recipient) => ({
            userId: recipient.userId,
            address: recipient.email.trim().toLowerCase(),
          })),
        },
      },
      select: { id: true },
    });
  } catch (error) {
    if (!isUniqueViolation(error)) throw error;
    // Two concurrent submissions with the same key: the other one won.
    const winner = await prisma.adminBroadcast.findUnique({
      where: { requestKey },
      select: { id: true, recipientCount: true, scheduledAt: true },
    });
    if (!winner) throw error;
    return {
      ok: true,
      broadcastId: winner.id,
      recipientCount: winner.recipientCount,
      scheduledAt: winner.scheduledAt.toISOString(),
    };
  }

  if (sendAt.getTime() <= now.getTime()) {
    afterResponse(async () => {
      try {
        await processBroadcastQueue();
      } catch (error) {
        console.error("[broadcast-queue] immediate run failed", error);
      }
    });
  }

  revalidatePath("/admin/messages");
  return {
    ok: true,
    broadcastId: broadcast.id,
    recipientCount: recipients.length,
    scheduledAt: sendAt > now ? sendAt.toISOString() : null,
  };
}
