import { oddsApiKeys } from "@/lib/odds-config";

export type OddsProviderBalance = {
  configuredKeys: number;
  reachedKeys: number;
  remaining: number | null;
  used: number | null;
  capacity: number | null;
  checkedAt: string;
  complete: boolean;
};

function quotaHeader(response: Response, name: string): number | null {
  const value = response.headers.get(name);
  if (value == null || value.trim() === "") return null;
  const parsed = Number(value);
  return Number.isFinite(parsed) && parsed >= 0 ? parsed : null;
}

/**
 * Reads the live balance of every configured provider key.
 *
 * The provider's `/v4/sports` route costs zero credits but still returns the
 * quota headers. The dashboard used to rely only on headers saved by paid
 * board calls, so a renewal remained invisible until another paid call ran.
 */
export async function probeOddsProviderBalance(options?: {
  keys?: readonly string[];
  fetchImpl?: typeof fetch;
  now?: Date;
}): Promise<OddsProviderBalance> {
  const keys = [...new Set(options?.keys ?? oddsApiKeys())].filter(Boolean);
  const checkedAt = (options?.now ?? new Date()).toISOString();
  if (keys.length === 0) {
    return {
      configuredKeys: 0,
      reachedKeys: 0,
      remaining: null,
      used: null,
      capacity: null,
      checkedAt,
      complete: false,
    };
  }

  const fetchImpl = options?.fetchImpl ?? fetch;
  const results = await Promise.all(
    keys.map(async (key) => {
      try {
        const response = await fetchImpl(
          `https://api.the-odds-api.com/v4/sports/?apiKey=${encodeURIComponent(key)}`,
          { cache: "no-store", signal: AbortSignal.timeout(8_000) },
        );
        const remaining = quotaHeader(response, "x-requests-remaining");
        const used = quotaHeader(response, "x-requests-used");
        // A refused rollover key has no spendable balance. Some provider error
        // responses omit quota headers; count those known refusal statuses as
        // zero so an old exhausted key cannot hide a renewed active key. A
        // network failure or unexpected response still makes the probe partial.
        if (
          remaining == null &&
          used == null &&
          [401, 403, 429].includes(response.status)
        ) {
          return { remaining: 0, used: 0, capacity: 0 };
        }
        if (remaining == null || used == null) return null;
        return { remaining, used, capacity: remaining + used };
      } catch {
        return null;
      }
    }),
  );
  const reached = results.filter(
    (result): result is NonNullable<typeof result> => result != null,
  );
  const complete = reached.length === keys.length;

  return {
    configuredKeys: keys.length,
    reachedKeys: reached.length,
    remaining: complete
      ? reached.reduce((sum, result) => sum + result.remaining, 0)
      : null,
    used: complete
      ? reached.reduce((sum, result) => sum + result.used, 0)
      : null,
    capacity: complete
      ? reached.reduce((sum, result) => sum + result.capacity, 0)
      : null,
    checkedAt,
    complete,
  };
}
