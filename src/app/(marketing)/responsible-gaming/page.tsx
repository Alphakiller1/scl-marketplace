import { LegalPage } from "@/components/legal-page";
import { PolicyText } from "@/components/policy-text";
import { getPublicPolicyDocument } from "@/lib/queries/policies";

export const metadata = { title: "Responsible Gaming" };

export default async function ResponsibleGamingPage() {
  const policy = await getPublicPolicyDocument("RESPONSIBLE_GAMING");

  return (
    <LegalPage title={policy.title}>
      <PolicyText body={policy.body} />
    </LegalPage>
  );
}
