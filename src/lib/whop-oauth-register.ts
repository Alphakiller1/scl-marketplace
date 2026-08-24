import { mergeWhopAppRedirectUris } from "@/lib/whop-api";
import { whopAccountApiKey, whopAppApiKey, whopAppId } from "@/lib/whop-config";
import { whopOAuthRedirectUri } from "@/lib/whop-oauth-redirect";

export type WhopOAuthRedirectSync = "ok" | "missing" | "unknown";

/**
 * Make sure the live callback is on the Whop app's OAuth allowlist before we
 * send the capper to authorize. An empty or stale list is what rendered
 * `{"error":"invalid_request","error_description":"redirect_uri is invalid"}`
 * on api.whop.com.
 *
 * Returns `missing` only when we successfully read the allowlist and the
 * callback is still absent — Connect should stay on SCL instead of dumping
 * Whop's JSON into the browser. A permissions miss is `unknown` and must
 * not block Connect.
 */
export async function ensureWhopOAuthRedirectRegistered(
  neededRedirectUri = whopOAuthRedirectUri(),
): Promise<WhopOAuthRedirectSync> {
  const appId = whopAppId();
  const credentials = Array.from(
    new Map(
      [
        ["app", whopAppApiKey()],
        ["account", whopAccountApiKey()],
      ]
        .filter((entry): entry is [string, string] => Boolean(entry[1]))
        .map(([kind, token]) => [token, { kind, token }]),
    ).values(),
  );
  if (!appId || credentials.length === 0) return "unknown";

  const needed = neededRedirectUri;
  let readAllowlist = false;
  const errors: string[] = [];

  for (const credential of credentials) {
    const result = await mergeWhopAppRedirectUris({
      accessToken: credential.token,
      appId,
      // Only the callback used by this flow is required. A read-only key can
      // still verify an existing URI. If it cannot update the app, try the
      // other configured credential before treating the callback as missing.
      redirectUris: [needed],
    });
    if (result.ok) {
      if (result.redirectUris.includes(needed)) return "ok";
      readAllowlist = true;
      continue;
    }

    errors.push(`${credential.kind}: ${result.error}`);
    if (result.redirectUris) {
      if (result.redirectUris.includes(needed)) return "ok";
      readAllowlist = true;
    }
  }

  if (errors.length > 0) {
    console.error(
      "[whop] OAuth redirect URI sync failed for configured credentials:",
      errors.join(" | "),
    );
  }
  return readAllowlist ? "missing" : "unknown";
}
