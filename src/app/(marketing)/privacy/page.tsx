import { LegalPage } from "@/components/legal-page";

export const metadata = { title: "Privacy Policy" };

export default function PrivacyPage() {
  return (
    <LegalPage title="Privacy Policy">
      <p>
        We collect the information needed to operate your SCL account and track
        capper performance. We do not sell your personal data.
      </p>
      <p>
        You can request access to or deletion of your account data by contacting
        support.
      </p>
    </LegalPage>
  );
}
