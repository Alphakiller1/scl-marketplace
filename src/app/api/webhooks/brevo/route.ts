import { timingSafeEqual } from "crypto";
import { NextResponse } from "next/server";

import { applyBrevoWebhookEvent } from "@/lib/broadcast-queue";

export const runtime = "nodejs";

/** Brevo batches at most a few hundred events; anything bigger is not Brevo. */
const MAX_EVENTS = 1_000;

function safeEqual(left: string, right: string): boolean {
  const a = Buffer.from(left);
  const b = Buffer.from(right);
  return a.length === b.length && timingSafeEqual(a, b);
}

/**
 * The shared secret, from (in order of preference) a custom header, a bearer
 * token, HTTP basic auth (any username), or the legacy `?token=` query value.
 * Headers keep the secret out of request logs; the query form is kept only so
 * an existing webhook URL does not silently stop working.
 */
function providedSecret(request: Request): string {
  const header = request.headers.get("x-scl-brevo-secret");
  if (header) return header;
  const authorization = request.headers.get("authorization") ?? "";
  if (authorization.startsWith("Bearer ")) {
    return authorization.slice("Bearer ".length);
  }
  if (authorization.startsWith("Basic ")) {
    const decoded = Buffer.from(
      authorization.slice("Basic ".length),
      "base64",
    ).toString("utf8");
    const colon = decoded.indexOf(":");
    return colon >= 0 ? decoded.slice(colon + 1) : decoded;
  }
  return new URL(request.url).searchParams.get("token") ?? "";
}

export async function POST(request: Request) {
  const expected = process.env.BREVO_WEBHOOK_SECRET?.trim();
  if (!expected) {
    return NextResponse.json(
      { error: "Webhook not configured" },
      { status: 503 },
    );
  }
  if (!safeEqual(providedSecret(request), expected)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  let payload: unknown;
  try {
    payload = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  // Brevo sends one event per request, or an array when batching is enabled.
  const events = Array.isArray(payload) ? payload : [payload];
  if (events.length > MAX_EVENTS) {
    return NextResponse.json({ error: "Too many events" }, { status: 413 });
  }
  let handled = 0;
  for (const event of events) {
    if (await applyBrevoWebhookEvent(event)) handled += 1;
  }
  return NextResponse.json({ received: events.length, handled });
}
