import { NextRequest, NextResponse } from "next/server";
import { runStrategicOddsRefresh } from "@/lib/strategic-odds-refresh";

export const maxDuration = 300;

export async function GET(req: NextRequest) {
  const secret = process.env.CRON_SECRET?.trim();
  if (!secret || req.headers.get("authorization") !== secret) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const result = await runStrategicOddsRefresh();
  const ok = result.verificationFailures.length === 0;
  return NextResponse.json({ ok, ...result }, { status: ok ? 200 : 503 });
}
