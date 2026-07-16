import { LegalPage } from "@/components/legal-page";

export const metadata = { title: "Responsible Gaming" };

export default function ResponsibleGamingPage() {
  return (
    <LegalPage title="Responsible Gaming">
      <p>
        Sports betting should be entertainment, not a source of income. Only
        wager what you can afford to lose. SCL provides performance tracking and
        informational tools — not betting advice, picks to tail blindly, or
        guarantees of profit.
      </p>
      <p>
        If you or someone you know has a gambling problem, help is available.
        Call <strong>1-800-GAMBLER</strong> for confidential support, 24/7 (US).
        You can also visit your state&apos;s responsible gaming resources for
        self-exclusion and counseling options.
      </p>
      <p>
        SCL is not a sportsbook. We do not facilitate wagers or payments for
        bets. Third-party storefronts linked from capper profiles operate under
        their own terms and responsible-gaming policies.
      </p>
      <p>Effective date: July 2026.</p>
    </LegalPage>
  );
}
