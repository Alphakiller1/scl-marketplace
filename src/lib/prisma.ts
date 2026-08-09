import { PrismaClient } from "@prisma/client";

import { tunedDatabaseUrl } from "@/lib/prisma-url";
import { ensureSupabaseDatabaseEnvAliases } from "@/lib/supabase-config";

ensureSupabaseDatabaseEnvAliases();

const globalForPrisma = globalThis as unknown as {
  prisma: PrismaClient | undefined;
};

/** One shared client per serverless isolate, tuned for Supabase's pooler. */
export const prisma =
  globalForPrisma.prisma ??
  new PrismaClient({
    datasourceUrl: tunedDatabaseUrl(process.env.DATABASE_URL),
    log: process.env.NODE_ENV === "development" ? ["error", "warn"] : ["error"],
  });

// Reuse across warm serverless isolates so we do not open a new pool per invoke.
globalForPrisma.prisma = prisma;
