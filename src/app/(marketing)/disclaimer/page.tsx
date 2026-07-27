import { LegalPage } from "@/components/legal-page";
import { PolicyText } from "@/components/policy-text";
import { getPublicPolicyDocument } from "@/lib/queries/policies";

export const metadata = { title: "Disclaimer" };

export default async function DisclaimerPage() {
  const policy = await getPublicPolicyDocument("DISCLAIMER");

  return (
    <LegalPage title={policy.title}>
      <PolicyText body={policy.body} />
    </LegalPage>
  );
}
