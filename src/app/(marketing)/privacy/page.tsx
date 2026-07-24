import {
  generatePolicyMetadata,
  PolicyDocumentPage,
} from "@/components/scl/policy-document-page";

export async function generateMetadata() {
  return generatePolicyMetadata("PRIVACY");
}

export default function PrivacyPage() {
  return <PolicyDocumentPage slug="PRIVACY" />;
}
