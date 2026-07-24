import {
  generatePolicyMetadata,
  PolicyDocumentPage,
} from "@/components/scl/policy-document-page";

export async function generateMetadata() {
  return generatePolicyMetadata("RESPONSIBLE_GAMING");
}

export default function ResponsibleGamingPage() {
  return <PolicyDocumentPage slug="RESPONSIBLE_GAMING" />;
}
