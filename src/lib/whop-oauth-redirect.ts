import { siteUrl } from "@/lib/site-url";

export const SCL_PRODUCTION_ORIGIN = "https://sportscappersleaderboard.com";
export const WHOP_OAUTH_CALLBACK_PATH = "/api/whop/callback";

const PRODUCTION_CALLBACK = `${SCL_PRODUCTION_ORIGIN}${WHOP_OAUTH_CALLBACK_PATH}`;
export const SCL_WWW_PRODUCTION_ORIGIN =
  "https://www.sportscappersleaderboard.com";
const WWW_CALLBACK = `${SCL_WWW_PRODUCTION_ORIGIN}${WHOP_OAUTH_CALLBACK_PATH}`;

function normalizeRedirectUri(value: string): string {
  const withProtocol = /^https?:\/\//i.test(value) ? value : `https://${value}`;
  return withProtocol.replace(/\/+$/, "");
}

function hostOf(origin: string): string {
  try {
    return new URL(origin).host.replace(/^www\./i, "").toLowerCase();
  } catch {
    return "";
  }
}

/**
 * Exact callback Whop must receive. Their authorize endpoint rejects any
 * string that is not on the app's `redirect_uris` list — www vs apex,
 * a trailing slash, or the Vercel host all show up as
 * `redirect_uri is invalid` on api.whop.com.
 *
 * Production always uses the custom-domain callback the owner guide
 * documents. Local/dev uses the current origin so a laptop can still OAuth
 * against a separately registered localhost URI.
 */
export function whopOAuthRedirectUri(): string {
  const explicit = process.env.WHOP_OAUTH_REDIRECT_URI?.trim();
  if (explicit) return normalizeRedirectUri(explicit);

  const origin = siteUrl();
  const host = hostOf(origin);
  if (host === "sportscappersleaderboard.com" || host.endsWith(".vercel.app")) {
    return PRODUCTION_CALLBACK;
  }
  return `${origin}${WHOP_OAUTH_CALLBACK_PATH}`;
}

/** URIs SCL keeps registered on the Whop app so either public host works. */
export function whopOAuthRedirectUrisToRegister(): string[] {
  const current = whopOAuthRedirectUri();
  return Array.from(new Set([PRODUCTION_CALLBACK, WWW_CALLBACK, current]));
}
