/**
 * Date revival for values that cross an `unstable_cache` boundary.
 *
 * `unstable_cache` persists entries as JSON — `JSON.stringify` on write and
 * `JSON.parse` on read, in
 * `next/dist/server/web/spec-extension/unstable-cache.js`. A `Date` therefore
 * survives a cache *miss* intact, because the caller gets the live in-memory
 * object, but comes back from every subsequent *hit* as an ISO string.
 * Consumers typed against `Date` then fail on the hit path only, which reads
 * as an intermittent 500 rather than an obvious type error:
 * `TypeError: getFullYear is not a function`, `RangeError: Invalid time value`.
 *
 * Revive on the way out and the boundary becomes transparent again: what goes
 * into the cache as a `Date` comes back out as a `Date`.
 */

/**
 * Matches exactly the shape `Date.prototype.toJSON` emits, so a payload string
 * is only rebuilt as a `Date` when it is one. Looser date-ish formats are left
 * alone — they never came from a `Date` in the first place.
 */
const ISO_INSTANT = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/;

function revive(value: unknown): unknown {
  if (typeof value === "string") {
    return ISO_INSTANT.test(value) ? new Date(value) : value;
  }
  if (value === null || typeof value !== "object") return value;
  // Cache misses hand back the live payload — its Dates are already Dates.
  if (value instanceof Date) return value;
  if (Array.isArray(value)) return value.map(revive);

  const revived: Record<string, unknown> = {};
  for (const [key, item] of Object.entries(value as Record<string, unknown>)) {
    revived[key] = revive(item);
  }
  return revived;
}

/**
 * Rebuild the `Date`s in a cached payload. Safe on both cache paths, and safe
 * to apply to whole payloads: cached query results are plain data (Prisma
 * `Decimal`s are already narrowed to `number` before they are returned).
 */
export function reviveCachedDates<T>(value: T): T {
  return revive(value) as T;
}
