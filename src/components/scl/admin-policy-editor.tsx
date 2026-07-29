"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { savePolicyDocumentAction } from "@/lib/actions/policy.action";
import {
  POLICY_METADATA,
  POLICY_SLUGS,
  type PolicySlugKey,
} from "@/lib/policy-metadata";

export function AdminPolicyEditor({
  initial,
}: {
  initial: {
    slug: PolicySlugKey;
    title: string;
    body: string;
    version: string;
    persisted: boolean;
    updatedAtLabel: string | null;
    storageReady: boolean;
  };
}) {
  const router = useRouter();
  const [title, setTitle] = useState(initial.title);
  const [body, setBody] = useState(initial.body);
  const [version, setVersion] = useState(initial.version);
  const [pending, startTransition] = useTransition();

  function save() {
    startTransition(async () => {
      const result = await savePolicyDocumentAction({
        slug: initial.slug,
        title,
        body,
        version,
      });
      if (!result.ok) {
        toast.error(result.error);
        return;
      }
      toast.success("Policy published");
      router.refresh();
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
      <div className="grid gap-4 sm:grid-cols-[minmax(0,1fr)_12rem]">
        <div className="space-y-1.5">
          <Label htmlFor="policy-document">Policy document</Label>
          <select
            id="policy-document"
            value={initial.slug}
            onChange={(event) => {
              const slug = event.target.value as PolicySlugKey;
              router.push(`/admin/policies?document=${slug}`);
            }}
            className="border-input bg-background focus-visible:border-ring focus-visible:ring-ring/50 min-h-10 w-full rounded-lg border px-3 text-sm outline-none focus-visible:ring-3"
          >
            {POLICY_SLUGS.map((slug) => (
              <option key={slug} value={slug}>
                {POLICY_METADATA[slug].label}
              </option>
            ))}
          </select>
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="policy-version">Policy version</Label>
          <Input
            id="policy-version"
            value={version}
            onChange={(event) => setVersion(event.target.value)}
            placeholder="2026-07-26"
            required
          />
        </div>
      </div>

      {initial.slug === "TERMS" ? (
        <p className="border-border bg-surface-2 text-muted-foreground rounded-lg border p-3 text-sm leading-relaxed">
          Changing the Terms copy requires a new version. After publication,
          capper accounts must accept that version before using capper tools.
        </p>
      ) : null}

      {!initial.storageReady ? (
        <p
          className="border-border bg-surface-2 text-muted-foreground rounded-lg border p-3 text-sm leading-relaxed"
          role="status"
        >
          Policy storage is not installed yet. Apply the policy SQL patch before
          publishing; public pages will continue using bundled copy.
        </p>
      ) : null}

      <div className="space-y-1.5">
        <Label htmlFor="policy-title">Page title</Label>
        <Input
          id="policy-title"
          value={title}
          onChange={(event) => setTitle(event.target.value)}
          maxLength={120}
          required
        />
      </div>

      <div className="space-y-1.5">
        <div className="flex items-end justify-between gap-3">
          <Label htmlFor="policy-body">Published copy</Label>
          <span className="text-muted-foreground text-xs tabular-nums">
            {body.length.toLocaleString()} / 50,000
          </span>
        </div>
        <textarea
          id="policy-body"
          value={body}
          onChange={(event) => setBody(event.target.value)}
          rows={22}
          maxLength={50_000}
          required
          className="border-input bg-background placeholder:text-muted-foreground focus-visible:border-ring focus-visible:ring-ring/50 min-h-96 w-full resize-y rounded-lg border px-3 py-3 text-sm leading-relaxed outline-none focus-visible:ring-3"
        />
        <p className="text-muted-foreground text-xs leading-relaxed">
          Plain text only. Separate paragraphs with a blank line. HTML and
          Markdown are intentionally not executed.
        </p>
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <Button type="submit" disabled={pending || !initial.storageReady}>
          {pending ? "Publishing…" : "Publish revision"}
        </Button>
        <Button
          render={
            <Link
              href={POLICY_METADATA[initial.slug].path}
              target="_blank"
              rel="noreferrer"
            />
          }
          nativeButton={false}
          type="button"
          variant="outline"
          className="min-h-10"
        >
          Preview public page
        </Button>
        <span className="text-muted-foreground text-xs">
          {initial.persisted
            ? initial.updatedAtLabel
              ? `Last saved ${initial.updatedAtLabel}`
              : "Saved in the policy database"
            : "Currently using the bundled launch copy"}
        </span>
      </div>
    </form>
  );
}
