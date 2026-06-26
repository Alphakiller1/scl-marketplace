import { NextResponse } from "next/server";

// TEMPORARY diagnostic — env-var presence only (no secret values). Remove after.
export const dynamic = "force-dynamic";

export function GET() {
  return NextResponse.json({
    vercelEnv: process.env.VERCEL_ENV ?? null,
    authUrl: process.env.AUTH_URL ?? null,
    authTrustHost: process.env.AUTH_TRUST_HOST ?? null,
    hasAuthSecret: Boolean(process.env.AUTH_SECRET),
  });
}
