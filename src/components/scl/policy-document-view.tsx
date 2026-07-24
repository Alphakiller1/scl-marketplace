import type { PublishedPolicyDocument } from "@/lib/queries/policies";
import { renderPolicyBody } from "@/lib/legal";

export function PolicyDocumentView({
  document,
}: {
  document: PublishedPolicyDocument;
}) {
  return (
    <div className="mx-auto max-w-3xl px-4 py-12 sm:px-6">
      <p className="text-muted-foreground text-xs font-semibold uppercase">
        Policy version {document.version}
        {document.publishedAt
          ? ` · Published ${document.publishedAt.toLocaleDateString()}`
          : ""}
      </p>
      <h1 className="mt-2 text-3xl font-bold tracking-tight">
        {document.title}
      </h1>
      <div
        className="text-muted-foreground mt-6 space-y-4 text-sm leading-relaxed"
        dangerouslySetInnerHTML={{ __html: renderPolicyBody(document.body) }}
      />
    </div>
  );
}
