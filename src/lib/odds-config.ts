import { AsyncLocalStorage } from "node:async_hooks";

export type OddsEnvironment = Record<string, string | undefined>;

export type OddsRequestContext = {
  apiKey: string;
  lastOddsApiRemaining: number | null;
  lastOddsApiCapacity: number | null;
  preferredKeyIndex: number;
};

const oddsRequestContext = new AsyncLocalStorage<OddsRequestContext>();

export function getOddsRequestContext(): OddsRequestContext | undefined {
  return oddsRequestContext.getStore();
}

/** Accept the canonical key and the historical production misspelling. */
export function oddsApiKey(env?: OddsEnvironment): string | undefined {
  const requestKey = env === undefined ? getOddsRequestContext()?.apiKey : null;
  const source = env ?? process.env;
  return (
    requestKey ||
    source.ODDS_API_KEY?.trim() ||
    source.ODD_API_KEY?.trim() ||
    undefined
  );
}

/**
 * Scope a one-shot key to one signed populate request without changing the
 * process environment shared by concurrent and future requests.
 */
export function withOddsApiKey<T>(key: string, callback: () => T): T {
  return oddsRequestContext.run(
    {
      apiKey: key.trim(),
      lastOddsApiRemaining: null,
      lastOddsApiCapacity: null,
      preferredKeyIndex: 0,
    },
    callback,
  );
}

/**
 * Ordered provider keys. The existing key always burns down first; rollover is
 * used only after the provider rejects/exhausts it. Duplicate values collapse.
 *
 * `ODDS_API_KEYS` accepts a COMMA-SEPARATED list and is read last, which is
 * what makes adding capacity an env edit instead of a deploy: top up the list
 * and the running app reaches the new key the moment the ones above it are
 * refused. It is deliberately last — the singles above it are existing keys
 * with credit still on them, and rollover is meant to spend those first.
 *
 * This exists because a spent key is indistinguishable from a quiet day: a key
 * added under a name nothing reads produces exactly the same empty board as no
 * key at all, and that is precisely what happened — a replacement was put in
 * the environment during an outage and never used, because the only names
 * being read were the two already exhausted.
 */
export function oddsApiKeys(env?: OddsEnvironment): string[] {
  const requestKey = env === undefined ? getOddsRequestContext()?.apiKey : null;
  if (requestKey) return [requestKey];

  const source = env ?? process.env;
  const listed = (source.ODDS_API_KEYS ?? "")
    .split(",")
    .map((key) => key.trim())
    .filter(Boolean);

  return [
    oddsApiKey(source),
    source.ODDS_API_KEY_FALLBACK?.trim(),
    source.ODDS_API_KEY_2?.trim(),
    ...listed,
  ].filter(
    (key, index, keys): key is string =>
      Boolean(key) && keys.indexOf(key) === index,
  );
}
