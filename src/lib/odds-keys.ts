/**
 * Odds API key rotation.
 *
 * Split out of `odds-api.ts` (which is `server-only` and therefore untestable)
 * because this is precisely the logic that fails silently: an exhausted key is
 * still a perfectly valid string, and every board fetch swallows a non-OK
 * response and returns an empty slate. So a dead key does not look like an
 * outage — it looks like a quiet day with no games, on every sport at once.
 *
 * That has already happened here twice over: the monthly credits ran out and
 * the boards emptied, and the replacement key was added to the environment as
 * `ODDS_API_KEY_FALLBACK` — a name nothing in the codebase ever read, so the
 * key that was supposed to take over never got used at all.
 *
 * Pure — no network, no `server-only`.
 */

/**
 * Env vars holding keys, in the order they are tried.
 *
 * `ODDS_API_KEYS` is canonical and accepts a comma-separated list, so stacking
 * keys is one env edit. The rest are singles this project accumulated:
 * `ODD_API_KEY` is a long-standing misspelling that is still the live value in
 * some environments, and `ODDS_API_KEY_FALLBACK` was added by hand mid-outage.
 *
 * Order matters more than it looks. A key with zero credits left still reads as
 * configured, so if it sorts first it wins forever and the fresh key below it
 * is never reached.
 */
export const ODDS_KEY_ENV_VARS = [
  "ODDS_API_KEYS",
  "ODDS_API_KEY_2",
  "ODDS_API_KEY",
  "ODDS_API_KEY_FALLBACK",
  "ODD_API_KEY",
] as const;

/** Every configured key, in priority order, comma-lists flattened and deduped. */
export function parseOddsApiKeys(
  env: Record<string, string | undefined> = process.env,
): string[] {
  const keys: string[] = [];
  const seen = new Set<string>();
  for (const name of ODDS_KEY_ENV_VARS) {
    for (const raw of (env[name] ?? "").split(",")) {
      const key = raw.trim();
      if (!key || seen.has(key)) continue;
      seen.add(key);
      keys.push(key);
    }
  }
  return keys;
}

/**
 * Keys seen to be out of credits or rejected, for the life of the isolate.
 *
 * Deliberately in-memory and never persisted: quota resets monthly and isolates
 * are short-lived, so a restart re-tests every key rather than permanently
 * writing off one that has since rolled over.
 */
const exhausted = new Set<string>();

export function isOddsKeyExhausted(key: string): boolean {
  return exhausted.has(key);
}

/** Keys still worth spending, in priority order. */
export function liveOddsApiKeys(
  env?: Record<string, string | undefined>,
): string[] {
  return parseOddsApiKeys(env).filter((key) => !exhausted.has(key));
}

/**
 * The key to spend next.
 *
 * Falls back to the first configured key once every key is written off, so
 * callers still emit a request — and surface a real error — rather than
 * reporting the integration as unconfigured, which reads to an operator as
 * "nobody ever set this up" and sends them looking in the wrong place.
 */
export function nextOddsApiKey(
  env?: Record<string, string | undefined>,
): string | undefined {
  const keys = parseOddsApiKeys(env);
  return keys.find((key) => !exhausted.has(key)) ?? keys[0];
}

/** Take a key out of rotation after the API rejects it or reports zero credits. */
export function markOddsKeyExhausted(key: string, reason: string): void {
  if (!key || exhausted.has(key)) return;
  exhausted.add(key);
  console.warn(
    `[odds] key ...${key.slice(-6)} out of rotation (${reason}); ` +
      `${liveOddsApiKeys().length} key(s) left`,
  );
}

/** Test seam — forget which keys were written off. */
export function resetOddsKeyRotation(): void {
  exhausted.clear();
}
