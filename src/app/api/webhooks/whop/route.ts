import { NextRequest, NextResponse } from "next/server";

import { prisma } from "@/lib/prisma";
import { revalidateCommerceSurfaces } from "@/lib/revalidate-commerce";
import { verifyWhopSignature } from "@/lib/whop-webhook";
import { whopWebhookConfigured } from "@/lib/whop-config";
import {
  findWhopConnectionForCompany,
  syncWhopStorefront,
  whopWebhookCompanyId,
  whopWebhookEventName,
  type WhopWebhookEnvelope,
} from "@/lib/whop-sync";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const PRODUCT_SYNC_EVENTS = new Set([
  "product.created",
  "product.updated",
  "product.published",
  "product.unpublished",
]);

async function resolveWebhookActorId(): Promise<string | null> {
  const admin = await prisma.user.findFirst({
    where: { role: "ADMIN", accountStatus: "ACTIVE" },
    select: { id: true },
    orderBy: { createdAt: "asc" },
  });
  return admin?.id ?? null;
}

async function maybeSyncWhopProducts(event: WhopWebhookEnvelope) {
  const eventName = whopWebhookEventName(event);
  if (!eventName || !PRODUCT_SYNC_EVENTS.has(eventName)) return;

  const companyId = whopWebhookCompanyId(event);
  if (!companyId) {
    console.info(`[webhooks/whop] ${eventName} without company id — skip sync`);
    return;
  }

  const connection = await findWhopConnectionForCompany(companyId);
  if (!connection) {
    console.info(
      `[webhooks/whop] ${eventName} for ${companyId} — no linked StoreConnection`,
    );
    return;
  }

  const actorId = await resolveWebhookActorId();
  if (!actorId) {
    console.warn("[webhooks/whop] no admin actor for webhook sync");
    return;
  }

  const result = await syncWhopStorefront({
    storeConnectionId: connection.id,
    actorId,
  });
  if (!result.ok) {
    console.warn(
      `[webhooks/whop] sync failed for ${companyId}: ${result.error}`,
    );
    return;
  }
  console.info(
    `[webhooks/whop] synced ${companyId}: ${result.imported} imported, ${result.updated} updated`,
  );

  const capper = await prisma.storeConnection.findUnique({
    where: { id: connection.id },
    select: {
      capper: { select: { user: { select: { id: true, username: true } } } },
    },
  });
  revalidateCommerceSurfaces({
    username: capper?.capper.user.username,
    capperUserId: capper?.capper.user.id,
  });
}

/**
 * Whop webhook receiver.
 *
 * Verifies signatures, acknowledges quickly, and triggers storefront sync for
 * product lifecycle events when a capper has authorized SCL's Whop API access.
 */
export async function POST(req: NextRequest) {
  const rawBody = await req.text();

  const verified = verifyWhopSignature(
    rawBody,
    req.headers,
    process.env.WHOP_WEBHOOK_SECRET,
  );
  if (!verified.ok) {
    console.warn(`[webhooks/whop] rejected: ${verified.reason}`);
    return NextResponse.json(
      { ok: false, error: verified.reason },
      { status: verified.status },
    );
  }

  let event: WhopWebhookEnvelope = {};
  try {
    event = JSON.parse(rawBody) as WhopWebhookEnvelope;
  } catch {
    return NextResponse.json(
      { ok: false, error: "body is not valid JSON" },
      { status: 400 },
    );
  }

  const eventName = whopWebhookEventName(event);
  console.info(`[webhooks/whop] verified event: ${eventName ?? "(no action)"}`);

  try {
    await maybeSyncWhopProducts(event);
  } catch (error) {
    console.error("[webhooks/whop] product sync handler failed:", error);
  }

  return NextResponse.json({ ok: true, received: eventName ?? null });
}

/**
 * Whop's dashboard pings the endpoint when you save it. Answer 200 so the URL
 * validates, without implying a signed event was accepted.
 */
export async function GET() {
  const configured = whopWebhookConfigured();
  return NextResponse.json({
    ok: true,
    endpoint: "whop-webhook",
    status: configured ? "ready" : "awaiting WHOP_WEBHOOK_SECRET",
    webhookConfigured: configured,
    productSyncEvents: [...PRODUCT_SYNC_EVENTS],
  });
}
