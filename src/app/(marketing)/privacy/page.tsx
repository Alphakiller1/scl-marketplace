import { LegalPage } from "@/components/legal-page";
import { PolicyText } from "@/components/policy-text";
import { getPublicPolicyDocument } from "@/lib/queries/policies";

export const metadata = { title: "Privacy Policy" };

export default async function PrivacyPage() {
  const policy = await getPublicPolicyDocument("PRIVACY");

  return (
    <LegalPage title={policy.title}>
      <PolicyText body={policy.body} />
    </LegalPage>
  );
}
