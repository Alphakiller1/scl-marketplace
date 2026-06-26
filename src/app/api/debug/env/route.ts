import { NextResponse } from "next/server";

import { prisma } from "@/lib/prisma";

// TEMPORARY diagnostic — no secret values. Tests the DB query path used by
// auth. Remove after debugging.
export const dynamic = "force-dynamic";

export async function GET() {
  const dbUrl = process.env.DATABASE_URL ?? "";
  let dbTest = "ok";
  let dbError: string | null = null;
  let userCount: number | null = null;
  try {
    userCount = await prisma.user.count();
  } catch (e) {
    dbTest = "error";
    dbError = String(e instanceof Error ? e.message : e).slice(0, 400);
  }
  return NextResponse.json({
    authUrl: process.env.AUTH_URL ?? null,
    hasAuthSecret: Boolean(process.env.AUTH_SECRET),
    dbPort: (dbUrl.match(/:(\d+)\//) ?? [])[1] ?? null,
    dbHasPgbouncer: dbUrl.includes("pgbouncer=true"),
    dbHasSchemaScl: dbUrl.includes("schema=scl"),
    dbTest,
    userCount,
    dbError,
  });
}
