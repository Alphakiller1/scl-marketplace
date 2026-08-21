import Link from "next/link";
import { Mail, Send } from "lucide-react";

import { AdminEmailTemplateEditor } from "@/components/scl/admin-email-template-editor";
import { SectionHeader } from "@/components/scl/section";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { EMAIL_TEMPLATES, isEmailTemplateSlug } from "@/lib/email-templates";
import {
  getEmailTemplateRevisions,
  getEmailTemplateWorkspace,
} from "@/lib/queries/email-templates";

export const metadata = { title: "Capper emails" };

export default async function AdminEmailsPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const params = await searchParams;
  const requested = typeof params.template === "string" ? params.template : "";
  const slug = isEmailTemplateSlug(requested) ? requested : "WELCOME";

  const [{ templates, storageReady }, revisions] = await Promise.all([
    getEmailTemplateWorkspace(),
    getEmailTemplateRevisions(slug),
  ]);
  const active = templates.find((template) => template.slug === slug);
  if (!active) return null;

  return (
    <div className="space-y-6">
      <SectionHeader
        icon={Mail}
        title="Capper Emails"
        subtitle="Edit the wording of the emails cappers receive. Links and buttons are supplied by SCL, so copy changes cannot break them."
      />

      <Card className="flex flex-col gap-4 p-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="min-w-0">
          <h2 className="font-semibold">Send an announcement</h2>
          <p className="text-muted-foreground mt-1 text-sm leading-relaxed">
            Email the active capper roster privately in Resend batches of up to
            100, with opt-outs and unreachable addresses removed.
          </p>
        </div>
        <Button
          className="min-h-10 shrink-0"
          render={<Link href="/admin/messages" />}
        >
          <Send className="size-4" aria-hidden />
          Send mass email
        </Button>
      </Card>

      <Card className="p-4 sm:p-5">
        <AdminEmailTemplateEditor
          key={slug}
          slug={slug}
          templates={templates.map((template) => ({
            slug: template.slug,
            label: EMAIL_TEMPLATES[template.slug].label,
            persisted: template.persisted,
          }))}
          initial={{
            slug: active.slug,
            subject: active.subject,
            body: active.body,
            actionLabel: active.actionLabel,
            footnote: active.footnote,
          }}
          meta={{
            description: EMAIL_TEMPLATES[slug].description,
            variables: [...EMAIL_TEMPLATES[slug].variables],
          }}
          persisted={active.persisted}
          updatedAtLabel={active.updatedAt?.toLocaleString() ?? null}
          storageReady={storageReady}
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
                <div className="min-w-0">
                  <p className="truncate font-medium">{revision.subject}</p>
                  <p className="text-muted-foreground text-xs">
                    {revision.editedBy?.username
                      ? `@${revision.editedBy.username}`
                      : (revision.editedBy?.email ?? "Unknown editor")}
                  </p>
                </div>
                <p className="text-muted-foreground text-xs sm:text-right">
                  {revision.createdAt.toLocaleString()}
                </p>
              </article>
            ))}
          </div>
        ) : (
          <p className="text-muted-foreground text-sm">
            No edits yet — cappers are receiving the copy built into the site.
          </p>
        )}
      </section>
    </div>
  );
}
