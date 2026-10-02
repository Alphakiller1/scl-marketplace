import { NextResponse } from "next/server";

import { processBroadcastQueue } from "@/lib/broadcast-queue";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 300;

export async function GET(request: Request) {
  const secret = process.env.CRON_SECRET?.trim();
  const authorization = request.headers.get("authorization");
  // Vercel Cron sends exactly `Bearer <CRON_SECRET>`.
  if (!secret || authorization !== `Bearer ${secret}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const result = await processBroadcastQueue();
    return NextResponse.json({ ok: true, ...result });
  } catch (error) {
    console.error("[cron/broadcast-queue] failed", error);
    return NextResponse.json(
      { ok: false, error: "Campaign queue failed" },
      { status: 500 },
    );
  }
}
