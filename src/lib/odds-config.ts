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
 */
export function oddsApiKeys(env: OddsEnvironment = process.env): string[] {
  return [oddsApiKey(env), env.ODDS_API_KEY_FALLBACK?.trim()].filter(
    (key, index, keys): key is string =>
      Boolean(key) && keys.indexOf(key) === index,
  );
}
