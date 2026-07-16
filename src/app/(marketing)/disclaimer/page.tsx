import { LegalPage } from "@/components/legal-page";

export const metadata = { title: "Disclaimer" };

export default function DisclaimerPage() {
  return (
    <LegalPage title="Disclaimer">
      <p>
        All content on SCL is for informational and entertainment purposes only.
        Nothing on this site constitutes legal, financial, or betting advice.
        You are solely responsible for your wagering decisions and compliance
        with laws in your jurisdiction.
      </p>
      <p>
        SCL is not a sportsbook and does not accept or facilitate wagers.
        Handicapper records, leaderboards, and pick cards reflect tracked
        results under SCL&apos;s published rules. Past results do not guarantee
        future performance. Verified labels describe our logging process, not
        outcome certainty.
      </p>
      <p>
        Package links may direct you to third-party storefronts. SCL does not
        control those sites, their pricing, or fulfillment. Any affiliate
        relationship is disclosed at the point of outbound linking.
      </p>
      <p>Effective date: July 2026.</p>
    </LegalPage>
  );
}
