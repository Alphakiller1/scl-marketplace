"use client";

import { useMemo, useState } from "react";
import type { PolicyDocumentSlug } from "@prisma/client";
import { Save } from "lucide-react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { DEFAULT_POLICY_BODIES, POLICY_SLUG_LABEL } from "@/lib/legal";
import { publishPolicyReleaseAction } from "@/lib/actions/admin-policy.action";

const SLUGS: PolicyDocumentSlug[] = [
  "TERMS",
  "PRIVACY",
  "RESPONSIBLE_GAMING",
  "DISCLAIMER",
];

type DraftDocument = {
  slug: PolicyDocumentSlug;
  title: string;
  body: string;
};

export function PolicyReleaseEditor({
  currentVersion,
  initialDocuments,
}: {
  currentVersion: string;
  initialDocuments: DraftDocument[];
}) {
  const router = useRouter();
  const defaultVersion = useMemo(
    () => new Date().toISOString().slice(0, 10),
    [],
  );
  const [version, setVersion] = useState(defaultVersion);
  const [summary, setSummary] = useState("");
  const [requiresReacceptance, setRequiresReacceptance] = useState(true);
  const [documents, setDocuments] = useState<DraftDocument[]>(
    initialDocuments.length
      ? initialDocuments
      : SLUGS.map((slug) => ({
          slug,
          title: DEFAULT_POLICY_BODIES[slug].title,
          body: DEFAULT_POLICY_BODIES[slug].body,
        })),
  );
  const [pending, setPending] = useState(false);

  async function publish() {
    setPending(true);
    const result = await publishPolicyReleaseAction({
      version,
      summary,
      requiresReacceptance,
      documents,
    });
    setPending(false);
    if (!result.ok) {
      toast.error(result.error);
      return;
    }
    toast.success("Policy release published");
    router.refresh();
  }

  return (
    <div className="space-y-6">
      <div className="border-border bg-card grid gap-3 rounded-xl border p-4 sm:grid-cols-2">
        <label className="grid gap-1.5 text-sm">
          <span className="text-muted-foreground font-medium">
            Version label
          </span>
          <Input value={version} onChange={(e) => setVersion(e.target.value)} />
        </label>
        <label className="grid gap-1.5 text-sm sm:col-span-2">
          <span className="text-muted-foreground font-medium">
            Release summary
          </span>
          <Input
            value={summary}
            onChange={(e) => setSummary(e.target.value)}
            placeholder="Updated affiliate disclosure language"
          />
        </label>
        <label className="flex min-h-10 items-center gap-2 text-sm sm:col-span-2">
          <input
            type="checkbox"
            checked={requiresReacceptance}
            onChange={(e) => setRequiresReacceptance(e.target.checked)}
            className="accent-brand size-4"
          />
          <span>Require cappers to re-accept before using dashboard tools</span>
        </label>
        <p className="text-muted-foreground text-xs sm:col-span-2">
          Current published version: {currentVersion}
        </p>
      </div>

      {documents.map((doc, index) => (
        <section
          key={doc.slug}
          className="border-border bg-surface-2 space-y-3 rounded-xl border p-4"
        >
          <h3 className="font-semibold">{POLICY_SLUG_LABEL[doc.slug]}</h3>
          <label className="grid gap-1.5 text-sm">
            <span className="text-muted-foreground font-medium">Title</span>
            <Input
              value={doc.title}
              onChange={(event) =>
                setDocuments((prev) =>
                  prev.map((item, i) =>
                    i === index ? { ...item, title: event.target.value } : item,
                  ),
                )
              }
            />
          </label>
          <label className="grid gap-1.5 text-sm">
            <span className="text-muted-foreground font-medium">Body</span>
            <textarea
              value={doc.body}
              onChange={(event) =>
                setDocuments((prev) =>
                  prev.map((item, i) =>
                    i === index ? { ...item, body: event.target.value } : item,
                  ),
                )
              }
              rows={8}
              className="border-input bg-background focus-visible:border-ring focus-visible:ring-ring/50 rounded-lg border px-3 py-2 font-mono text-sm outline-none focus-visible:ring-3"
            />
          </label>
        </section>
      ))}

      <Button type="button" disabled={pending} onClick={() => void publish()}>
        <Save className="size-4" />
        Publish policy release
      </Button>
    </div>
  );
}
