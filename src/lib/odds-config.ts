export type OddsEnvironment = Record<string, string | undefined>;

/** Accept the canonical key and the historical production misspelling. */
export function oddsApiKey(
  env: OddsEnvironment = process.env,
): string | undefined {
  return env.ODDS_API_KEY?.trim() || env.ODD_API_KEY?.trim() || undefined;
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
export function oddsApiKeys(env: OddsEnvironment = process.env): string[] {
  const listed = (env.ODDS_API_KEYS ?? "")
    .split(",")
    .map((key) => key.trim())
    .filter(Boolean);

  return [
    oddsApiKey(env),
    env.ODDS_API_KEY_FALLBACK?.trim(),
    env.ODDS_API_KEY_2?.trim(),
    ...listed,
  ].filter(
    (key, index, keys): key is string =>
      Boolean(key) && keys.indexOf(key) === index,
  );
}
