import type { PolicyDocumentSlug } from "@prisma/client";
import { z } from "zod";

export const FALLBACK_POLICY_VERSION = "2026-06-28";

/** @deprecated Use getCurrentPolicyVersion() — kept for tests and seed fallbacks. */
export const CURRENT_POLICY_VERSION = FALLBACK_POLICY_VERSION;

export const POLICY_SLUG_PATH: Record<PolicyDocumentSlug, string> = {
  TERMS: "terms",
  PRIVACY: "privacy",
  RESPONSIBLE_GAMING: "responsible-gaming",
  DISCLAIMER: "disclaimer",
};

export const POLICY_SLUG_LABEL: Record<PolicyDocumentSlug, string> = {
  TERMS: "Terms & Conditions",
  PRIVACY: "Privacy Policy",
  RESPONSIBLE_GAMING: "Responsible Gaming",
  DISCLAIMER: "Disclaimer",
};

export const POLICY_PATH_TO_SLUG: Record<string, PolicyDocumentSlug> = {
  terms: "TERMS",
  privacy: "PRIVACY",
  "responsible-gaming": "RESPONSIBLE_GAMING",
  disclaimer: "DISCLAIMER",
};

export const DEFAULT_POLICY_BODIES: Record<
  PolicyDocumentSlug,
  { title: string; body: string }
> = {
  TERMS: {
    title: "Terms & Conditions",
    body: `By using Sports Capper Leaderboard (SCL) you agree to these terms. SCL is a performance-tracking and discovery platform for sports handicappers.

SCL does not accept wagers and is not a sportsbook. Handicapper records are tracked for transparency; past performance does not guarantee future results.

Cappers decide which third-party packages SCL may market. Checkout, payment, subscriptions, and fulfillment are handled by the applicable third-party storefront. SCL may receive affiliate compensation when a transaction is attributed to an SCL tracking link under that storefront's rules.`,
  },
  PRIVACY: {
    title: "Privacy Policy",
    body: `We collect the information needed to operate your SCL account and track capper performance. Package links may record limited referral data such as the time and referring page so SCL can operate its tracking links. We do not sell your personal data.

You can request access to or deletion of your account data by contacting support.`,
  },
  RESPONSIBLE_GAMING: {
    title: "Responsible Gaming",
    body: `Bet responsibly. Only wager what you can afford to lose. SCL provides information and performance tracking, not betting advice or guarantees.

If gambling is affecting your life, call 1-800-GAMBLER for confidential help, available 24/7.`,
  },
  DISCLAIMER: {
    title: "Disclaimer",
    body: `All content on SCL is for informational and entertainment purposes only and does not constitute betting or financial advice.

Handicapper records reflect tracked results on this platform. Sports betting involves risk; you are responsible for your own decisions.`,
  },
};

let cachedVersion: { value: string; at: number } | null = null;
const CACHE_MS = 60_000;

export function invalidatePolicyVersionCache() {
  cachedVersion = null;
}

export async function getCurrentPolicyVersion(): Promise<string> {
  if (cachedVersion && Date.now() - cachedVersion.at < CACHE_MS) {
    return cachedVersion.value;
  }
  const { prisma } = await import("@/lib/prisma");
  const release = await prisma.policyRelease.findFirst({
    orderBy: { publishedAt: "desc" },
    select: { version: true },
  });
  const value = release?.version ?? FALLBACK_POLICY_VERSION;
  cachedVersion = { value, at: Date.now() };
  return value;
}

export function renderPolicyBody(body: string): string {
  return body
    .split(/\n{2,}/)
    .map((paragraph) => paragraph.trim())
    .filter(Boolean)
    .map(
      (paragraph) => `<p>${escapeHtml(paragraph).replace(/\n/g, "<br />")}</p>`,
    )
    .join("");
}

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

export const legalAcceptanceSchema = z.object({
  acceptTerms: z.literal(true, {
    error: "Accept the Terms and Privacy Policy to continue.",
  }),
});
