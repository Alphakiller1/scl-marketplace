import { revalidateTag } from "next/cache";
import { NextRequest, NextResponse } from "next/server";

import {
  EXTREME_STAKE_UNITS,
  normalizeExtremeStake,
} from "@/lib/extreme-stake";
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
 * It also repairs the legacy-record invariant discovered in production: a
 * push-only aggregate cannot carry nonzero net units. The accompanying CHECK
 * constraint makes that repair permanent. Sentinel stakes (≥100u, e.g. the
 * Primos 999u ticket) are collapsed to the 5u prediction max. Every statement
 * is idempotent, so this endpoint is safe to re-run.
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

  // --- 20260805240000_storefront_capper_contacted ---------------------------
  // Schema-qualified: the migration file names the type bare, which only
  // resolves while search_path happens to include `scl`.
  `ALTER TYPE scl."StorefrontReviewAction" ADD VALUE IF NOT EXISTS 'CAPPER_CONTACTED'`,

  // --- 20260805250000_storefront_messages -----------------------------------
  `DO $$ BEGIN
     CREATE TYPE scl."StorefrontMessageSender" AS ENUM ('ADMIN', 'CAPPER');
   EXCEPTION WHEN duplicate_object THEN NULL;
   END $$`,
  `CREATE TABLE IF NOT EXISTS scl."StorefrontMessage" (
     "id" TEXT NOT NULL,
     "storeConnectionId" TEXT NOT NULL,
     "senderId" TEXT NOT NULL,
     "senderRole" scl."StorefrontMessageSender" NOT NULL,
     "body" TEXT NOT NULL,
     "readByAdminAt" TIMESTAMP(3),
     "readByCapperAt" TIMESTAMP(3),
     "emailNotifiedAt" TIMESTAMP(3),
     "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
     CONSTRAINT "StorefrontMessage_pkey" PRIMARY KEY ("id")
   )`,
  `CREATE INDEX IF NOT EXISTS "StorefrontMessage_storeConnectionId_createdAt_idx" ON scl."StorefrontMessage"("storeConnectionId", "createdAt")`,
  `CREATE INDEX IF NOT EXISTS "StorefrontMessage_storeConnectionId_readByAdminAt_idx" ON scl."StorefrontMessage"("storeConnectionId", "readByAdminAt")`,
  `CREATE INDEX IF NOT EXISTS "StorefrontMessage_storeConnectionId_readByCapperAt_idx" ON scl."StorefrontMessage"("storeConnectionId", "readByCapperAt")`,
  `DO $$ BEGIN
     ALTER TABLE scl."StorefrontMessage"
       ADD CONSTRAINT "StorefrontMessage_storeConnectionId_fkey"
       FOREIGN KEY ("storeConnectionId") REFERENCES scl."StoreConnection"("id")
       ON DELETE CASCADE ON UPDATE CASCADE;
   EXCEPTION WHEN duplicate_object THEN NULL;
   END $$`,
  `DO $$ BEGIN
     ALTER TABLE scl."StorefrontMessage"
       ADD CONSTRAINT "StorefrontMessage_senderId_fkey"
       FOREIGN KEY ("senderId") REFERENCES scl."User"("id")
       ON DELETE RESTRICT ON UPDATE CASCADE;
   EXCEPTION WHEN duplicate_object THEN NULL;
   END $$`,

  // --- 20260806000000_legacy_scope_2024_postseason ---------------------------
  `ALTER TYPE scl."LegacyRecordScope" ADD VALUE IF NOT EXISTS 'YEAR_2024'`,
  `ALTER TYPE scl."LegacyRecordScope" ADD VALUE IF NOT EXISTS 'SEASON_2024'`,
  `ALTER TYPE scl."LegacyRecordScope" ADD VALUE IF NOT EXISTS 'POSTSEASON'`,

  // --- legacy record decision/unit invariant -------------------------------
  `UPDATE scl."LegacyRecord"
     SET "unitsNet" = 0
     WHERE ("wins" + "losses") = 0 AND "unitsNet" <> 0`,
  `DO $$ BEGIN
     IF NOT EXISTS (
       SELECT 1 FROM pg_constraint
       WHERE conname = 'LegacyRecord_zero_decision_units_check'
         AND conrelid = 'scl."LegacyRecord"'::regclass
     ) THEN
       ALTER TABLE scl."LegacyRecord"
         ADD CONSTRAINT "LegacyRecord_zero_decision_units_check"
         CHECK (("wins" + "losses") > 0 OR "unitsNet" = 0);
     END IF;
   END $$`,

  // --- unblock the migration chain ------------------------------------------
  // A migration row with no `finished_at` and no `rolled_back_at` is Prisma's
  // "failed" state: `migrate deploy` refuses to apply ANY later migration while
  // one exists (P3009). That is why the three migrations above never landed
  // even though deploys kept reporting success. Deleting the row — rather than
  // inserting a completed one — lets Prisma re-run the migration and record its
  // own checksum; every statement in those files is IF EXISTS / IF NOT EXISTS,
  // so re-running is a no-op against the DDL this endpoint just applied.
  `DELETE FROM scl._prisma_migrations
     WHERE finished_at IS NULL AND rolled_back_at IS NULL`,
];

