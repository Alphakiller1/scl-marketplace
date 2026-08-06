import type { PrismaClient } from "@prisma/client";

import { shouldApplyRuntimeSchemaPatch } from "@/lib/runtime-schema-patch";

let ensurePromise: Promise<void> | null = null;

/**
 * Idempotent runtime patch for storefront messaging (#376).
 * Production builds may skip `prisma migrate deploy` when DB creds are absent
 * at build time — create the thread table on first Prisma connect instead.
 */
export function ensureStorefrontMessagesSchema(
  client: PrismaClient,
): Promise<void> {
  if (!shouldApplyRuntimeSchemaPatch()) return Promise.resolve();
  if (!ensurePromise) {
    ensurePromise = applyStorefrontMessagesSchema(client);
  }
  return ensurePromise;
}

/** Call before any StorefrontMessage read/write on cold production isolates. */
export async function awaitStorefrontMessagesSchema(
  client: PrismaClient,
): Promise<void> {
  await ensureStorefrontMessagesSchema(client);
}

/**
 * One statement per call.
 *
 * These used to be a single newline-joined string passed to
 * `$executeRawUnsafe`. Prisma sends that over the extended protocol, and
 * Postgres refuses more than one command in a prepared statement — so the whole
 * patch died with `42601: cannot insert multiple commands into a prepared
 * statement` on every cold isolate and applied nothing at all. It only ever
 * looked harmless because a real migration had already created these objects.
 */
const STOREFRONT_MESSAGE_DDL: readonly string[] = [
  `DO $$ BEGIN
     CREATE TYPE scl."StorefrontMessageSender" AS ENUM ('ADMIN', 'CAPPER');
   EXCEPTION WHEN duplicate_object THEN NULL;
   END $$`,
  `ALTER TYPE scl."StorefrontReviewAction" ADD VALUE IF NOT EXISTS 'CAPPER_CONTACTED'`,
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
  `CREATE INDEX IF NOT EXISTS "StorefrontMessage_storeConnectionId_createdAt_idx"
     ON scl."StorefrontMessage"("storeConnectionId", "createdAt")`,
  `CREATE INDEX IF NOT EXISTS "StorefrontMessage_storeConnectionId_readByAdminAt_idx"
     ON scl."StorefrontMessage"("storeConnectionId", "readByAdminAt")`,
  `CREATE INDEX IF NOT EXISTS "StorefrontMessage_storeConnectionId_readByCapperAt_idx"
     ON scl."StorefrontMessage"("storeConnectionId", "readByCapperAt")`,
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
];

async function applyStorefrontMessagesSchema(
  client: PrismaClient,
): Promise<void> {
  try {
    // The overwhelmingly common case in production is that the migration has
    // already run. Cost that case one cheap lookup instead of eight DDL
    // statements: every cold isolate pays this, on request paths that are
    // already contending for a 5-connection pool.
    const [{ present }] = await client.$queryRaw<[{ present: boolean }]>`
      SELECT to_regclass('scl."StorefrontMessage"') IS NOT NULL AS present
    `;
    if (present) return;

    for (const statement of STOREFRONT_MESSAGE_DDL) {
      await client.$executeRawUnsafe(statement);
    }
  } catch (error) {
    console.error("[schema] storefront messages patch failed:", error);
  }
}
