import type { PrismaClient } from "@prisma/client";

import { shouldApplyRuntimeSchemaPatch } from "@/lib/runtime-schema-patch";

let ensurePromise: Promise<void> | null = null;

/**
 * Idempotent production patch for #372 — allow multiple accounts per email.
 * Vercel builds sometimes lack database credentials during `prisma migrate
 * deploy`; apply the index swap at runtime on first connect instead.
 *
 * Takes the Prisma client as an argument to avoid a circular import with
 * `src/lib/prisma.ts`.
 */
export function ensureAuthEmailSchema(client: PrismaClient): Promise<void> {
  if (!shouldApplyRuntimeSchemaPatch()) return Promise.resolve();
  if (!ensurePromise) {
    ensurePromise = (async () => {
      try {
        // Cheap catalog check before the expensive part.
        //
        // The body below rewrites duplicate usernames with a window function
        // over the whole User table and then builds a unique index — and it ran
        // on EVERY cold serverless instance, awaited from `authorize()`, i.e.
        // directly on the login critical path. Each deploy spawns fresh
        // instances, so every deploy made the next sign-in pay a table scan and
        // an index build, which is what produced "Sign-in is taking too long".
        //
        // The patch has long since applied, so the honest cost is one index
        // lookup. Skipping when the index exists keeps the safety net for a
        // fresh database while taking it off the hot path everywhere else.
        const [{ present } = { present: false }] = await client.$queryRawUnsafe<
          { present: boolean }[]
        >(
          `SELECT to_regclass('scl."User_email_username_key"') IS NOT NULL AS present`,
        );
        if (present) return;

        await client.$executeRawUnsafe(`
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
