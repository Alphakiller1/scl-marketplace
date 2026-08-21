import { isSclWhopAffiliateUsername } from "@/lib/whop-config";

/**
 * Whop checkout URL validation. A missing or HTML-escaped `?a=` silently kills
 * affiliate attribution — 118 of 122 legacy links had exactly that bug.
 */

/**
 * SCL's Whop **creator-onboarding referral** — the link capper onboarding hands
 * out so somebody without a platform can go create a Whop storefront.
 *
 * This is a different thing from SCL's Whop **affiliate** relationship, and the
 * two must not be conflated. Affiliation is the `?a=` parameter, and a real
 * capper checkout link is *supposed* to carry `?a=scleaderboard` — that is how
 * SCL earns its commission. So this check keys on the `/network` path alone and
 * never looks at `?a=`: keying it on the slug would reject exactly the links the
 * affiliate rules require.
 */
export function isWhopCreatorReferralUrl(value: string): boolean {
  try {
    const url = new URL(value);
    const hostname = url.hostname.toLowerCase().replace(/^www\./, "");
    if (url.protocol !== "https:" || hostname !== "whop.com") return false;
    // `/network` is Whop's affiliate-network hub, never a capper's storefront.
    return /^\/network\/?$/.test(url.pathname);
  } catch {
    return false;
  }
}

export function isWhopCheckoutUrl(value: string): boolean {
  try {
    const url = new URL(value);
    const hostname = url.hostname.toLowerCase().replace(/^www\./, "");
    if (
      url.protocol !== "https:" ||
      !(hostname === "whop.com" || hostname.endsWith(".whop.com"))
    ) {
      return false;
    }
    return !isWhopCreatorReferralUrl(value);
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

  // Reported before the generic bail-out below, so pasting the onboarding
  // referral says what is actually wrong instead of failing silently.
  if (isWhopCreatorReferralUrl(value)) {
    issues.push(
      "This is SCL's Whop creator-onboarding referral, not a customer checkout link.",
    );
    return issues;
  }

  if (!isWhopCheckoutUrl(value)) return issues;

  try {
    const url = new URL(value);
    const affiliate = url.searchParams.get("a");
    if (!affiliate) {
      issues.push(
        "Missing ?a= affiliate parameter — SCL earns no commission without it.",
      );
    } else if (expectedUsername && !isSclWhopAffiliateUsername(affiliate)) {
      issues.push(
        `Affiliate username is "${affiliate}" but SCL expects "${expectedUsername}".`,
      );
    }
  } catch {
    // Invalid URL is handled by Zod's .url() check.
  }

  return issues;
}
