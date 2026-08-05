"use client";

import { useMemo, useState, useTransition } from "react";
import type { StoreProvider } from "@prisma/client";
import { Mail } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { adminContactCapperAction } from "@/lib/actions/admin-outreach.action";
import { hasDeliverableEmail } from "@/lib/account-claim";
import { providerLabel } from "@/lib/store-connection";

function defaultOutreachSubject(provider?: StoreProvider | null): string {
  if (provider === "WHOP") return "Your Whop affiliate setup — next steps";
  if (provider === "WINIBLE")
    return "Your Winible affiliate setup — next steps";
  return "Message from Sports Cappers Leaderboard";
}

function defaultOutreachMessage(input: {
  provider?: StoreProvider | null;
  capperUsername: string | null;
}): string {
  const handle = input.capperUsername?.replace(/^@/, "");
  const greeting = handle ? `Hi @${handle},` : "Hi,";
  if (input.provider === "WHOP") {
    return `${greeting}

Thanks for submitting your Whop storefront setup on SCL. We're reviewing your affiliate relationship and will follow up if anything else is needed from your side.

— Sports Cappers Leaderboard`;
  }
  if (input.provider === "WINIBLE") {
    return `${greeting}

Thanks for submitting your Winible affiliate request on SCL. Once we've accepted the affiliate invite in Winible, we'll add your approved package links to your SCL profile.

— Sports Cappers Leaderboard`;
  }
  return `${greeting}



— Sports Cappers Leaderboard`;
}

export function AdminCapperOutreachPanel({
  userId,
  capperEmail,
  capperUsername,
  storeConnectionId,
  provider,
}: {
  userId: string;
  capperEmail: string;
  capperUsername: string | null;
  storeConnectionId?: string;
  provider?: StoreProvider | null;
}) {
  const deliverable = hasDeliverableEmail(capperEmail);
  const initialSubject = useMemo(
    () => defaultOutreachSubject(provider),
    [provider],
  );
  const initialMessage = useMemo(
    () => defaultOutreachMessage({ provider, capperUsername }),
    [provider, capperUsername],
  );
  const [subject, setSubject] = useState(initialSubject);
  const [message, setMessage] = useState(initialMessage);
  const [pending, startTransition] = useTransition();

  function send() {
    startTransition(async () => {
      try {
        const result = await adminContactCapperAction({
          userId,
          storeConnectionId,
          subject,
          message,
        });
        if (!result.ok) {
          toast.error(result.error);
          return;
        }
        toast.success(`Email sent to ${capperEmail}`);
      } catch {
        toast.error("Could not send the email. Try again.");
      }
    });
  }

  return (
    <div className="border-border space-y-3 rounded-xl border p-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h3 className="flex items-center gap-2 text-sm font-semibold">
            <Mail className="size-4" aria-hidden />
            Reach out to capper
          </h3>
          <p className="text-muted-foreground mt-1 text-xs break-all">
            {capperEmail}
            {capperUsername ? ` · @${capperUsername.replace(/^@/, "")}` : ""}
            {provider ? ` · ${providerLabel(provider)}` : ""}
          </p>
        </div>
        {!deliverable ? (
          <span className="bg-surface-3 text-muted-foreground rounded-md px-2 py-1 text-[0.65rem] font-semibold tracking-wide uppercase">
            Placeholder email
          </span>
        ) : null}
      </div>

      {!deliverable ? (
        <p className="text-muted-foreground text-sm leading-relaxed">
          This account uses a synthesized legacy address and cannot receive
          email. Copy any instructions and deliver them through another channel.
        </p>
      ) : (
        <>
          <div>
            <label
              htmlFor={`outreach-subject-${userId}`}
              className="text-sm font-semibold"
            >
              Subject
            </label>
            <Input
              id={`outreach-subject-${userId}`}
              value={subject}
              onChange={(event) => setSubject(event.target.value)}
              maxLength={120}
              disabled={pending}
              className="mt-1.5"
            />
          </div>
          <div>
            <label
              htmlFor={`outreach-message-${userId}`}
              className="text-sm font-semibold"
            >
              Message
            </label>
            <textarea
              id={`outreach-message-${userId}`}
              value={message}
              onChange={(event) => setMessage(event.target.value)}
              maxLength={4000}
              rows={6}
              disabled={pending}
              className="border-input bg-background placeholder:text-muted-foreground focus-visible:border-ring focus-visible:ring-ring/50 mt-1.5 min-h-32 w-full resize-y rounded-lg border px-3 py-2 text-sm outline-none focus-visible:ring-3"
            />
          </div>
          <div className="flex flex-wrap items-center justify-between gap-2">
            <p className="text-muted-foreground text-xs">
              Replies go to your admin email when Resend supports it.
            </p>
            <Button
              type="button"
              size="sm"
              className="min-h-10"
              disabled={
                pending ||
                subject.trim().length < 3 ||
                message.trim().length < 10
              }
              onClick={send}
            >
              {pending ? "Sending…" : "Send email"}
            </Button>
          </div>
        </>
      )}
    </div>
  );
}
