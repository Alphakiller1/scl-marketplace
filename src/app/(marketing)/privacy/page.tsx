import { LegalPage } from "@/components/legal-page";

export const metadata = { title: "Privacy Policy" };

export default function PrivacyPage() {
  return (
    <LegalPage title="Privacy Policy">
      <p>
        SCL collects information needed to operate your account, display public
        capper records, and maintain platform security. This typically includes
        your email, username, profile details, tracked plays, and technical logs
        (IP address, browser type, timestamps).
      </p>
      <p>
        When you use package tracking links, we may record limited referral data
        (such as click time and referring page) so SCL can operate attribution
        under the linked storefront&apos;s rules. We do not sell your personal
        information.
      </p>
      <p>
        We use service providers (hosting, email, analytics) that process data
        on our behalf under contractual safeguards. We retain account data while
        your account is active and for a reasonable period afterward for legal
        and security purposes.
      </p>
      <p>
        Depending on your location, you may request access, correction, or
        deletion of your account data by contacting support. Some records may be
        retained where required for fraud prevention, dispute resolution, or
        legal compliance.
      </p>
      <p>Effective date: July 2026.</p>
    </LegalPage>
  );
}
