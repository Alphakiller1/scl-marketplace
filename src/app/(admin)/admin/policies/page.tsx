import { FileText } from "lucide-react";

import { PolicyReleaseEditor } from "@/components/scl/policy-release-editor";
import { SectionHeader } from "@/components/scl/section";
import { getCurrentPolicyVersion } from "@/lib/legal";
import {
  getLatestPolicyReleaseForAdmin,
  getPolicyReleaseHistory,
} from "@/lib/queries/policies";

export const metadata = { title: "Policies" };

export default async function AdminPoliciesPage() {
  const [currentVersion, latest, history] = await Promise.all([
    getCurrentPolicyVersion(),
    getLatestPolicyReleaseForAdmin(),
    getPolicyReleaseHistory(),
  ]);

  const initialDocuments =
    latest?.documents.map((doc) => ({
      slug: doc.slug,
      title: doc.title,
      body: doc.body,
    })) ?? [];

  return (
    <div className="space-y-8">
      <SectionHeader
        icon={FileText}
        title="Policy CMS"
        subtitle="Publish versioned Terms, Privacy, Responsible Gaming, and Disclaimer documents"
      />

      <PolicyReleaseEditor
        currentVersion={currentVersion}
        initialDocuments={initialDocuments}
      />

      <section className="space-y-4">
        <h2 className="text-sm font-semibold uppercase">Release history</h2>
        {history.length ? (
          <div className="border-border divide-border divide-y overflow-hidden rounded-xl border">
            {history.map((release) => (
              <article key={release.id} className="bg-card p-4 text-sm">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <p className="font-semibold">Version {release.version}</p>
                  <span className="text-muted-foreground text-xs">
                    {release.publishedAt.toLocaleString()}
                  </span>
                </div>
                {release.summary ? (
                  <p className="text-muted-foreground mt-1">
                    {release.summary}
                  </p>
                ) : null}
                <p className="text-muted-foreground mt-2 text-xs">
                  {release.requiresReacceptance
                    ? "Re-acceptance required"
                    : "Informational update only"}{" "}
                  · {release._count.documents} documents · Published by{" "}
                  {release.publishedBy.username
                    ? `@${release.publishedBy.username.replace(/^@/, "")}`
                    : (release.publishedBy.displayName ?? "admin")}
                </p>
              </article>
            ))}
          </div>
        ) : (
          <p className="text-muted-foreground text-sm">
            No published releases yet. Public pages use the built-in fallback
            copy until the first release is published.
          </p>
        )}
      </section>
    </div>
  );
}
