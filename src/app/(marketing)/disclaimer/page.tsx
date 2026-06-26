import { LegalPage } from "@/components/legal-page";

export const metadata = { title: "Disclaimer" };

export default function DisclaimerPage() {
  return (
    <LegalPage title="Disclaimer">
      <p>
        All content on SCL is for informational and entertainment purposes only
        and does not constitute betting or financial advice.
      </p>
      <p>
        Handicapper records reflect tracked results on this platform. Sports
        betting involves risk; you are responsible for your own decisions.
      </p>
    </LegalPage>
  );
}
