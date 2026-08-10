import { oddsApiKey } from "@/lib/odds-config";

export type OddsProviderHealth = {
  configured: boolean;
  reachable: boolean;
  statusCode: number | null;
  activeSports: number;
  checkedAt: string;
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
    const response = await (options?.fetchImpl ?? fetch)(
      `https://api.the-odds-api.com/v4/sports/?apiKey=${encodeURIComponent(apiKey)}`,
      {
        cache: "no-store",
        signal: AbortSignal.timeout(8_000),
      },
    );
    const payload = response.ok ? await response.json() : null;
    return {
      configured: true,
      reachable: response.ok && Array.isArray(payload),
      statusCode: response.status,
      activeSports: Array.isArray(payload) ? payload.length : 0,
      checkedAt,
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
