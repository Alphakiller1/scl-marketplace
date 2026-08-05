/**
 * Winible checkout URL validation. The SCL creator-onboarding referral must
 * never be saved as a customer package link — that belongs in capper onboarding.
 */

import { isWinibleCreatorReferralUrl } from "@/lib/store-connection";

export function isWinibleCheckoutUrl(value: string): boolean {
  try {
    const url = new URL(value);
    const hostname = url.hostname.toLowerCase().replace(/^www\./, "");
    if (url.protocol !== "https:" || hostname !== "winible.com") return false;
    return !isWinibleCreatorReferralUrl(value);
  } catch {
    return false;
  }
}

export function winibleCheckoutUrlIssues(value: string): string[] {
  const issues: string[] = [];

  if (value.includes("&amp;") || value.includes("?amp;")) {
    issues.push(
      "URL contains HTML-escaped parameters (&amp;). Paste the raw checkout link.",
    );
  }

  if (isWinibleCreatorReferralUrl(value)) {
    issues.push(
      "This is SCL's Winible creator-onboarding referral, not a customer checkout link.",
    );
    return issues;
  }

  if (!isWinibleCheckoutUrl(value)) {
    issues.push(
      "Use a Winible checkout or package link (https://winible.com/…).",
    );
  }

  return issues;
}
