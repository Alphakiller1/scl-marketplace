import { LegalPage } from "@/components/legal-page";

export const metadata = { title: "Privacy Policy" };

export default function PrivacyPage() {
  return (
    <LegalPage title="Privacy Policy">
      <p>
        We collect the information needed to operate your SCL account and track
        capper performance. Package links may record limited referral data such
        as the time and referring page so SCL can operate its tracking links. We
        do not sell your personal data.
      </p>
      <p>
        You can request access to or deletion of your account data by contacting
        support.
      </p>
    </LegalPage>
  );
}
