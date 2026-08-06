"use server";

import { revalidatePath } from "next/cache";

import { hasDeliverableEmail } from "@/lib/account-claim";
import { appUrl } from "@/lib/app-url";
import {
  adminNotificationRecipients,
  sendStorefrontMessageNotificationEmail,
} from "@/lib/email";
import { awaitStorefrontMessagesSchema } from "@/lib/ensure-storefront-messages-schema";
import { prisma } from "@/lib/prisma";
import { consumeRateLimit } from "@/lib/rate-limit";
import {
  markStorefrontThreadReadSchema,
  sendStorefrontMessageSchema,
} from "@/lib/schemas/storefront-message.schema";
import { providerLabel } from "@/lib/store-connection";
import { getCurrentAccount, requireAdmin } from "@/lib/session";

type ActionResult = { ok: true } | { ok: false; error: string };

async function assertThreadAccess(storeConnectionId: string, userId: string) {
  const connection = await prisma.storeConnection.findUnique({
    where: { id: storeConnectionId },
    select: {
      id: true,
      provider: true,
      status: true,
      capper: {
        select: {
          userId: true,
          user: {
            select: {
              id: true,
              email: true,
              username: true,
              accountStatus: true,
            },
          },
        },
      },
    },
  });
  if (!connection) return null;

  const admin = await prisma.user.findUnique({
    where: { id: userId },
    select: { role: true, email: true, displayName: true, username: true },
  });
  if (!admin) return null;

  const isAdmin = admin.role === "ADMIN";
  const isOwner = connection.capper.userId === userId;
  if (!isAdmin && !isOwner) return null;

  return { connection, admin, isAdmin, isOwner };
}

export async function sendStorefrontMessageAction(input: {
  storeConnectionId: string;
  body: string;
}): Promise<ActionResult> {
  const account = await getCurrentAccount();
  if (!account) return { ok: false, error: "Sign in to send a message." };

  const parsed = sendStorefrontMessageSchema.safeParse(input);
  if (!parsed.success) {
    return {
      ok: false,
      error: parsed.error.issues[0]?.message || "Invalid message.",
    };
  }

  const access = await assertThreadAccess(
    parsed.data.storeConnectionId,
    account.id,
  );
  if (!access) {
    return { ok: false, error: "This conversation is not available." };
  }
  if (
    !access.isAdmin &&
    access.connection.capper.user.accountStatus === "DISABLED"
  ) {
    return { ok: false, error: "This account cannot send messages." };
  }

  const scope = access.isAdmin
    ? "admin-storefront-message"
    : "capper-storefront-message";
  let rateAllowed = false;
  try {
    rateAllowed = await consumeRateLimit({
      scope,
      identity: account.id,
      limit: access.isAdmin ? 40 : 20,
      windowMs: 60 * 60 * 1000,
    });
  } catch (error) {
    console.error("[storefront-message] rate-limit check failed:", error);
    return {
      ok: false,
      error: "Messaging is temporarily unavailable. Try again shortly.",
    };
  }
  if (!rateAllowed) {
    return {
      ok: false,
      error: "Too many messages sent this hour. Try again later.",
    };
  }

  const senderRole = access.isAdmin ? ("ADMIN" as const) : ("CAPPER" as const);
  const now = new Date();

  await awaitStorefrontMessagesSchema(prisma);

  const message = await prisma.storefrontMessage.create({
    data: {
      storeConnectionId: parsed.data.storeConnectionId,
      senderId: account.id,
      senderRole,
      body: parsed.data.body.trim(),
      readByAdminAt: access.isAdmin ? now : null,
      readByCapperAt: access.isAdmin ? null : now,
    },
  });

  if (!access.isAdmin) {
    await prisma.storeConnection.update({
      where: { id: access.connection.id },
      data: { requiresAttention: true },
    });
  }

  const platform = providerLabel(access.connection.provider);
  const handle =
    access.connection.capper.user.username?.replace(/^@/, "") ?? null;
  const senderLabel =
    access.admin.displayName?.trim() ||
    (access.admin.username
      ? `@${access.admin.username.replace(/^@/, "")}`
      : null) ||
    "SCL Team";

  if (access.isAdmin) {
    const capperEmail = access.connection.capper.user.email;
    if (hasDeliverableEmail(capperEmail)) {
      const delivery = await sendStorefrontMessageNotificationEmail({
        to: capperEmail,
        recipientRole: "CAPPER",
        platform,
        capperUsername: handle,
        preview: parsed.data.body,
        threadUrl: `${appUrl()}/dashboard/monetization?thread=${encodeURIComponent(access.connection.id)}`,
        senderLabel,
      });
      if (delivery.delivered) {
        await prisma.storefrontMessage.update({
          where: { id: message.id },
          data: { emailNotifiedAt: now },
        });
      }
    }
  } else {
    const recipients = adminNotificationRecipients();
    const threadUrl = `${appUrl()}/admin/store-setup?id=${encodeURIComponent(access.connection.id)}`;
    const delivery = await sendStorefrontMessageNotificationEmail({
      to: recipients,
      recipientRole: "ADMIN",
      platform,
      capperUsername: handle,
      preview: parsed.data.body,
      threadUrl,
      senderLabel: handle ? `@${handle}` : access.connection.capper.user.email,
    });
    if (delivery.delivered) {
      await prisma.storefrontMessage.update({
        where: { id: message.id },
        data: { emailNotifiedAt: now },
      });
    }
  }

  revalidatePath("/admin/store-setup");
  revalidatePath("/dashboard/monetization");
  revalidatePath(`/admin/cappers/${access.connection.capper.user.id}`);

  return { ok: true };
}

