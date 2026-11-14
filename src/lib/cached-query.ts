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
  options: {
    revalidate?: number | false;
    tags?: string[];
    /**
     * A result that must not be cached, e.g. `{ failed: true }` after a
     * database hiccup. It is still returned to this caller, but the next
     * request tries again instead of serving the failure for the whole
     * revalidate window.
     */
    isFailure?: (value: T) => boolean;
  },
): (...args: Args) => Promise<T> {
  const { isFailure, ...cacheOptions } = options;
  const guarded = isFailure
    ? async (...args: Args) => {
        const value = await loader(...args);
        // unstable_cache stores only resolved values; throwing skips the write.
        if (isFailure(value)) throw new UncachedResult(value);
        return value;
      }
    : loader;
  const cached = unstable_cache(guarded, keyParts, cacheOptions);
  return async (...args: Args) => {
    try {
      return reviveCachedDates(await cached(...args));
    } catch (error) {
      if (error instanceof UncachedResult) return error.value as T;
      throw error;
    }
  };
}

/** Carries a result out of the cache wrapper without it being stored. */
class UncachedResult extends Error {
  constructor(readonly value: unknown) {
    super("result not cached");
  }
}
