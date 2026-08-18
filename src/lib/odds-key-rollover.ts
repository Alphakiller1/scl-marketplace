// Deliberately NOT `server-only`. Every caller that reaches The Odds API is
// required to route through this module, which put it in the import chain of
// `odds-provider-health` and therefore of that module's test — and a
// `server-only` import there fails to resolve under tsx, taking the whole suite
// down. Nothing here is a secret in its own right: the keys come from
// non-NEXT_PUBLIC env vars, which are undefined in a browser bundle, and the
// modules that actually serve odds (`odds-api`) keep their own `server-only`.
import { oddsApiKeys } from "@/lib/odds-config";

let preferredIndex = 0;

export type OddsKeyFetchResult = {
  response: Response | null;
  keyIndex: number | null;
  rolledOver: boolean;
};

/**
 * Statuses that mean the ACCOUNT was refused rather than the request being
 * wrong — no other key-independent reading of them exists.
 *
 * Note The Odds API answers an exhausted quota with 401, not 429, so a spent
 * key and an invalid one are indistinguishable by status alone. Both mean the
 * same thing to a caller: this key cannot fetch anything.
 */
export const PROVIDER_REFUSED_STATUSES = [401, 402, 403, 429] as const;

/**
 * True when the provider refused the account. Callers past rollover use this to
 * tell "every key was turned down" (fatal — nothing will fetch) apart from a
 * per-request failure like a 404 on an out-of-season sport (skippable).
 */
export function isProviderRefusal(status: number): boolean {
  return (PROVIDER_REFUSED_STATUSES as readonly number[]).includes(status);
}

function shouldRollOver(response: Response): boolean {
  // 429 is also the provider's short-lived concurrency/rate response. Moving
  // the process-wide preferred index on that status poisoned every later call:
  // one soccer/tennis burst moved a healthy 488-credit key onto an exhausted
  // fallback. Keep the current key and let callers serve last-good data.
  return response.status !== 429 && isProviderRefusal(response.status);
}

/** Try the current primary first and use rollover only after quota/auth failure. */
export async function fetchWithOddsKeyRollover(
  buildUrl: (apiKey: string) => string,
  init?: Parameters<typeof fetch>[1],
  fetchImpl: typeof fetch = fetch,
): Promise<OddsKeyFetchResult> {
  const keys = oddsApiKeys();
  if (keys.length === 0) {
    return { response: null, keyIndex: null, rolledOver: false };
  }

  const start = Math.min(preferredIndex, keys.length - 1);
  for (let index = start; index < keys.length; index++) {
    const response = await fetchImpl(buildUrl(keys[index]!), init);
    const remaining = Number(response.headers.get("x-requests-remaining"));
    // A successful final response is still usable. Consume it, then move the
    // next request to the fallback instead of paying twice for the same data.
    if (response.ok && Number.isFinite(remaining) && remaining <= 0) {
      preferredIndex = Math.min(index + 1, keys.length - 1);
      return { response, keyIndex: index, rolledOver: index > 0 };
    }
    if (!shouldRollOver(response) || index === keys.length - 1) {
      preferredIndex = index;
      return { response, keyIndex: index, rolledOver: index > 0 };
    }
    preferredIndex = index + 1;
    console.warn("[odds] provider key rollover activated", {
      exhaustedKeyIndex: index,
      status: response.status,
    });
  }

  return { response: null, keyIndex: null, rolledOver: false };
}

export function resetOddsKeyPreferenceForTests(): void {
  preferredIndex = 0;
}
