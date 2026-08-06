import { NextResponse } from "next/server";

import { emailSenderStatus } from "@/lib/email-sender";
import { getCoreSchemaHealth } from "@/lib/queries/release-readiness";
import {
  supabaseIntegrationStatus,
  supabaseProjectUrl,
  supabaseRefFromKey,
  supabaseRefFromUrl,
  supabaseServiceRoleKey,
} from "@/lib/supabase-config";
import { probeProfileMediaStorage } from "@/lib/supabase-storage";
import { whopIntegrationStatus } from "@/lib/whop-config";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  const health = await getCoreSchemaHealth();
  const storageProbe = await probeProfileMediaStorage();
  const release = process.env.VERCEL_GIT_COMMIT_SHA ?? "local";
  const releaseIdentified =
    process.env.VERCEL_ENV !== "production" || release !== "local";
  const ready = health.ready && releaseIdentified;
  const status = ready ? "ok" : "degraded";
  // Project refs, not keys. A cross-project URL/key pair fails as "bucket not
  // found", which sends you hunting in whichever project you happen to open —
  // naming both refs is the difference between a five-minute fix and a day.
  // A ref is already public in every storage URL the site serves.
  const projectUrl = supabaseProjectUrl();
  const serviceRoleKey = supabaseServiceRoleKey();
  const urlRef = projectUrl ? supabaseRefFromUrl(projectUrl) : null;
  const keyRef = serviceRoleKey ? supabaseRefFromKey(serviceRoleKey) : null;
  const supabase = {
    ...supabaseIntegrationStatus(),
    configured: storageProbe.configured,
    bucketReady: storageProbe.bucketReady,
    storage: storageProbe.configured && storageProbe.bucketReady,
    urlRef,
    // Opaque `sb_secret_…` keys carry no ref: null means "can't tell", never
    // "mismatched".
    keyRef,
    refsAgree: urlRef && keyRef ? urlRef === keyRef : null,
  };

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
      supabase,
      email: emailSenderStatus(),
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
