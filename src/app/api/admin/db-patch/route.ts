import { NextRequest, NextResponse } from "next/server";

import { prisma } from "@/lib/prisma";

export const runtime = "nodejs";
export const maxDuration = 60;

/**
 * One-shot, idempotent prod schema patch for migration
 * 20260728033616_add_storeconnection_workflow.
 *
 * The StoreConnection workflow columns + OddsUsageDaily never landed on prod
 * (it was patched column-by-column), which hard-crashes the ghost seed
 * ("column packageCount does not exist") and the Winible store-connection
 * review workflow. GitHub runners can't reach the Supabase DB (direct host is
 * IPv6-only), so we apply the DDL from Vercel — which reaches it fine — behind
 * the same CRON_SECRET the seed + grade crons use.
 *
 * Every statement is IF NOT EXISTS, so this is safe to re-run.
 */
const STATEMENTS: string[] = [
  `ALTER TABLE scl."StoreConnection" ADD COLUMN IF NOT EXISTS "affiliateAcceptedAt" TIMESTAMP(3)`,
  `ALTER TABLE scl."StoreConnection" ADD COLUMN IF NOT EXISTS "affiliatePercent" DOUBLE PRECISION`,
  `ALTER TABLE scl."StoreConnection" ADD COLUMN IF NOT EXISTS "lastImportedAt" TIMESTAMP(3)`,
  `ALTER TABLE scl."StoreConnection" ADD COLUMN IF NOT EXISTS "packageCount" INTEGER NOT NULL DEFAULT 0`,
  `ALTER TABLE scl."StoreConnection" ADD COLUMN IF NOT EXISTS "requiresAttention" BOOLEAN NOT NULL DEFAULT false`,
  `CREATE INDEX IF NOT EXISTS "StoreConnection_requiresAttention_idx" ON scl."StoreConnection"("requiresAttention")`,
  `CREATE TABLE IF NOT EXISTS scl."OddsUsageDaily" (
     "id" TEXT NOT NULL,
     "date" DATE NOT NULL,
     "purpose" TEXT NOT NULL,
     "sport" TEXT NOT NULL DEFAULT '',
     "calls" INTEGER NOT NULL DEFAULT 0,
     "credits" INTEGER NOT NULL DEFAULT 0,
     "remaining" INTEGER,
     "updatedAt" TIMESTAMP(3) NOT NULL,
     CONSTRAINT "OddsUsageDaily_pkey" PRIMARY KEY ("id")
   )`,
  `CREATE INDEX IF NOT EXISTS "OddsUsageDaily_date_idx" ON scl."OddsUsageDaily"("date")`,
  `CREATE UNIQUE INDEX IF NOT EXISTS "OddsUsageDaily_date_purpose_sport_key" ON scl."OddsUsageDaily"("date", "purpose", "sport")`,
  `ALTER TABLE scl."User" DROP CONSTRAINT IF EXISTS "User_email_key"`,
  `DROP INDEX IF EXISTS scl."User_email_key"`,
  `DROP INDEX IF EXISTS "User_email_key"`,
  `CREATE UNIQUE INDEX IF NOT EXISTS "User_email_username_key" ON scl."User"("email", "username")`,
];

function authorize(req: NextRequest): boolean {
  const secret = process.env.CRON_SECRET?.trim();
  if (secret) {
    return req.headers.get("authorization") === `Bearer ${secret}`;
  }
  if (req.headers.get("x-vercel-cron") === "1") return true;
  return false;
}

export async function POST(req: NextRequest) {
  if (!authorize(req)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const applied: string[] = [];
  const failed: { statement: string; error: string }[] = [];
  for (const sql of STATEMENTS) {
    const label = sql.replace(/\s+/g, " ").trim().slice(0, 72);
    try {
      await prisma.$executeRawUnsafe(sql);
      applied.push(label);
    } catch (error) {
      failed.push({
        statement: label,
        error: error instanceof Error ? error.message : String(error),
      });
    }
  }

  // Prove the StoreConnection workflow columns now exist.
  const cols = await prisma.$queryRawUnsafe<{ column_name: string }[]>(
    `SELECT column_name FROM information_schema.columns
     WHERE table_schema = 'scl' AND table_name = 'StoreConnection'
       AND column_name IN ('affiliateAcceptedAt','affiliatePercent','lastImportedAt','packageCount','requiresAttention')
     ORDER BY column_name`,
  );

  const storeConnectionColumns = cols.map((c) => c.column_name);
  const emailIndex = await prisma.$queryRawUnsafe<{ indexname: string }[]>(
    `SELECT indexname FROM pg_indexes
     WHERE schemaname = 'scl' AND tablename = 'User'
       AND indexname IN ('User_email_key', 'User_email_username_key')
     ORDER BY indexname`,
  );
  const userEmailIndexes = emailIndex.map((row) => row.indexname);
  const ok =
    failed.length === 0 &&
    storeConnectionColumns.length === 5 &&
    userEmailIndexes.includes("User_email_username_key") &&
    !userEmailIndexes.includes("User_email_key");
  return NextResponse.json(
    { ok, applied, failed, storeConnectionColumns, userEmailIndexes },
    { status: ok ? 200 : 500 },
  );
}
