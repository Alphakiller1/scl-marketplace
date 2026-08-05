import { PrismaClient } from "@prisma/client";

import { ensureSupabaseDatabaseEnvAliases } from "@/lib/supabase-config";

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
function tunedDatabaseUrl(raw: string | undefined): string | undefined {
  if (!raw) return raw;
  try {
    const url = new URL(raw);
    const pooled =
      url.port === "6543" ||
      url.searchParams.get("pgbouncer") === "true" ||
      url.hostname.includes("pooler");
    if (!pooled) return raw;
    const limit = Number(url.searchParams.get("connection_limit"));
    if (!Number.isFinite(limit) || limit < 5) {
      url.searchParams.set("connection_limit", "5");
    }
    if (!url.searchParams.has("pool_timeout")) {
      url.searchParams.set("pool_timeout", "15");
    }
    return url.toString();
  } catch {
    return raw;
  }
}

export const prisma =
  globalForPrisma.prisma ??
  new PrismaClient({
    datasourceUrl: tunedDatabaseUrl(process.env.DATABASE_URL),
    log: process.env.NODE_ENV === "development" ? ["error", "warn"] : ["error"],
  });

// Reuse across warm serverless isolates so we do not open a new pool per invoke.
globalForPrisma.prisma = prisma;
