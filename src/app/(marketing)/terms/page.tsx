import {
  generatePolicyMetadata,
  PolicyDocumentPage,
} from "@/components/scl/policy-document-page";

export async function generateMetadata() {
  return generatePolicyMetadata("TERMS");
}

export default function TermsPage() {
  return <PolicyDocumentPage slug="TERMS" />;
}
