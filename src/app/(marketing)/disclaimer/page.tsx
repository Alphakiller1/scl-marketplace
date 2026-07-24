import {
  generatePolicyMetadata,
  PolicyDocumentPage,
} from "@/components/scl/policy-document-page";

export async function generateMetadata() {
  return generatePolicyMetadata("DISCLAIMER");
}

export default function DisclaimerPage() {
  return <PolicyDocumentPage slug="DISCLAIMER" />;
}
