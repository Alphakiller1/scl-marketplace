"use server";

import { revalidatePath } from "next/cache";

import { prisma } from "@/lib/prisma";
import { requireAdmin } from "@/lib/session";
import { afterResponse } from "@/lib/after-response";
import { appUrl } from "@/lib/app-url";
import { renderBroadcastHtml, sendBroadcastBatch } from "@/lib/email";
import { mailerConfigured } from "@/lib/email-verification-policy";
import {
  BROADCAST_MAX_RECIPIENTS,
  chunkRecipients,
  resolveBroadcastRecipients,
  signUnsubscribeToken,
  type BroadcastCandidate,
} from "@/lib/broadcast";
import {
  broadcastSchema,
  type BroadcastInput,
} from "@/lib/schemas/broadcast.schema";

type BroadcastResult =
  | { ok: true; broadcastId: string; recipientCount: number }
  | { ok: false; error: string };

const CANDIDATE_SELECT = {
  id: true,
  email: true,
  username: true,
  emailVerified: true,
  accountStatus: true,
  isTest: true,
  marketingOptOut: true,
} as const;

/** Preview the audience before committing to a send. */
export async function previewBroadcastAudienceAction(input: {
  audience: BroadcastInput["audience"];
  userId?: string;
}): Promise<{ ok: true; count: number } | { ok: false; error: string }> {
  await requireAdmin();
  if (input.audience === "SINGLE_CAPPER" && !input.userId) {
    return { ok: false, error: "Choose which capper to message." };
  }
  try {
    const recipients = await loadRecipients(input.audience, input.userId);
    return { ok: true, count: recipients.length };
  } catch {
    return { ok: false, error: "Couldn't work out who that would reach." };
  }
}

async function loadRecipients(
  audience: BroadcastInput["audience"],
  userId?: string,
) {
  const candidates: BroadcastCandidate[] = await prisma.user.findMany({
    where:
      audience === "SINGLE_CAPPER"
        ? { id: userId, role: "CAPPER" }
        : { role: "CAPPER" },
    select: CANDIDATE_SELECT,
    orderBy: { createdAt: "asc" },
  });
  return resolveBroadcastRecipients(audience, candidates);
}

/**
 * Send an admin broadcast.
 *
 * The send itself runs in `afterResponse`: mailing the roster takes several
 * provider round trips, and holding the admin's request open for them would
 * risk the invocation timing out mid-send with half the roster mailed and no
 * record of which half. The audit rows are written FIRST, inside the request, so
 * the record exists even if delivery later fails — a broadcast that was
 * attempted is a fact worth keeping whatever the provider does with it.
 */
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
  const { audience, userId, subject, body, confirmRecipientCount } =
    parsed.data;

  if (!mailerConfigured()) {
    return {
      ok: false,
      error:
        "Email delivery is not configured. Check Resend before sending this message.",
    };
  }

  const recipients = await loadRecipients(audience, userId);
  if (recipients.length === 0) {
    return { ok: false, error: "That audience has nobody in it." };
  }
  if (recipients.length > BROADCAST_MAX_RECIPIENTS) {
    return {
      ok: false,
      error: `That would reach ${recipients.length} people, above the ${BROADCAST_MAX_RECIPIENTS} cap.`,
    };
  }
  // A mass mail cannot be recalled. The count the admin confirmed must still be
  // the count being sent — if the roster changed between preview and submit,
  // stop and show the new number rather than mailing more people than they saw.
  if (
    audience !== "SINGLE_CAPPER" &&
    confirmRecipientCount !== recipients.length
  ) {
    return {
      ok: false,
      error: `The audience changed to ${recipients.length} recipients. Review and confirm again.`,
    };
  }

  const broadcast = await prisma.adminBroadcast.create({
    data: {
      subject,
      body,
      audience,
      sentById: admin.id,
      recipientCount: recipients.length,
      recipients: {
        create: recipients.map((r) => ({
          userId: r.userId,
          address: r.email,
        })),
      },
    },
    select: { id: true },
  });

  const secret = process.env.AUTH_SECRET ?? "";
  const isMass = audience !== "SINGLE_CAPPER";

  afterResponse(async () => {
    let delivered = 0;
    let failed = 0;

    for (const batch of chunkRecipients(recipients)) {
      const results = await sendBroadcastBatch(
        batch.map((r) => ({
          to: r.email,
          username: r.username,
          subject,
          html: renderBroadcastHtml({
            body,
            unsubscribeUrl:
              isMass && secret
                ? `${appUrl()}/unsubscribe?token=${signUnsubscribeToken(r.userId, secret)}`
                : undefined,
          }),
        })),
      );

      for (const result of results) {
        if (result.delivered) delivered += 1;
        else failed += 1;
        await prisma.adminBroadcastRecipient.updateMany({
          where: { broadcastId: broadcast.id, address: result.address },
          data: { delivered: result.delivered, error: result.error ?? null },
        });
      }
    }

    await prisma.adminBroadcast.update({
      where: { id: broadcast.id },
      data: {
        deliveredCount: delivered,
        failedCount: failed,
        completedAt: new Date(),
      },
    });
  });

  revalidatePath("/admin/messages");
  return {
    ok: true,
    broadcastId: broadcast.id,
    recipientCount: recipients.length,
  };
}

/** Honour an unsubscribe link. Never throws — the page reports the outcome. */
export async function applyUnsubscribeAction(userId: string): Promise<boolean> {
  try {
    await prisma.user.update({
      where: { id: userId },
      data: { marketingOptOut: true },
    });
    return true;
  } catch {
    return false;
  }
}
