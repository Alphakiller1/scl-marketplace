import { NextResponse } from "next/server";

// TEMPORARY diagnostic endpoint — reports env-var PRESENCE only (no secret
// values). Remove after debugging the Vercel auth 400.
export const dynamic = "force-dynamic";

export function GET() {
  const dbUrl = process.env.DATABASE_URL ?? "";
  const dbHost = dbUrl.replace(/^[^@]*@/, "").replace(/\/.*$/, "");
  return NextResponse.json({
    nodeEnv: process.env.NODE_ENV ?? null,
    vercel: process.env.VERCEL ?? null,
    vercelEnv: process.env.VERCEL_ENV ?? null,
    vercelUrl: process.env.VERCEL_URL ?? null,
    hasAuthSecret: Boolean(process.env.AUTH_SECRET),
    authSecretLen: (process.env.AUTH_SECRET ?? "").length,
    authTrustHost: process.env.AUTH_TRUST_HOST ?? null,
    authUrl: process.env.AUTH_URL ?? null,
    nextauthUrl: process.env.NEXTAUTH_URL ?? null,
    dbHost,
    dbHasPooler: dbUrl.includes("pooler"),
    hasDirectUrl: Boolean(process.env.DIRECT_URL),
  });
}
