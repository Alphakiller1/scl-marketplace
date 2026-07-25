/**
 * Post-login redirect targets come from the `callbackUrl` query param, which any
 * caller can craft. Only same-origin *paths* are safe to hand to `router.push`:
 * an absolute URL there turns the login form into an open redirect.
 */
export function safeCallbackPath(
  callbackUrl: string | null | undefined,
): string | null {
  if (!callbackUrl) return null;
  // Must be a rooted path. Reject "//evil.com" and "/\evil.com", which browsers
  // resolve as protocol-relative absolute URLs.
  if (!callbackUrl.startsWith("/")) return null;
  if (callbackUrl.startsWith("//") || callbackUrl.startsWith("/\\")) return null;
  return callbackUrl;
}
