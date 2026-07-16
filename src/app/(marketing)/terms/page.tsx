import { LegalPage } from "@/components/legal-page";

export const metadata = { title: "Terms & Conditions" };

export default function TermsPage() {
  return (
    <LegalPage title="Terms & Conditions">
      <p>
        By accessing or using Sports Capper Leaderboard (&quot;SCL&quot;), you
        agree to these Terms. SCL is a performance-tracking and discovery
        platform for sports handicappers. SCL is not a sportsbook, does not
        accept wagers, and does not process payments for picks or subscriptions.
      </p>
      <p>
        You are responsible for your account credentials and for all activity
        under your account. You agree to provide accurate information, comply
        with applicable laws, and not misuse the service (including attempts to
        manipulate records, scrape data without permission, or harass other
        users).
      </p>
      <p>
        Handicapper records, ranks, and statistics reflect data tracked on SCL
        under our published rules. Past performance does not guarantee future
        results. Verified and graded labels describe our process, not a promise
        of profit.
      </p>
      <p>
        Cappers may link to third-party storefronts for packages or
        subscriptions. Checkout, billing, refunds, and fulfillment are handled
        solely by those third parties. SCL may receive affiliate compensation
        when a transaction is attributed to an SCL tracking link under that
        storefront&apos;s rules. SCL does not guarantee third-party offers.
      </p>
      <p>
        We may suspend or terminate accounts that violate these Terms or pose a
        risk to platform integrity. We may update these Terms; material changes
        will be reflected on this page with a revised effective date.
      </p>
      <p>Effective date: July 2026.</p>
    </LegalPage>
  );
}
