"use client";

import { useState } from "react";
import { Send, Users } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  previewBroadcastAudienceAction,
  sendBroadcastAction,
} from "@/lib/actions/broadcast.action";
import type { BroadcastInput } from "@/lib/schemas/broadcast.schema";

type Audience = BroadcastInput["audience"];

const AUDIENCES: { value: Audience; label: string; hint: string }[] = [
  {
    value: "ALL_CAPPERS",
    label: "All cappers",
    hint: "Everyone active, minus opt-outs and unreachable addresses.",
  },
  {
    value: "VERIFIED_CAPPERS",
    label: "Verified only",
    hint: "Cappers who have confirmed their email.",
  },
  {
    value: "SINGLE_CAPPER",
    label: "One capper",
    hint: "A direct message about their account. Always delivers.",
  },
];

export function BroadcastComposer({
  cappers,
}: {
  cappers: { id: string; label: string }[];
}) {
  const [audience, setAudience] = useState<Audience>("SINGLE_CAPPER");
  const [userId, setUserId] = useState("");
  const [subject, setSubject] = useState("");
  const [body, setBody] = useState("");
  const [count, setCount] = useState<number | null>(null);
  const [busy, setBusy] = useState(false);

  const isMass = audience !== "SINGLE_CAPPER";

  async function preview() {
    setBusy(true);
    try {
      const result = await previewBroadcastAudienceAction({ audience, userId });
      if (!result.ok) {
        toast.error(result.error);
        return;
      }
      setCount(result.count);
    } finally {
      setBusy(false);
    }
  }

  async function send() {
    setBusy(true);
    try {
      const result = await sendBroadcastAction({
        audience,
        userId: userId || undefined,
        subject,
        body,
        // Sending to more people than the admin was shown is the one mistake
        // here that cannot be undone, so the confirmed count is sent back and
        // the server refuses if the roster moved.
        confirmRecipientCount: isMass && count !== null ? count : undefined,
      });
      if (!result.ok) {
        toast.error(result.error);
        setCount(null);
        return;
      }
      toast.success(`Sending to ${result.recipientCount}.`);
      setSubject("");
      setBody("");
      setCount(null);
    } finally {
      setBusy(false);
    }
  }

  const ready =
    subject.trim().length >= 3 &&
    body.trim().length >= 10 &&
    (!isMass || count !== null) &&
    (audience !== "SINGLE_CAPPER" || Boolean(userId));

  return (
    <Card className="space-y-4 p-4">
      <fieldset className="space-y-2">
        <legend className="text-sm font-medium">Audience</legend>
        <div className="flex flex-wrap gap-2">
          {AUDIENCES.map((a) => (
            <button
              key={a.value}
              type="button"
              onClick={() => {
                setAudience(a.value);
                setCount(null);
              }}
              aria-pressed={audience === a.value}
              className={`min-h-10 rounded-xl border px-3 text-sm transition-colors ${
                audience === a.value
                  ? "border-primary bg-primary text-primary-foreground"
                  : "border-border bg-surface-2 text-muted-foreground"
              }`}
            >
              {a.label}
            </button>
          ))}
        </div>
        <p className="text-muted-foreground text-xs">
          {AUDIENCES.find((a) => a.value === audience)?.hint}
        </p>
      </fieldset>

      {audience === "SINGLE_CAPPER" ? (
        <div className="space-y-1.5">
          <Label htmlFor="capper">Capper</Label>
          <select
            id="capper"
            value={userId}
            onChange={(e) => setUserId(e.target.value)}
            className="border-border bg-surface-2 min-h-10 w-full rounded-xl border px-3 text-sm"
          >
            <option value="">Choose a capper…</option>
            {cappers.map((c) => (
              <option key={c.id} value={c.id}>
                {c.label}
              </option>
            ))}
          </select>
        </div>
      ) : null}

      <div className="space-y-1.5">
        <Label htmlFor="subject">Subject</Label>
        <Input
          id="subject"
          value={subject}
          onChange={(e) => setSubject(e.target.value)}
          className="min-h-10"
          maxLength={150}
        />
      </div>

      <div className="space-y-1.5">
        <Label htmlFor="body">Message</Label>
        <textarea
          id="body"
          value={body}
          onChange={(e) => setBody(e.target.value)}
          rows={8}
          maxLength={10000}
          className="border-border bg-surface-2 w-full rounded-xl border p-3 text-sm leading-relaxed"
        />
        <p className="text-muted-foreground text-xs">
          Plain text. Blank lines become paragraphs.
          {isMass ? " An unsubscribe link is added automatically." : ""}
        </p>
      </div>

      <div className="flex flex-wrap items-center gap-2">
        {isMass ? (
          <Button
            type="button"
            variant="outline"
            className="min-h-10"
            disabled={busy}
            onClick={() => void preview()}
          >
            <Users className="size-4" aria-hidden />
            {count === null ? "Check who this reaches" : "Re-check"}
          </Button>
        ) : null}

        <Button
          type="button"
          className="min-h-10"
          disabled={busy || !ready}
          onClick={() => void send()}
        >
          <Send className="size-4" aria-hidden />
          {isMass && count !== null ? `Send to ${count}` : "Send"}
        </Button>

        {isMass && count !== null ? (
          <p className="text-muted-foreground text-xs">
            {count} recipient{count === 1 ? "" : "s"} after opt-outs and
            unreachable addresses.
          </p>
        ) : null}
      </div>
    </Card>
  );
}
