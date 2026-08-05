/**
 * The canonical public origin, used for `robots.txt`, `sitemap.xml`, and
 * anywhere else we have to emit an absolute URL.
 *
 * Both of those files used to hardcode the `*.vercel.app` host, which meant the
 * first crawl after a custom-domain launch would advertise the deployment host
 * as canonical. Driven by env so the same build serves whichever origin it is
 * deployed behind.
 *
 * Precedence:
 *   1. `NEXT_PUBLIC_SITE_URL` — set this in production to the real domain.
 *   2. `VERCEL_PROJECT_PRODUCTION_URL` — Vercel's own production host, so
 *      preview builds still emit something sane without extra configuration.
 *   3. the deployment fallback, for local dev.
 */
const FALLBACK = "https://scl-marketplace.vercel.app";

function normalize(value: string): string {
  const withProtocol = /^https?:\/\//i.test(value) ? value : `https://${value}`;
  // A trailing slash would produce `https://host//sitemap.xml`.
  return withProtocol.replace(/\/+$/, "");
}

export function siteUrl(): string {
  const explicit = process.env.NEXT_PUBLIC_SITE_URL?.trim();
  if (explicit) return normalize(explicit);

  const vercelHost = process.env.VERCEL_PROJECT_PRODUCTION_URL?.trim();
  if (vercelHost) return normalize(vercelHost);

  return FALLBACK;
}
