import { NextResponse } from "next/server";

import { probeMailer } from "@/lib/email-deliverability";
import { emailSenderStatus } from "@/lib/email-sender";
import { emailVerificationEnforced } from "@/lib/email-verification-policy";
import { probeOddsProvider } from "@/lib/odds-provider-health";
import { databasePoolConfiguration } from "@/lib/prisma-url";
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
import { whopOAuthRedirectUri } from "@/lib/whop-oauth-redirect";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  const [health, storageProbe, mailer, odds] = await Promise.all([
    getCoreSchemaHealth(),
    probeProfileMediaStorage(),
    probeMailer(),
    probeOddsProvider(),
  ]);
  const release = process.env.VERCEL_GIT_COMMIT_SHA ?? "local";
  const releaseIdentified =
    process.env.VERCEL_ENV !== "production" || release !== "local";
  const ready =
    health.ready && odds.configured && odds.reachable && releaseIdentified;
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
      databasePool: databasePoolConfiguration(process.env.DATABASE_URL),
      schema: {
        packageAttribution: health.playPackage && health.parlayPackage,
        eventLabels: health.eventLabel,
        policyAcceptance: health.policyAcceptance,
        refundPolicy: health.refundPolicy,
      },
      deployment: { releaseIdentified },
      supabase,
      email: {
        ...emailSenderStatus(),
        // Asked of the provider, not of the environment. `configured` only ever
        // meant "EMAIL_FROM is set", which stayed true through a total outage.
        deliverable: mailer.deliverable,
        domainStatus: mailer.domainStatus,
        blockedBy: mailer.reason,
        // Whether an unverified email actually keeps anyone out. Signup never
        // writes `emailVerified`, so this is the only thing that gates access.
        verificationEnforced: emailVerificationEnforced(),
      },
      odds,
      whop: {
        ...whopIntegrationStatus(),
        redirectUri: whopOAuthRedirectUri(),
      },
      release,
      checkedAt: new Date().toISOString(),
    },
    {
      status: ready ? 200 : 503,
      headers: { "Cache-Control": "no-store" },
    },
  );
}
