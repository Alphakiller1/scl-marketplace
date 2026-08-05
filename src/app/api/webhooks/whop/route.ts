import { NextRequest, NextResponse } from "next/server";

import { verifyWhopSignature } from "@/lib/whop-webhook";
import { whopWebhookConfigured } from "@/lib/whop-config";

export const runtime = "nodejs";
// Signature verification needs the byte-exact body, so this must never be
// statically evaluated or cached.
export const dynamic = "force-dynamic";

/**
 * Whop webhook receiver.
 *
 * Scope today: authenticate the delivery and acknowledge it. Turning events
 * into Package rows lands with the products sync, once the App API key exists —
 * until then there is nothing to sync against.
 *
 * Acknowledging early and processing later is the shape this wants anyway:
 * Whop retries on non-2xx, so slow work inside the handler causes duplicate
 * deliveries.
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

  let event: { action?: string; data?: unknown } = {};
  try {
    event = JSON.parse(rawBody) as typeof event;
  } catch {
    return NextResponse.json(
      { ok: false, error: "body is not valid JSON" },
      { status: 400 },
    );
  }

  console.info(
    `[webhooks/whop] verified event: ${event.action ?? "(no action)"}`,
  );

  // 200 so Whop marks the delivery successful and stops retrying. Event
  // handling is deliberately not implemented yet.
  return NextResponse.json({ ok: true, received: event.action ?? null });
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
  });
}
