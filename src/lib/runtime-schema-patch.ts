/** True when running in a live Vercel production request — not during `next build`. */
export function shouldApplyRuntimeSchemaPatch(): boolean {
  if (process.env.NEXT_PHASE === "phase-production-build") return false;
  return process.env.VERCEL_ENV === "production";
}
