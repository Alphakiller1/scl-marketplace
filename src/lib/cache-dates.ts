/**
 * Restore `Date` instances in a value that has come back through a JSON cache.
 *
 * `unstable_cache` persists its payload with `JSON.stringify` and returns
 * `JSON.parse` of it, so every Date in a cached value comes back as an ISO
 * string on a cache HIT. That is what broke every public capper profile: the
 * header called `lastPlayAt.getFullYear()` and the About block ran `joinedAt`
 * through `Intl.DateTimeFormat`, so a HIT threw "getFullYear is not a function"
 * and "Invalid time value" while a MISS rendered perfectly — which is exactly
 * why the bug kept looking fixed when it was checked once.
 *
 * Reviving by SHAPE rather than by a list of known fields is deliberate. A field
 * list drifts the moment someone adds a Date to a cached payload, and the
 * failure mode of that drift is a broken public page. Only a string that is
 * exactly an ISO-8601 UTC timestamp is converted — the one format
 * `Date.prototype.toJSON` writes, and not a format any human-entered field on
 * these payloads (bio, title, selection, notes) takes as its entire value.
 *
 * Pure, no `server-only`: unit-testable, and safe for scripts to import.
 */

/** Exactly what `Date.prototype.toJSON()` produces — anchored, so no substring match. */
const ISO_UTC_TIMESTAMP =
  /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d{1,6})?Z$/;

function isPlainObject(value: unknown): value is Record<string, unknown> {
  if (typeof value !== "object" || value === null) return false;
  const proto = Object.getPrototypeOf(value) as object | null;
  return proto === Object.prototype || proto === null;
}

/**
 * Walk a cached payload and turn ISO-timestamp strings back into Dates.
 *
 * Revives in place. On a cache HIT the value is a fresh `JSON.parse` result that
 * nobody else holds; on a MISS it is the loader's own return value, which still
 * holds real Dates and therefore has nothing to convert. Non-plain objects
 * (Date, Decimal, Map, class instances) are left untouched.
 */
export function reviveCachedDates<T>(value: T): T {
  reviveInPlace(value);
  return value;
}

function reviveInPlace(value: unknown): void {
  if (Array.isArray(value)) {
    for (let i = 0; i < value.length; i += 1) {
      const item: unknown = value[i];
      if (typeof item === "string") {
        if (ISO_UTC_TIMESTAMP.test(item)) value[i] = new Date(item);
      } else {
        reviveInPlace(item);
      }
    }
    return;
  }

  if (!isPlainObject(value)) return;

  for (const key of Object.keys(value)) {
    const item: unknown = value[key];
    if (typeof item === "string") {
      if (ISO_UTC_TIMESTAMP.test(item)) value[key] = new Date(item);
    } else {
      reviveInPlace(item);
    }
  }
}
