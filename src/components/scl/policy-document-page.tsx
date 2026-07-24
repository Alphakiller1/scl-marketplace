import type { Metadata } from "next";

import { PolicyDocumentView } from "@/components/scl/policy-document-view";
import { getPublishedPolicyDocument } from "@/lib/queries/policies";

export async function generatePolicyMetadata(
  slug: Parameters<typeof getPublishedPolicyDocument>[0],
): Promise<Metadata> {
  const document = await getPublishedPolicyDocument(slug);
  return { title: document.title };
}

export async function PolicyDocumentPage({
  slug,
}: {
  slug: Parameters<typeof getPublishedPolicyDocument>[0];
}) {
  const document = await getPublishedPolicyDocument(slug);
  return <PolicyDocumentView document={document} />;
}
