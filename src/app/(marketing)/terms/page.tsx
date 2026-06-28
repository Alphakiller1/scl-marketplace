import { LegalPage } from "@/components/legal-page";

export const metadata = { title: "Terms & Conditions" };

export default function TermsPage() {
  return (
    <LegalPage title="Terms & Conditions">
      <p>
        By using Sports Capper Leaderboard (SCL) you agree to these terms. SCL
        is a performance-tracking and discovery platform for sports
        handicappers.
      </p>
      <p>
        SCL does not accept wagers and is not a sportsbook. Handicapper records
        are tracked for transparency; past performance does not guarantee future
        results.
      </p>
      <p>
        Cappers decide which third-party packages SCL may market. Checkout,
        payment, subscriptions, and fulfillment are handled by the applicable
        third-party storefront. SCL may receive affiliate compensation when a
        transaction is attributed to an SCL tracking link under that
        storefront&apos;s rules.
      </p>
    </LegalPage>
  );
}
