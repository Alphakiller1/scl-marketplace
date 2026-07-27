export type WorkspaceDestination = {
  href: string;
  label: string;
};

export function getDefaultWorkspace(
  role: string | null | undefined,
): WorkspaceDestination {
  return role === "ADMIN"
    ? { href: "/admin", label: "Admin Console" }
    : { href: "/dashboard", label: "Dashboard" };
}

/**
 * Accept only same-origin application paths from the callbackUrl query string.
 * URL parsing catches backslash-based and protocol-relative external redirects.
 */
export function getSafeCallbackPath(
  value: string | null | undefined,
): string | null {
  if (!value?.startsWith("/")) return null;

  try {
    const baseUrl = "https://scl.local";
    const url = new URL(value, baseUrl);
    if (url.origin !== baseUrl) return null;
    return `${url.pathname}${url.search}${url.hash}`;
  } catch {
    return null;
  }
}
