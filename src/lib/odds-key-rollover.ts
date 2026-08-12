import "server-only";

import { oddsApiKeys } from "@/lib/odds-config";

let preferredIndex = 0;

export type OddsKeyFetchResult = {
  response: Response | null;
  keyIndex: number | null;
  rolledOver: boolean;
};

function shouldRollOver(response: Response): boolean {
  const remaining = Number(response.headers.get("x-requests-remaining"));
  return (
    [401, 402, 403, 429].includes(response.status) ||
    (Number.isFinite(remaining) && remaining <= 0)
  );
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
