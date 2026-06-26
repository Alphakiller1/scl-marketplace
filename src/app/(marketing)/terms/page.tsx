import { LegalPage } from "@/components/legal-page";

export const metadata = { title: "Terms & Conditions" };

export default function TermsPage() {
  return (
    <LegalPage title="Terms & Conditions">
      <p>
        By using Sports Capper League (SCL) you agree to these terms. SCL is a
        performance-tracking and discovery platform for sports handicappers.
      </p>
      <p>
        SCL does not accept wagers and is not a sportsbook. Handicapper records
        are tracked for transparency; past performance does not guarantee future
        results.
      </p>
    </LegalPage>
  );
}
