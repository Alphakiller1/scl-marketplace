/** Add SCL's explicit Prisma schema without exposing or rebuilding credentials. */
export function withSclSchema(raw) {
  let url;
  try {
    url = new URL(raw);
  } catch {
    throw new Error("Database URL is invalid");
  }
  if (!/^postgres(ql)?:$/.test(url.protocol)) {
    throw new Error("Database URL must use postgresql:// or postgres://");
  }
  url.searchParams.set("schema", "scl");
  return url.toString();
}

/**
 * Convert Supabase's transaction-pooler URL into its session-pooler URL.
 *
 * Supabase's `db.<ref>.supabase.co` direct endpoint can be IPv6-only, which
 * makes production builds fail from IPv4-only runners. The same pooler host on
 * port 5432 provides session mode and is appropriate for Prisma migrations.
 */
export function toSessionDatabaseUrl(raw) {
  const normalized = withSclSchema(raw);
  const url = new URL(normalized);

  if (url.hostname.endsWith(".pooler.supabase.com")) {
    url.port = "5432";
    url.searchParams.delete("pgbouncer");
  }

  return url.toString();
}

// The workflow passes the secret through the environment and captures stdout.
// Never log it: stdout becomes the replacement Vercel secret value.
if (process.env.NORMALIZE_SCL_DATABASE_URL) {
  process.stdout.write(
    process.argv.includes("--session")
      ? toSessionDatabaseUrl(process.env.NORMALIZE_SCL_DATABASE_URL.trim())
      : withSclSchema(process.env.NORMALIZE_SCL_DATABASE_URL.trim()),
  );
}
