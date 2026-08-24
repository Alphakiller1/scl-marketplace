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
  const token = whopAccountApiKey() || whopAppApiKey();
  if (!appId || !token) return "unknown";

  const needed = neededRedirectUri;
  const result = await mergeWhopAppRedirectUris({
    accessToken: token,
    appId,
    // Only the callback used by this flow is required. A read-only app key can
    // still verify an existing URI without failing while trying to add an
    // optional second host that requires developer:update_app.
    redirectUris: [needed],
  });
  if (result.ok) {
    return result.redirectUris.includes(needed) ? "ok" : "missing";
  }

  console.error("[whop] OAuth redirect URI sync failed:", result.error);
  if (result.redirectUris) {
    return result.redirectUris.includes(needed) ? "ok" : "missing";
  }
  return "unknown";
}
