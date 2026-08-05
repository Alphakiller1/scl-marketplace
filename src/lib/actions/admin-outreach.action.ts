"use server";

import { revalidatePath } from "next/cache";
import type { StoreConnectionStatus, StoreProvider } from "@prisma/client";

import { hasDeliverableEmail } from "@/lib/account-claim";
import { sendCapperOutreachEmail } from "@/lib/email";
import { prisma } from "@/lib/prisma";
import { consumeRateLimit } from "@/lib/rate-limit";
import { adminContactCapperSchema } from "@/lib/schemas/store.schema";
import { requireAdmin } from "@/lib/session";

type ActionResult =
  | { ok: true; delivered: boolean }
  | { ok: false; error: string };

export async function adminContactCapperAction(input: {
  userId: string;
  storeConnectionId?: string;
  subject: string;
  message: string;
}): Promise<ActionResult> {
  const admin = await requireAdmin();
  const parsed = adminContactCapperSchema.safeParse(input);
  if (!parsed.success) {
    return {
      ok: false,
      error: parsed.error.issues[0]?.message || "Invalid message.",
    };
  }

  let rateAllowed = false;
  try {
    rateAllowed = await consumeRateLimit({
      scope: "admin-capper-outreach",
      identity: admin.id,
      limit: 20,
      windowMs: 60 * 60 * 1000,
    });
  } catch (error) {
    console.error("[admin-outreach] rate-limit check failed:", error);
    return {
      ok: false,
      error: "Outreach is temporarily unavailable. Try again shortly.",
    };
  }
  if (!rateAllowed) {
    return {
      ok: false,
      error: "Too many outreach emails sent this hour. Try again later.",
    };
  }

  const target = await prisma.user.findFirst({
    where: { id: parsed.data.userId, role: "CAPPER" },
    select: {
      id: true,
      email: true,
      username: true,
      accountStatus: true,
    },
  });
  if (!target) {
    return { ok: false, error: "Capper account not found." };
  }
  if (target.accountStatus === "DISABLED") {
    return {
      ok: false,
      error: "This account is disabled — reactivate it before contacting.",
    };
  }
  if (!hasDeliverableEmail(target.email)) {
    return {
      ok: false,
      error:
        "This capper has a placeholder email address. Use another channel to reach them.",
    };
  }

  let connection: {
    id: string;
    status: StoreConnectionStatus;
    provider: StoreProvider;
    capper: { userId: string };
  } | null = null;
  if (parsed.data.storeConnectionId) {
    connection = await prisma.storeConnection.findUnique({
      where: { id: parsed.data.storeConnectionId },
      select: {
        id: true,
        status: true,
        provider: true,
        capper: { select: { userId: true } },
      },
    });
    if (!connection || connection.capper.userId !== target.id) {
      return {
        ok: false,
        error: "Store connection not found for this capper.",
      };
    }
  }

  const adminAccount = await prisma.user.findUnique({
    where: { id: admin.id },
    select: { email: true },
  });

  const delivery = await sendCapperOutreachEmail({
    to: target.email,
    subject: parsed.data.subject,
    message: parsed.data.message,
    replyTo: adminAccount?.email ?? null,
    capperUsername: target.username,
  });
  if (!delivery.delivered) {
    return {
      ok: false,
      error:
        "Email could not be delivered. Confirm Resend is configured, then try again.",
    };
  }

  if (connection) {
    await prisma.storefrontReviewEvent.create({
      data: {
        storeConnectionId: connection.id,
        action: "CAPPER_CONTACTED",
        previousStatus: connection.status,
        newStatus: connection.status,
        reviewedById: admin.id,
        reason: `${parsed.data.subject.trim()} — ${parsed.data.message.trim().slice(0, 240)}${parsed.data.message.length > 240 ? "…" : ""}`,
      },
    });
    revalidatePath("/admin/store-setup");
  }
  revalidatePath("/admin/cappers");
  revalidatePath(`/admin/cappers/${target.id}`);

  return { ok: true, delivered: true };
}
