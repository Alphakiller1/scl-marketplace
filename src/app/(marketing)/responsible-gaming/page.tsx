import { LegalPage } from "@/components/legal-page";

export const metadata = { title: "Responsible Gaming" };

export default function ResponsibleGamingPage() {
  return (
    <LegalPage title="Responsible Gaming">
      <p>
        Bet responsibly. Only wager what you can afford to lose. SCL provides
        information and performance tracking, not betting advice or guarantees.
      </p>
      <p>
        If gambling is affecting your life, call 1-800-GAMBLER for confidential
        help, available 24/7.
      </p>
    </LegalPage>
  );
}
