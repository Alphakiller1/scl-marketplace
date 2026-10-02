import { timingSafeEqual } from "crypto";
import { NextResponse } from "next/server";

import { applyBrevoWebhookEvent } from "@/lib/broadcast-queue";

export const runtime = "nodejs";

function safeEqual(left: string, right: string): boolean {
  const a = Buffer.from(left);
  const b = Buffer.from(right);
  return a.length === b.length && timingSafeEqual(a, b);
}

export async function POST(request: Request) {
  const expected = process.env.BREVO_WEBHOOK_SECRET?.trim();
  if (!expected) {
    return NextResponse.json(
      { error: "Webhook not configured" },
      { status: 503 },
    );
  }
  const url = new URL(request.url);
  const provided =
    request.headers.get("x-scl-brevo-secret") ??
    url.searchParams.get("token") ??
    "";
  if (!safeEqual(provided, expected)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const handled = await applyBrevoWebhookEvent(await request.json());
  return NextResponse.json({ received: true, handled });
}
