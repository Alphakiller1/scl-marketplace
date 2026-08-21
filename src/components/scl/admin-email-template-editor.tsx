"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  saveEmailTemplateAction,
  sendEmailTemplatePreviewAction,
} from "@/lib/actions/email-template.action";
import type { EmailTemplateSlug } from "@/lib/email-templates";
import { cn } from "@/lib/utils";

type Draft = {
  slug: EmailTemplateSlug;
  subject: string;
  body: string;
  actionLabel: string;
  footnote: string;
};

export function AdminEmailTemplateEditor({
  slug,
  templates,
  initial,
  meta,
  persisted,
  updatedAtLabel,
  storageReady,
}: {
  slug: EmailTemplateSlug;
  templates: { slug: EmailTemplateSlug; label: string; persisted: boolean }[];
  initial: Draft;
  meta: {
    description: string;
    variables: { token: string; describes: string }[];
  };
  persisted: boolean;
  updatedAtLabel: string | null;
  storageReady: boolean;
}) {
  const router = useRouter();
  const [subject, setSubject] = useState(initial.subject);
  const [body, setBody] = useState(initial.body);
  const [actionLabel, setActionLabel] = useState(initial.actionLabel);
  const [footnote, setFootnote] = useState(initial.footnote);
  const [pending, startTransition] = useTransition();

  const draft = (): Draft => ({ slug, subject, body, actionLabel, footnote });
  const missingButton = !body.includes("{{button}}");

  function save() {
    startTransition(async () => {
      const result = await saveEmailTemplateAction(draft());
      if (!result.ok) {
        toast.error(result.error);
        return;
      }
      toast.success("Email copy saved");
      router.refresh();
    });
  }

  function sendPreview() {
    startTransition(async () => {
      const result = await sendEmailTemplatePreviewAction(draft());
      if (!result.ok) {
        toast.error(result.error);
        return;
      }
      toast.success("Preview sent to your admin address");
    });
  }

  return (
    <form
      className="space-y-5"
      onSubmit={(event) => {
        event.preventDefault();
        save();
      }}
    >
      <div className="flex flex-wrap gap-2">
        {templates.map((template) => (
          <Button
            key={template.slug}
            type="button"
            variant={template.slug === slug ? "default" : "outline"}
            className="min-h-10"
            render={<Link href={`/admin/emails?template=${template.slug}`} />}
            nativeButton={false}
          >
            {template.label}
            {template.persisted ? (
              <span className="text-muted-foreground ml-1.5 text-xs">
                edited
              </span>
            ) : null}
          </Button>
        ))}
      </div>

      <p className="text-muted-foreground text-sm leading-relaxed">
        {meta.description}
      </p>

      {!storageReady ? (
        <p className="border-border bg-surface-2 rounded-lg border p-3 text-sm leading-relaxed">
          Email storage is unavailable, so this is the copy built into the site
          and edits cannot be saved yet. Cappers are still receiving this
          wording — nothing is broken for them.
        </p>
      ) : null}

      <div className="space-y-2">
        <Label htmlFor="template-subject">Subject</Label>
        <Input
          id="template-subject"
          value={subject}
          onChange={(event) => setSubject(event.target.value)}
          maxLength={200}
        />
      </div>

      <div className="space-y-2">
        <Label htmlFor="template-body">Body</Label>
        <textarea
          id="template-body"
          value={body}
          onChange={(event: React.ChangeEvent<HTMLTextAreaElement>) =>
            setBody(event.target.value)
          }
          rows={18}
          maxLength={20_000}
          required
          className={cn(
            "border-input bg-background placeholder:text-muted-foreground focus-visible:border-ring focus-visible:ring-ring/50 min-h-80 w-full resize-y rounded-lg border px-3 py-3 font-mono text-sm leading-relaxed outline-none focus-visible:ring-3",
            missingButton && "border-destructive",
          )}
        />
        <div className="text-muted-foreground space-y-1 text-xs leading-relaxed">
          <p>
            Blank line starts a new paragraph. A line beginning with{" "}
            <code className="bg-surface-2 rounded px-1">#</code> is a heading.
          </p>
          <p>
            <code className="bg-surface-2 rounded px-1">{"{{button}}"}</code> on
            its own line is where the button goes. SCL fills in the link, so it
            always points to the right place — this one is required.
          </p>
          {meta.variables.map((variable) => (
            <p key={variable.token}>
              <code className="bg-surface-2 rounded px-1">
                {variable.token}
              </code>{" "}
              — {variable.describes}.
            </p>
          ))}
        </div>
        {missingButton ? (
          <p className="text-destructive text-xs">
            Add {"{{button}}"} where the button should appear. Without it the
            email has no link.
          </p>
        ) : null}
      </div>

      <div className="space-y-2">
        <Label htmlFor="template-action">Button label</Label>
        <Input
          id="template-action"
          value={actionLabel}
          onChange={(event) => setActionLabel(event.target.value)}
          maxLength={120}
        />
      </div>

      <div className="space-y-2">
        <Label htmlFor="template-footnote">Small print (optional)</Label>
        <textarea
          id="template-footnote"
          value={footnote}
          onChange={(event: React.ChangeEvent<HTMLTextAreaElement>) =>
            setFootnote(event.target.value)
          }
          rows={2}
          maxLength={2_000}
          className={
            "border-input bg-background placeholder:text-muted-foreground focus-visible:border-ring focus-visible:ring-ring/50 w-full resize-y rounded-lg border px-3 py-3 text-sm leading-relaxed outline-none focus-visible:ring-3"
          }
        />
        <p className="text-muted-foreground text-xs leading-relaxed">
          Shown in small grey text under the button — link expiry, or what to do
          if the email was unexpected.
        </p>
      </div>

      <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
        <p className="text-muted-foreground text-xs">
          {persisted && updatedAtLabel
            ? `Last edited ${updatedAtLabel}.`
            : "Not edited yet — this is the copy built into the site."}
        </p>
        <div className="flex flex-wrap gap-2">
          <Button
            type="button"
            variant="outline"
            className="min-h-10"
            onClick={sendPreview}
            disabled={pending || missingButton}
          >
            Send preview to me
          </Button>
          <Button type="submit" disabled={pending || missingButton}>
            {pending ? "Saving…" : "Save copy"}
          </Button>
        </div>
      </div>
    </form>
  );
}
