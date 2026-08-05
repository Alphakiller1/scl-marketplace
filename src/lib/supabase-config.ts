/**
 * Resolve Supabase credentials from env. SCL uses explicit names in `.env.example`,
 * but the Supabase ↔ Vercel integration syncs different keys (`SUPABASE_SECRET_KEY`,
 * `POSTGRES_*`, etc.). Accept both so profile media and the database work without
 * manual renames in the Vercel dashboard.
 */

function trimmed(value: string | undefined): string | null {
  const next = value?.trim();
  return next ? next : null;
}

function withSclSchema(connectionUrl: string): string {
  try {
    const url = new URL(connectionUrl);
    if (!url.searchParams.has("schema")) {
      url.searchParams.set("schema", "scl");
    }
    return url.toString();
  } catch {
    return connectionUrl.includes("schema=")
      ? connectionUrl
      : `${connectionUrl}${connectionUrl.includes("?") ? "&" : "?"}schema=scl`;
  }
}

/** Public Supabase project URL (Storage + API). */
export function supabaseProjectUrl(): string | null {
  return (
    trimmed(process.env.SUPABASE_URL) ??
    trimmed(process.env.NEXT_PUBLIC_SUPABASE_URL)
  );
}

/** Service-role key for server-side Storage uploads. Never expose to the client. */
export function supabaseServiceRoleKey(): string | null {
  return (
    trimmed(process.env.SUPABASE_SERVICE_ROLE_KEY) ??
    trimmed(process.env.SUPABASE_SECRET_KEY)
  );
}

export function supabaseProfileMediaBucket(): string {
  return (
    trimmed(process.env.SUPABASE_PROFILE_MEDIA_BUCKET) ?? "scl-profile-media"
  );
}

/** New Supabase platform secret keys must not be sent as Bearer JWTs. */
export function usesSupabasePlatformSecretKey(key: string): boolean {
  return key.startsWith("sb_secret_");
}

export function supabaseStorageConfigured(): boolean {
  return Boolean(supabaseProjectUrl() && supabaseServiceRoleKey());
}

export type SupabaseIntegrationStatus = {
  storage: boolean;
  url: boolean;
  serviceRole: boolean;
  bucket: string;
};

export function supabaseIntegrationStatus(): SupabaseIntegrationStatus {
  const url = supabaseProjectUrl();
  const serviceRole = supabaseServiceRoleKey();
  return {
    storage: Boolean(url && serviceRole),
    url: Boolean(url),
    serviceRole: Boolean(serviceRole),
    bucket: supabaseProfileMediaBucket(),
  };
}

/**
 * Map Supabase Vercel integration vars onto Prisma's `DATABASE_URL` /
 * `DIRECT_URL` when the SCL-specific names are unset.
 */
export function ensureSupabaseDatabaseEnvAliases(): void {
  if (!trimmed(process.env.DATABASE_URL)) {
    const pooled =
      trimmed(process.env.POSTGRES_PRISMA_URL) ??
      trimmed(process.env.POSTGRES_URL);
    if (pooled) {
      process.env.DATABASE_URL = withSclSchema(pooled);
    }
  }

  if (!trimmed(process.env.DIRECT_URL)) {
    const direct = trimmed(process.env.POSTGRES_URL_NON_POOLING);
    if (direct) {
      process.env.DIRECT_URL = withSclSchema(direct);
    }
  }
}
