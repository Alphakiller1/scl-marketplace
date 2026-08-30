import Link from "next/link";
import { History, Mail, Send, Workflow } from "lucide-react";

import { AdminEmailAutomationControls } from "@/components/scl/admin-email-automation-controls";
import { AdminEmailTemplateEditor } from "@/components/scl/admin-email-template-editor";
import { SectionHeader } from "@/components/scl/section";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { probeMailer } from "@/lib/email-deliverability";
import { EMAIL_TEMPLATES, isEmailTemplateSlug } from "@/lib/email-templates";
import {
  getEmailTemplateRevisions,
  getEmailTemplateWorkspace,
} from "@/lib/queries/email-templates";
import {
  getEmailAutomationActivity,
  getEmailAutomationConfig,
} from "@/lib/queries/email-automations";

export const metadata = { title: "Capper emails" };

export default async function AdminEmailsPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const params = await searchParams;
  const requested = typeof params.template === "string" ? params.template : "";
  const slug = isEmailTemplateSlug(requested) ? requested : "WELCOME";

  const [
    { templates, storageReady },
    revisions,
    automation,
    automationActivity,
    mailer,
  ] = await Promise.all([
    getEmailTemplateWorkspace(),
    getEmailTemplateRevisions(slug),
    getEmailAutomationConfig(),
    getEmailAutomationActivity(),
    probeMailer(),
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
          nativeButton={false}
        >
          <Send className="size-4" aria-hidden />
          Send mass email
        </Button>
      </Card>

      <section className="space-y-3" aria-labelledby="email-automation-title">
        <div className="flex items-start gap-3">
          <span className="bg-primary/10 text-primary rounded-lg p-2">
            <Workflow className="size-5" aria-hidden />
          </span>
          <div>
            <h2 id="email-automation-title" className="text-lg font-semibold">
              Automated follow-ups
            </h2>
            <p className="text-muted-foreground mt-1 text-sm leading-relaxed">
              Choose who receives each one-time lifecycle email and when. The
              wording remains editable in the templates below.
            </p>
          </div>
        </div>
        <Card className="p-4 sm:p-5">
          <AdminEmailAutomationControls
            initial={{
              verificationReminderEnabled:
                automation.verificationReminderEnabled,
              verificationReminderDelayHours:
                automation.verificationReminderDelayHours,
              verificationReminderActivatedAt:
                automation.verificationReminderActivatedAt?.toISOString() ??
                null,
              noPlaysNudgeEnabled: automation.noPlaysNudgeEnabled,
              noPlaysNudgeDelayHours: automation.noPlaysNudgeDelayHours,
              noPlaysNudgeActivatedAt:
                automation.noPlaysNudgeActivatedAt?.toISOString() ?? null,
              dailyLimit: automation.dailyLimit,
            }}
            storageReady={
              automation.storageReady && automationActivity.storageReady
            }
            sentRollingDay={automationActivity.sentRollingDay}
            capacityUsedRollingDay={automationActivity.capacityUsedRollingDay}
            mailer={{
              deliverable: mailer.deliverable,
              senderDomain: mailer.senderDomain,
              reason: mailer.reason,
            }}
          />
        </Card>
      </section>

      <section className="space-y-3" aria-labelledby="email-copy-title">
        <div>
          <h2 id="email-copy-title" className="text-lg font-semibold">
            Email copy and previews
          </h2>
          <p className="text-muted-foreground mt-1 text-sm">
            Select any email—including either automated follow-up—to edit its
            subject, message, button, and small print.
          </p>
        </div>
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
      </section>

      <section className="space-y-3">
        <div className="flex items-center gap-2">
          <History className="text-muted-foreground size-4" aria-hidden />
          <h2 className="text-lg font-semibold">Automation activity</h2>
        </div>
        {automationActivity.recentRuns.length ? (
          <div className="border-border divide-border divide-y overflow-hidden rounded-xl border">
            {automationActivity.recentRuns.map((run) => (
              <article
                key={run.id}
                className="bg-card flex flex-col gap-2 p-4 sm:flex-row sm:items-center sm:justify-between"
              >
                <div>
                  <p className="font-medium">
                    {run.status
                      .replaceAll("_", " ")
                      .toLowerCase()
                      .replace(/^./, (letter) => letter.toUpperCase())}
                  </p>
                  {run.error ? (
                    <p className="text-destructive mt-1 text-xs">{run.error}</p>
                  ) : null}
                  <p className="text-muted-foreground text-xs">
                    {run.sent} sent · {run.failed} failed · {run.skipped}{" "}
                    skipped
                  </p>
                </div>
                <p className="text-muted-foreground text-xs">
                  {run.startedAt.toLocaleString()}
                </p>
              </article>
            ))}
          </div>
        ) : (
          <p className="text-muted-foreground text-sm">
            No automated runs yet. Once enabled, the scheduler checks hourly.
          </p>
        )}
        {automationActivity.recentFailures.length ? (
          <div className="border-destructive/30 bg-destructive/5 rounded-xl border p-4">
            <h3 className="font-medium">Recent delivery failures</h3>
            <div className="mt-3 space-y-3">
              {automationActivity.recentFailures.map((failure) => (
                <div key={failure.id} className="text-sm">
                  <p className="font-medium">
                    {failure.automationKey === "VERIFY_EMAIL_REMINDER"
                      ? "Verification reminder"
                      : "No-plays follow-up"}{" "}
                    ·{" "}
                    {failure.user.username
                      ? `@${failure.user.username}`
                      : failure.user.email}
                  </p>
                  <p className="text-muted-foreground mt-0.5 text-xs">
                    {failure.lastError ?? "Provider rejected the message."}
                    {failure.failedAt
                      ? ` · ${failure.failedAt.toLocaleString()}`
                      : ""}
                  </p>
                </div>
              ))}
            </div>
          </div>
        ) : null}
      </section>

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
