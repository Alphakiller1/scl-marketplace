"use server";

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
import { processBroadcastQueue } from "@/lib/broadcast-queue";
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
  | { ok: true; broadcastId: string; recipientCount: number }
  | { ok: false; error: string };

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
        orderBy: { createdAt: "asc" },
      }),
      listCampaignSuppressedAddresses(),
    ]);
  const exclusions = audienceFiltersSchema.safeParse(input.filters ?? {});
  const excludedIds = new Set(
    exclusions.success ? exclusions.data.excludeUserIds : [],
  );
  const recipients = resolveBroadcastRecipients(
    input.audience,
    candidates,
  ).filter(
    (recipient) =>
      !excludedIds.has(recipient.userId) &&
      !suppressedAddresses.has(recipient.email.trim().toLowerCase()),
  );
  return {
    recipients,
    filters: null,
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
  | { ok: true; count: number; members: PreviewMember[] }
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
  return { ok: true as const };
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
    scheduledAt,
    groupId,
  } = parsed.data;

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
    confirmRecipientCount !== recipients.length
  ) {
    return {
      ok: false,
      error: `The audience changed to ${recipients.length} recipients. Review and confirm again.`,
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

  const now = new Date();
  const sendAt = scheduledAt && scheduledAt > now ? scheduledAt : now;
  const broadcast = await prisma.adminBroadcast.create({
    data: {
      subject,
      body,
      audience,
      audienceName:
        group?.name ?? (filters ? audienceLabel(filters) : undefined),
      filters: filters ?? undefined,
      groupId: group?.id,
      sentById: admin.id,
      recipientCount: recipients.length,
      scheduledAt: sendAt,
      recipients: {
        create: recipients.map((recipient) => ({
          userId: recipient.userId,
          address: recipient.email.trim().toLowerCase(),
        })),
      },
    },
    select: { id: true },
  });

  if (sendAt.getTime() <= now.getTime() + 60_000) {
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
  };
}

export async function applyUnsubscribeAction(userId: string): Promise<boolean> {
  try {
    await prisma.$transaction([
      prisma.user.update({
        where: { id: userId },
        data: { marketingOptOut: true },
      }),
      prisma.adminBroadcastRecipient.updateMany({
        where: { userId, status: "QUEUED" },
        data: { status: "UNSUBSCRIBED", unsubscribedAt: new Date() },
      }),
    ]);
    return true;
  } catch {
    return false;
  }
}
