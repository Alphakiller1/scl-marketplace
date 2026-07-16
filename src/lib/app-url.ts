/**
 * Absolute public origin for emails, OG tags, and absolute asset URLs.
 * Mirrors the AUTH_URL / VERCEL_URL resolution used by the email helpers.
 */
export function appUrl(): string {
  const base =
    process.env.AUTH_URL ??
    (process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : null) ??
    "http://localhost:3000";
  return base.trim().replace(/\/+$/, "");
}
