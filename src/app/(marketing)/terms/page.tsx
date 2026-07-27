import { LegalPage } from "@/components/legal-page";
import { PolicyText } from "@/components/policy-text";
import { getPublicPolicyDocument } from "@/lib/queries/policies";

export const metadata = { title: "Terms & Conditions" };

export default async function TermsPage() {
  const policy = await getPublicPolicyDocument("TERMS");

  return (
    <LegalPage title={policy.title}>
      <PolicyText body={policy.body} />
    </LegalPage>
  );
}