function authorize(req: NextRequest): boolean {
  const secret = process.env.CRON_SECRET?.trim();
  return Boolean(
    secret && req.headers.get("authorization") === `Bearer ${secret}`,
  );
}

export async function POST(req: NextRequest) {
  if (!authorize(req)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const legacyBefore = await prisma.$queryRawUnsafe<
    { rows: number; profiles: number }[]
  >(
    `SELECT COUNT(*)::int AS rows,
            COUNT(DISTINCT "capperId")::int AS profiles
       FROM scl."LegacyRecord"
      WHERE ("wins" + "losses") = 0 AND "unitsNet" <> 0`,
  );

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

  // Prove the chain is actually unblocked, not just that the DDL ran.
  const blocked = await prisma.$queryRawUnsafe<{ migration_name: string }[]>(
    `SELECT migration_name FROM scl._prisma_migrations
     WHERE finished_at IS NULL AND rolled_back_at IS NULL
     ORDER BY started_at`,
  );
  const blockedMigrations = blocked.map((row) => row.migration_name);

  const tables = await prisma.$queryRawUnsafe<{ present: boolean }[]>(
    `SELECT to_regclass('scl."StorefrontMessage"') IS NOT NULL AS present`,
  );
  const storefrontMessagesTable = tables[0]?.present === true;

  const legacyAfter = await prisma.$queryRawUnsafe<{ rows: number }[]>(
    `SELECT COUNT(*)::int AS rows
       FROM scl."LegacyRecord"
      WHERE ("wins" + "losses") = 0 AND "unitsNet" <> 0`,
  );
  const legacyConstraint = await prisma.$queryRawUnsafe<{ present: boolean }[]>(
    `SELECT EXISTS (
       SELECT 1 FROM pg_constraint
       WHERE conname = 'LegacyRecord_zero_decision_units_check'
         AND conrelid = 'scl."LegacyRecord"'::regclass
     ) AS present`,
  );
  const legacyRecordInvariant = {
    rowsRepaired: legacyBefore[0]?.rows ?? 0,
    profilesAffected: legacyBefore[0]?.profiles ?? 0,
    remainingInvalidRows: legacyAfter[0]?.rows ?? -1,
    constraintPresent: legacyConstraint[0]?.present === true,
  };

  const extremePlays = await prisma.play.findMany({
    where: { units: { gte: EXTREME_STAKE_UNITS } },
    select: { id: true, units: true, profitUnits: true },
  });
  const extremeParlays = await prisma.parlay.findMany({
    where: { units: { gte: EXTREME_STAKE_UNITS } },
    select: { id: true, units: true, profitUnits: true },
  });
  let playsRepaired = 0;
  for (const play of extremePlays) {
    const next = normalizeExtremeStake({
      units: Number(play.units),
      profitUnits: play.profitUnits == null ? null : Number(play.profitUnits),
    });
    await prisma.play.update({
      where: { id: play.id },
      data: { units: next.units, profitUnits: next.profitUnits },
    });
    playsRepaired += 1;
  }
  let parlaysRepaired = 0;
  for (const parlay of extremeParlays) {
    const next = normalizeExtremeStake({
      units: Number(parlay.units),
      profitUnits:
        parlay.profitUnits == null ? null : Number(parlay.profitUnits),
    });
    await prisma.parlay.update({
      where: { id: parlay.id },
      data: { units: next.units, profitUnits: next.profitUnits },
    });
    parlaysRepaired += 1;
  }
  const remainingExtreme = await prisma.play.count({
    where: { units: { gte: EXTREME_STAKE_UNITS } },
  });
  const remainingExtremeParlays = await prisma.parlay.count({
    where: { units: { gte: EXTREME_STAKE_UNITS } },
  });
  const extremeStakeRepair = {
    playsRepaired,
    parlaysRepaired,
    remainingInvalidRows: remainingExtreme + remainingExtremeParlays,
  };

  const ok =
    failed.length === 0 &&
    storeConnectionColumns.length === 5 &&
    userEmailIndexes.includes("User_email_username_key") &&
    !userEmailIndexes.includes("User_email_key") &&
    blockedMigrations.length === 0 &&
    storefrontMessagesTable &&
    legacyRecordInvariant.remainingInvalidRows === 0 &&
    legacyRecordInvariant.constraintPresent &&
    extremeStakeRepair.remainingInvalidRows === 0;

  // This route repairs data with raw SQL, so Prisma/Next do not know that the
  // cached public leaderboard and capper profiles are stale. Invalidate even
  // on an idempotent re-run: a previous repair may have completed before this
  // cache hook was deployed, leaving an otherwise-valid database hidden behind
  // a persistent data-cache entry.
  let cacheInvalidated = false;
  if (ok) {
    revalidateTag("leaderboard", { expire: 0 });
    cacheInvalidated = true;
  }

  return NextResponse.json(
    {
      ok,
      applied,
      failed,
      storeConnectionColumns,
      userEmailIndexes,
      blockedMigrations,
      storefrontMessagesTable,
      legacyRecordInvariant: {
        ...legacyRecordInvariant,
        cacheInvalidated,
      },
      extremeStakeRepair: {
        ...extremeStakeRepair,
        cacheInvalidated,
      },
    },
    { status: ok ? 200 : 500 },
  );
}
