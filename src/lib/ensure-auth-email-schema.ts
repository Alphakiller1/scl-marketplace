import { prisma } from "@/lib/prisma";
import { shouldApplyRuntimeSchemaPatch } from "@/lib/runtime-schema-patch";

let ensurePromise: Promise<void> | null = null;

/**
 * Idempotent production patch for #372 — allow multiple accounts per email.
 * Vercel builds sometimes lack database credentials during `prisma migrate
 * deploy`; apply the index swap at runtime on first auth request instead.
 */
export function ensureAuthEmailSchema(): Promise<void> {
  if (!shouldApplyRuntimeSchemaPatch()) return Promise.resolve();
  if (!ensurePromise) {
    ensurePromise = (async () => {
      try {
        await prisma.$executeRawUnsafe(`
          WITH ranked AS (
            SELECT
              id,
              ROW_NUMBER() OVER (
                PARTITION BY email, username
                ORDER BY "createdAt" ASC, id ASC
              ) AS rn
            FROM scl."User"
            WHERE username IS NOT NULL
          )
          UPDATE scl."User" u
          SET username = u.username || '_' || substr(u.id, 1, 6)
          FROM ranked r
          WHERE u.id = r.id AND r.rn > 1;

          ALTER TABLE scl."User" DROP CONSTRAINT IF EXISTS "User_email_key";
          DROP INDEX IF EXISTS scl."User_email_key";
          DROP INDEX IF EXISTS "User_email_key";
          CREATE UNIQUE INDEX IF NOT EXISTS "User_email_username_key"
            ON scl."User"("email", "username");
        `);
      } catch (error) {
        console.error("[schema] auth email index patch failed:", error);
      }
    })();
  }
  return ensurePromise;
}
