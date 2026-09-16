import { FileText } from "lucide-react";

import { AdminHonorsEditor } from "@/components/scl/admin-honors-editor";
import { AdminPolicyEditor } from "@/components/scl/admin-policy-editor";
import { PolicyDocumentSelect } from "@/components/scl/policy-document-select";
import { SectionHeader } from "@/components/scl/section";
import { Card } from "@/components/ui/card";
import { HONORS_DOCUMENT, parsePolicySlug } from "@/lib/policy-metadata";
import { getHonorsContent } from "@/lib/queries/honors-content";
import { getAdminPolicyWorkspace } from "@/lib/queries/policies";

export const metadata = { title: "Policy documents" };

export default async function AdminPoliciesPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const params = await searchParams;
  if (params.document === HONORS_DOCUMENT) {
    const content = await getHonorsContent();
    return (
      <div className="space-y-6">
        <SectionHeader
          icon={FileText}
          title="Policy Documents"
          subtitle="Edit the SCL Honors page. Award names, minimums, and periods are generated from the Honors rules and always match what is awarded."
        />
        <Card className="space-y-5 p-4 sm:p-5">
          <PolicyDocumentSelect value={HONORS_DOCUMENT} />
          <AdminHonorsEditor title={content.title} body={content.body} />
        </Card>
      </div>
    );
  }
  const slug = parsePolicySlug(params.document);
  const { document, revisions, storageReady } =
    await getAdminPolicyWorkspace(slug);

  return (
    <div className="space-y-6">
      <SectionHeader
        icon={FileText}
        title="Policy Documents"
        subtitle="Publish versioned legal, privacy, refund, and responsible-gaming copy with an immutable revision record"
      />

      <Card className="p-4 sm:p-5">
        <AdminPolicyEditor
          key={slug}
          initial={{
            slug,
            title: document.title,
            body: document.body,
            version: document.version,
            persisted: document.persisted,
            updatedAtLabel: document.updatedAt?.toLocaleString() ?? null,
            storageReady,
          }}
        />
      </Card>

      <section className="space-y-3">
        <h2 className="text-lg font-semibold">Recent revisions</h2>
        {revisions.length ? (
          <div className="border-border divide-border divide-y overflow-hidden rounded-xl border">
            {revisions.map((revision) => (
              <article
                key={revision.id}
                className="bg-card flex flex-col gap-1 p-4 sm:flex-row sm:items-center sm:justify-between"
              >
                <div>
                  <p className="font-medium">{revision.title}</p>
                  <p className="text-muted-foreground text-xs">
                    Version {revision.version}
                  </p>
                </div>
                <p className="text-muted-foreground text-xs sm:text-right">
                  {revision.createdAt.toLocaleString()}
                  <span className="block">
                    by{" "}
                    {revision.editedBy?.username
                      ? `@${revision.editedBy.username.replace(/^@/, "")}`
                      : revision.editedBy?.displayName || "Former admin"}
                  </span>
                </p>
              </article>
            ))}
          </div>
        ) : (
          <p className="border-border bg-card text-muted-foreground rounded-xl border p-4 text-sm">
            No database revisions yet. The public page is using the bundled
            launch copy.
          </p>
        )}
      </section>
    </div>
  );
}
