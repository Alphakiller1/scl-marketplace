/**
 * Whether the runtime schema patches should run.
 *
 * These were a safety net for the era when a production build could not reach
 * the database to run `prisma migrate deploy`. They now cost more than they
 * protect: they execute at module scope in `prisma.ts`, so **every cold
 * serverless isolate** spends two pooled connections on them before it can
 * serve anything. On a 60-connection instance that is the first thing to fail
 * under pressure — production logged `/api/health` 503s whose only errors were
 * `[schema] auth email index patch failed` and `[schema] storefront messages
 * patch failed`, both `connection limit: 5` timeouts.
 *
 * Both patches are also no-ops in practice: their objects
 * (`User_email_username_key`, `scl."StorefrontMessage"`) exist in production
 * and each short-circuits on a `to_regclass` lookup. So the steady state is
 * pure overhead on the hot path.
 *
 * They are therefore **opt-in**: set `RUN_RUNTIME_SCHEMA_PATCH=1` to re-arm the
 * net for a fresh database that has never been migrated. Migrations remain the
 * real mechanism — `npm run build` runs `prisma migrate deploy` on production.
 */
export function shouldApplyRuntimeSchemaPatch(): boolean {
  if (process.env.NEXT_PHASE === "phase-production-build") return false;
  if (process.env.RUN_RUNTIME_SCHEMA_PATCH !== "1") return false;
  return process.env.VERCEL_ENV === "production";
}
