import { NextRequest, NextResponse } from "next/server";

import { runEmailAutomations } from "@/lib/email-automation-runner";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 300;

function authorized(request: NextRequest): boolean {
  const secret = process.env.CRON_SECRET?.trim();
  const authorization = request.headers.get("authorization");
  return Boolean(
    secret &&
    (authorization === secret || authorization === `Bearer ${secret}`),
  );
}

export async function GET(request: NextRequest) {
  if (!authorized(request)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const result = await runEmailAutomations();
    return NextResponse.json(result, { status: result.ok ? 200 : 503 });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Run failed";
    console.error("[cron/email-automations] failed", error);
    return NextResponse.json({ ok: false, error: message }, { status: 500 });
  }
}
