import { NextResponse } from "next/server";

import { getCoreSchemaHealth } from "@/lib/queries/release-readiness";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  const health = await getCoreSchemaHealth();
  const status = health.ready ? "ok" : "degraded";

  return NextResponse.json(
    {
      status,
      database: health.database ? "reachable" : "unavailable",
      schema: {
        packageAttribution: health.playPackage && health.parlayPackage,
        eventLabels: health.eventLabel,
      },
      release: process.env.VERCEL_GIT_COMMIT_SHA ?? "local",
      checkedAt: new Date().toISOString(),
    },
    {
      status: health.ready ? 200 : 503,
      headers: { "Cache-Control": "no-store" },
    },
  );
}
