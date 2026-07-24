"use client";

import { useState } from "react";

import type { BulkEmailAudience } from "@prisma/client";

import { Send } from "lucide-react";

import { useRouter } from "next/navigation";

import { toast } from "sonner";

import { Button } from "@/components/ui/button";

import { Input } from "@/components/ui/input";

import { sendBulkCapperEmailAction } from "@/lib/actions/admin-communications.action";

import {
  BULK_EMAIL_AUDIENCE_LABEL,
  CAPPER_EMAIL_AUDIENCES,
} from "@/lib/schemas/admin-communications.schema";

export function BulkCapperEmailForm() {
  const router = useRouter();

  const [subject, setSubject] = useState("");

  const [bodyHtml, setBodyHtml] = useState("");

  const [audience, setAudience] = useState<BulkEmailAudience>("ACTIVE_CAPPERS");

  const [pending, setPending] = useState(false);

  async function send() {
    setPending(true);

    const result = await sendBulkCapperEmailAction({
      subject,

      bodyHtml,

      audience,
    });

    setPending(false);

    if (!result.ok) {
      toast.error(result.error);

      return;
    }

    toast.success(
      `Sent to ${result.recipients} capper(s): ${result.delivered} delivered, ${result.failed} failed`,
    );

    setSubject("");

    setBodyHtml("");

    router.refresh();
  }

  return (
    <div className="border-border bg-card space-y-4 rounded-xl border p-4">
      <div>
        <h3 className="font-semibold">Capper broadcast</h3>

        <p className="text-muted-foreground mt-1 text-sm">
          Operational email to capper storefront and account audiences.
        </p>
      </div>

      <label className="grid gap-1.5 text-sm">
        <span className="text-muted-foreground font-medium">Audience</span>

        <select
          value={audience}
          onChange={(event) =>
            setAudience(event.target.value as BulkEmailAudience)
          }
          className="border-input bg-background min-h-10 rounded-lg border px-2.5 text-sm"
        >
          {CAPPER_EMAIL_AUDIENCES.map((value) => (
            <option key={value} value={value}>
              {BULK_EMAIL_AUDIENCE_LABEL[value]}
            </option>
          ))}
        </select>
      </label>

      <label className="grid gap-1.5 text-sm">
        <span className="text-muted-foreground font-medium">Subject</span>

        <Input value={subject} onChange={(e) => setSubject(e.target.value)} />
      </label>

      <label className="grid gap-1.5 text-sm">
        <span className="text-muted-foreground font-medium">Message HTML</span>

        <textarea
          value={bodyHtml}
          onChange={(e) => setBodyHtml(e.target.value)}
          rows={10}
          placeholder="<p>Your storefront package links need a quick review...</p>"
          className="border-input bg-background rounded-lg border px-3 py-2 font-mono text-sm"
        />
      </label>

      <Button type="button" disabled={pending} onClick={() => void send()}>
        <Send className="size-4" />
        Send capper broadcast
      </Button>
    </div>
  );
}
