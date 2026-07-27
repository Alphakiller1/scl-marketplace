import "server-only";

import { CURRENT_POLICY_VERSION } from "@/lib/legal";
import { POLICY_METADATA, type PolicySlugKey } from "@/lib/policy-metadata";

const DEFAULT_POLICY_BODIES: Record<PolicySlugKey, string> = {
  TERMS: `By accessing or using Sports Capper Leaderboard ("SCL"), you agree to these Terms. SCL is a performance-tracking and discovery platform for sports handicappers. SCL is not a sportsbook, does not accept wagers, and does not process payments for picks or subscriptions.

You are responsible for your account credentials and for all activity under your account. You agree to provide accurate information, comply with applicable laws, and not misuse the service (including attempts to manipulate records, scrape data without permission, or harass other users).

Handicapper records, ranks, and statistics reflect data tracked on SCL under our published rules. Past performance does not guarantee future results. Verified and graded labels describe our process, not a promise of profit.

Cappers may link to third-party storefronts for packages or subscriptions. Checkout, billing, refunds, and fulfillment are handled solely by those third parties. SCL may receive affiliate compensation when a transaction is attributed to an SCL tracking link under that storefront's rules. SCL does not guarantee third-party offers.

We may suspend or terminate accounts that violate these Terms or pose a risk to platform integrity. We may update these Terms; material changes will be reflected on this page with a revised effective date.

Effective date: July 2026.`,
  PRIVACY: `SCL collects information needed to operate your account, display public capper records, and maintain platform security. This typically includes your email, username, profile details, tracked plays, and technical logs (IP address, browser type, timestamps).

When you use package tracking links, we may record limited referral data (such as click time and referring page) so SCL can operate attribution under the linked storefront's rules. We do not sell your personal information.

We use service providers (hosting, email, analytics) that process data on our behalf under contractual safeguards. We retain account data while your account is active and for a reasonable period afterward for legal and security purposes.

Depending on your location, you may request access, correction, or deletion of your account data by contacting support. Some records may be retained where required for fraud prevention, dispute resolution, or legal compliance.

Effective date: July 2026.`,
  DISCLAIMER: `All content on SCL is for informational and entertainment purposes only. Nothing on this site constitutes legal, financial, or betting advice. You are solely responsible for your wagering decisions and compliance with laws in your jurisdiction.

SCL is not a sportsbook and does not accept or facilitate wagers. Handicapper records, leaderboards, and pick cards reflect tracked results under SCL's published rules. Past results do not guarantee future performance. Verified labels describe our logging process, not outcome certainty.

Package links may direct you to third-party storefronts. SCL does not control those sites, their pricing, or fulfillment. Any affiliate relationship is disclosed at the point of outbound linking.

Effective date: July 2026.`,
  RESPONSIBLE_GAMING: `Sports betting should be entertainment, not a source of income. Only wager what you can afford to lose. SCL provides performance tracking and informational tools — not betting advice, picks to tail blindly, or guarantees of profit.

If you or someone you know has a gambling problem, help is available. Call 1-800-GAMBLER for confidential support, 24/7 (US). You can also visit your state's responsible gaming resources for self-exclusion and counseling options.

SCL is not a sportsbook. We do not facilitate wagers or payments for bets. Third-party storefronts linked from capper profiles operate under their own terms and responsible-gaming policies.

Effective date: July 2026.`,
};

export function getDefaultPolicyDocument(slug: PolicySlugKey) {
  return {
    slug,
    title: POLICY_METADATA[slug].defaultTitle,
    body: DEFAULT_POLICY_BODIES[slug],
    version: CURRENT_POLICY_VERSION,
    publishedAt: null,
    updatedAt: null,
    persisted: false,
  };
}
