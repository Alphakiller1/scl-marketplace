/** Normalize a Supabase transaction-pooler URL for serverless Prisma usage. */
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
        ? configuredLimit
        : 1;
    url.searchParams.set("connection_limit", String(limit));
    if (!url.searchParams.has("pool_timeout")) {
      url.searchParams.set("pool_timeout", "15");
    }
    return url.toString();
  } catch {
    return raw;
  }
}
