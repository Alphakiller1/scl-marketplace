export type OddsEnvironment = Record<string, string | undefined>;

/** Accept the canonical key and the historical production misspelling. */
export function oddsApiKey(
  env: OddsEnvironment = process.env,
): string | undefined {
  return env.ODDS_API_KEY?.trim() || env.ODD_API_KEY?.trim() || undefined;
}
