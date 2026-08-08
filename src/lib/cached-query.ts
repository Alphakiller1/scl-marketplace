import "server-only";

import { unstable_cache } from "next/cache";

import { reviveCachedDates } from "@/lib/cache-dates";

/**
 * The ONE way to add a cross-request cache to a query in this app.
 *
 * `unstable_cache` round-trips its payload through JSON, so a cached value that
 * contains a Date hands back an ISO string on every cache HIT. The public
 * profile shipped exactly that and crashed for every visitor for a day (the
 * header formatted `lastPlayAt`, the About block formatted `joinedAt`), while
 * every local check hit a cache MISS and looked perfect.
 *
 * Wrapping the cache here means the revival happens once, for every cached
 * query, instead of being remembered per call site — and `cached-query.test.ts`
 * fails the build if `unstable_cache` is used anywhere else.
 */
export function cachedQuery<Args extends unknown[], T>(
  loader: (...args: Args) => Promise<T>,
  keyParts: string[],
  options: { revalidate?: number | false; tags?: string[] },
): (...args: Args) => Promise<T> {
  const cached = unstable_cache(loader, keyParts, options);
  return async (...args: Args) => reviveCachedDates(await cached(...args));
}
