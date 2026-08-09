import { PrismaClient } from "@prisma/client";

import { ensureAuthEmailSchema } from "@/lib/ensure-auth-email-schema";
import { ensureStorefrontMessagesSchema } from "@/lib/ensure-storefront-messages-schema";
import { ensureSupabaseDatabaseEnvAliases } from "@/lib/supabase-config";
import { tunedDatabaseUrl } from "@/lib/prisma-url";

ensureSupabaseDatabaseEnvAliases();

const globalForPrisma = globalThis as unknown as {
  prisma: PrismaClient | undefined;
};

/**
 * Give each serverless isolate enough pooled connections.
 *
 * Prod ran with `connection_limit=1`, so any page that fans its queries out with
 * `Promise.all` serializes them onto a single connection and, under real load,
 * trips Prisma's pool timeout — surfacing as `P2024` and pages that never render.
 * We widen the limit only for POOLED urls (Supabase transaction pooler: pgbouncer,
 * port 6543, or a `*.pooler.*` host) so a bare direct `5432` connection is never
 * over-subscribed. Failure to parse → return the url untouched.
 */
export const prisma =
  globalForPrisma.prisma ??
  new PrismaClient({
    datasourceUrl: tunedDatabaseUrl(process.env.DATABASE_URL),
    log: process.env.NODE_ENV === "development" ? ["error", "warn"] : ["error"],
  });

// Reuse across warm serverless isolates so we do not open a new pool per invoke.
globalForPrisma.prisma = prisma;

// Runtime fallback when Production build-time migrate cannot reach the DB.
void ensureAuthEmailSchema(prisma);
void ensureStorefrontMessagesSchema(prisma);
