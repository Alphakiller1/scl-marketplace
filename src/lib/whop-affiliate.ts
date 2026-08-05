/**
 * Whop checkout URL validation. A missing or HTML-escaped `?a=` silently kills
 * affiliate attribution — 118 of 122 legacy links had exactly that bug.
 */

export function isWhopCheckoutUrl(value: string): boolean {
  try {
    const url = new URL(value);
    const hostname = url.hostname.toLowerCase().replace(/^www\./, "");
    return (
      url.protocol === "https:" &&
      (hostname === "whop.com" || hostname.endsWith(".whop.com"))
    );
  } catch {
    return false;
  }
}

export function whopAffiliateParamIssues(
  value: string,
  expectedUsername?: string | null,
): string[] {
  const issues: string[] = [];

  if (value.includes("&amp;a=") || value.includes("?amp;a=")) {
    issues.push(
      "Affiliate parameter is HTML-escaped (&amp;a=). Use &a= in the raw URL.",
    );
  }

  if (!isWhopCheckoutUrl(value)) return issues;

  try {
    const url = new URL(value);
    const affiliate = url.searchParams.get("a");
    if (!affiliate) {
      issues.push(
        "Missing ?a= affiliate parameter — SCL earns no commission without it.",
      );
    } else if (expectedUsername && affiliate !== expectedUsername) {
      issues.push(
        `Affiliate username is "${affiliate}" but SCL expects "${expectedUsername}".`,
      );
    }
  } catch {
    // Invalid URL is handled by Zod's .url() check.
  }

  return issues;
}
