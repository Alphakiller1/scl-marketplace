export const DEFAULT_POOLED_CONNECTION_LIMIT = 5;
export const DEFAULT_POOL_TIMEOUT_SECONDS = 15;

/** Normalize a Supabase transaction-pooler URL for Fluid Compute + Prisma. */
export function tunedDatabaseUrl(raw: string | undefined): string | undefined {
  if (!raw) return raw;
  try {
    const url = new URL(raw);
    const pooled =
      url.port === "6543" ||
      url.searchParams.get("pgbouncer") === "true" ||
      url.hostname.includes("pooler");
    if (!pooled) return raw;

    const configuredLimit = Number(process.env.PRISMA_POOL_CONNECTION_LIMIT);
    const limit =
      Number.isInteger(configuredLimit) && configuredLimit > 0
        ? Math.max(DEFAULT_POOLED_CONNECTION_LIMIT, configuredLimit)
        : DEFAULT_POOLED_CONNECTION_LIMIT;
    url.searchParams.set("connection_limit", String(limit));
    if (!url.searchParams.has("pool_timeout")) {
      url.searchParams.set(
        "pool_timeout",
        String(DEFAULT_POOL_TIMEOUT_SECONDS),
      );
    }
    return url.toString();
  } catch {
    return raw;
  }
}

export function databasePoolConfiguration(raw: string | undefined): {
  pooled: boolean;
  connectionLimit: number | null;
  poolTimeoutSeconds: number | null;
} {
  const tuned = tunedDatabaseUrl(raw);
  if (!tuned) {
    return { pooled: false, connectionLimit: null, poolTimeoutSeconds: null };
  }
  try {
    const url = new URL(tuned);
    const pooled =
      url.port === "6543" ||
      url.searchParams.get("pgbouncer") === "true" ||
      url.hostname.includes("pooler");
    return {
      pooled,
      connectionLimit: pooled
        ? Number(url.searchParams.get("connection_limit")) || null
        : null,
      poolTimeoutSeconds: pooled
        ? Number(url.searchParams.get("pool_timeout")) || null
        : null,
    };
  } catch {
    return { pooled: false, connectionLimit: null, poolTimeoutSeconds: null };
  }
}
