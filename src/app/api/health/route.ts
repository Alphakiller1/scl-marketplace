import { NextResponse } from "next/server";

import { getCoreSchemaHealth } from "@/lib/queries/release-readiness";
import { supabaseIntegrationStatus } from "@/lib/supabase-config";
import { whopIntegrationStatus } from "@/lib/whop-config";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  const health = await getCoreSchemaHealth();
  const release = process.env.VERCEL_GIT_COMMIT_SHA ?? "local";
  const releaseIdentified =
    process.env.VERCEL_ENV !== "production" || release !== "local";
  const ready = health.ready && releaseIdentified;
  const status = ready ? "ok" : "degraded";

  return NextResponse.json(
    {
      status,
      database: health.database ? "reachable" : "unavailable",
      schema: {
        packageAttribution: health.playPackage && health.parlayPackage,
        eventLabels: health.eventLabel,
        policyAcceptance: health.policyAcceptance,
        refundPolicy: health.refundPolicy,
      },
      deployment: { releaseIdentified },
      supabase: supabaseIntegrationStatus(),
      whop: whopIntegrationStatus(),
      release,
      checkedAt: new Date().toISOString(),
    },
    {
      status: ready ? 200 : 503,
      headers: { "Cache-Control": "no-store" },
    },
  );
}
