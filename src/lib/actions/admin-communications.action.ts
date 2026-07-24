"use server";

import { revalidatePath } from "next/cache";

import {
  isCapperAudience,
  isCustomerAudience,
  resolveBulkEmailRecipients,
} from "@/lib/bulk-email";
import { sendCapperBroadcastEmail } from "@/lib/email";
import { prisma } from "@/lib/prisma";
import {
  bulkEmailSchema,
  type BulkEmailInput,
} from "@/lib/schemas/admin-communications.schema";
import { requireAdmin } from "@/lib/session";

type ActionResult =
  | { ok: true; delivered: number; failed: number; recipients: number }
  | { ok: false; error: string };

export async function sendBulkEmailAction(
  input: BulkEmailInput,
): Promise<ActionResult> {
  const admin = await requireAdmin();
  const parsed = bulkEmailSchema.safeParse(input);
  if (!parsed.success) {
    return {
      ok: false,
      error: parsed.error.issues[0]?.message ?? "Check the email fields.",
    };
  }

  const { recipientKind, audience } = parsed.data;
  if (
    (recipientKind === "CAPPER" && !isCapperAudience(audience)) ||
    (recipientKind === "CUSTOMER" && !isCustomerAudience(audience))
  ) {
    return {
      ok: false,
      error: "That audience does not match the recipient type.",
    };
  }

  const recipients = await resolveBulkEmailRecipients(audience, recipientKind);
  if (!recipients.length) {
    return { ok: false, error: "No recipients matched that audience." };
  }

  const result = await sendCapperBroadcastEmail(
    recipients,
    parsed.data.subject,
    parsed.data.bodyHtml,
  );

  await prisma.bulkEmailCampaign.create({
    data: {
      subject: parsed.data.subject,
      bodyHtml: parsed.data.bodyHtml,
      recipientKind,
      audience,
      recipientCount: recipients.length,
      deliveredCount: result.delivered,
      failedCount: result.failed,
      sentById: admin.id,
    },
  });

  revalidatePath("/admin/communications");
  return {
    ok: true,
    delivered: result.delivered,
    failed: result.failed,
    recipients: recipients.length,
  };
}

export async function sendBulkCapperEmailAction(
  input: Omit<BulkEmailInput, "recipientKind">,
): Promise<ActionResult> {
  return sendBulkEmailAction({ ...input, recipientKind: "CAPPER" });
}

export async function sendBulkCustomerEmailAction(
  input: Omit<BulkEmailInput, "recipientKind">,
): Promise<ActionResult> {
  return sendBulkEmailAction({ ...input, recipientKind: "CUSTOMER" });
}
