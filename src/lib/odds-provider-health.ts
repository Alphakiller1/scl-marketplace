import { oddsApiKey } from "@/lib/odds-config";
import { fetchWithOddsKeyRollover } from "@/lib/odds-key-rollover";

export type OddsProviderHealth = {
  configured: boolean;
  reachable: boolean;
  statusCode: number | null;
  activeSports: number;
  checkedAt: string;
  /** True when the answer came from a fallback because the primary was refused. */
  rolledOver?: boolean;
};

export async function probeOddsProvider(options?: {
  apiKey?: string | null;
  fetchImpl?: typeof fetch;
}): Promise<OddsProviderHealth> {
  const checkedAt = new Date().toISOString();
  const apiKey = options?.apiKey ?? oddsApiKey();
  if (!apiKey) {
    return {
      configured: false,
      reachable: false,
      statusCode: null,
      activeSports: 0,
      checkedAt,
    };
  }

  try {
    // Probe through the same rollover the app uses, or health reports on a key
    // the app has already given up on. An explicit `apiKey` still probes just
    // that key, which is what a caller checking one credential wants.
    const { response, rolledOver } = options?.apiKey
      ? {
          response: await (options?.fetchImpl ?? fetch)(
            `https://api.the-odds-api.com/v4/sports/?apiKey=${encodeURIComponent(apiKey)}`,
            { cache: "no-store", signal: AbortSignal.timeout(8_000) },
          ),
          rolledOver: false,
        }
      : await fetchWithOddsKeyRollover(
          (key) =>
            `https://api.the-odds-api.com/v4/sports/?apiKey=${encodeURIComponent(key)}`,
          { cache: "no-store", signal: AbortSignal.timeout(8_000) },
          options?.fetchImpl ?? fetch,
        );
    if (!response) {
      return {
        configured: true,
        reachable: false,
        statusCode: null,
        activeSports: 0,
        checkedAt,
      };
    }
    const payload = response.ok ? await response.json() : null;
    return {
      configured: true,
      reachable: response.ok && Array.isArray(payload),
      statusCode: response.status,
      activeSports: Array.isArray(payload) ? payload.length : 0,
      checkedAt,
      rolledOver,
    };
  } catch (error) {
    console.error(
      JSON.stringify({
        level: "error",
        event: "odds_provider_health_failed",
        error: error instanceof Error ? error.message : String(error),
      }),
    );
    return {
      configured: true,
      reachable: false,
      statusCode: null,
      activeSports: 0,
      checkedAt,
    };
  }
}