/**
 * Marks the thread read for whoever is looking at it.
 *
 * Must be invoked from the client once the thread is on screen — never awaited
 * while a page renders. `revalidatePath` throws outright during render ("used
 * revalidatePath during render which is unsupported"), and three server
 * components used to call this at the top of their render, so /admin/store-setup,
 * /admin/cappers/[id], and /dashboard/monetization all hard-failed their error
 * boundary the moment a store connection existed to select.
 *
 * Revalidation is conditional on actually having marked something, so the common
 * case — opening a thread with nothing new in it — costs one indexed UPDATE and
 * no router refresh.
 */
export async function markStorefrontThreadReadAction(input: {
  storeConnectionId: string;
}): Promise<ActionResult> {
  const account = await getCurrentAccount();
  if (!account) return { ok: false, error: "Sign in required." };

  const parsed = markStorefrontThreadReadSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: "Invalid thread." };

  const access = await assertThreadAccess(
    parsed.data.storeConnectionId,
    account.id,
  );
  if (!access) return { ok: false, error: "Thread not found." };

  await awaitStorefrontMessagesSchema(prisma);

  const now = new Date();
  if (access.isAdmin) {
    const { count } = await prisma.storefrontMessage.updateMany({
      where: {
        storeConnectionId: parsed.data.storeConnectionId,
        senderRole: "CAPPER",
        readByAdminAt: null,
      },
      data: { readByAdminAt: now },
    });
    if (count > 0) revalidatePath("/admin/store-setup");
  } else {
    const { count } = await prisma.storefrontMessage.updateMany({
      where: {
        storeConnectionId: parsed.data.storeConnectionId,
        senderRole: "ADMIN",
        readByCapperAt: null,
      },
      data: { readByCapperAt: now },
    });
    if (count > 0) revalidatePath("/dashboard/monetization");
  }

  return { ok: true };
}

/** Admin-only bulk read for capper detail pages without a selected connection. */
export async function markAllCapperThreadsReadAction(input: {
  userId: string;
}): Promise<ActionResult> {
  await requireAdmin();
  const profile = await prisma.capperProfile.findUnique({
    where: { userId: input.userId },
    select: { id: true },
  });
  if (!profile) return { ok: false, error: "Capper not found." };

  await awaitStorefrontMessagesSchema(prisma);

  await prisma.storefrontMessage.updateMany({
    where: {
      senderRole: "CAPPER",
      readByAdminAt: null,
      storeConnection: { capperId: profile.id },
    },
    data: { readByAdminAt: new Date() },
  });
  revalidatePath("/admin/store-setup");
  revalidatePath(`/admin/cappers/${input.userId}`);
  return { ok: true };
}
