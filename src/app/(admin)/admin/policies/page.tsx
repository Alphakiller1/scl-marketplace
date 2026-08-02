import { FileText } from "lucide-react";

import { AdminPolicyEditor } from "@/components/scl/admin-policy-editor";
import { SectionHeader } from "@/components/scl/section";
import { Card } from "@/components/ui/card";
import { parsePolicySlug } from "@/lib/policy-metadata";
import { getAdminPolicyWorkspace } from "@/lib/queries/policies";

export const metadata = { title: "Policy documents" };

export default async function AdminPoliciesPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const params = await searchParams;
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
