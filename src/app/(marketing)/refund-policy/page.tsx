import { LegalPage } from "@/components/legal-page";
import { PolicyText } from "@/components/policy-text";
import { getPublicPolicyDocument } from "@/lib/queries/policies";

export const metadata = { title: "Refund Policy" };

export default async function RefundPolicyPage() {
  const policy = await getPublicPolicyDocument("REFUND");

  return (
    <LegalPage title={policy.title}>
      <PolicyText body={policy.body} />
    </LegalPage>
  );
}
