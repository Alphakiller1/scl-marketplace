/**
 * Runtime DDL patches must never run during `next build`.
 * Vercel sets NODE_ENV=production for builds, so gate on NEXT_PHASE and
 * VERCEL_ENV instead.
 */
export function shouldApplyRuntimeSchemaPatch(): boolean {
  if (process.env.NEXT_PHASE === "phase-production-build") return false;
  return process.env.VERCEL_ENV === "production";
}
