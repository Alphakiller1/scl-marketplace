"use client";

import { useEffect, useMemo, useRef, useState, useTransition } from "react";
import type { StoreProvider, StorefrontMessageSender } from "@prisma/client";
import { MessageSquare } from "lucide-react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { sendStorefrontMessageAction } from "@/lib/actions/storefront-message.action";
import { providerLabel } from "@/lib/store-connection";
import { cn } from "@/lib/utils";

type Message = {
  id: string;
  body: string;
  senderRole: StorefrontMessageSender;
  createdAt: string;
  sender: {
    displayName: string | null;
    username: string | null;
    email: string;
  };
};

function senderLabel(message: Message): string {
  if (message.senderRole === "ADMIN") {
    return (
      message.sender.displayName?.trim() ||
      (message.sender.username
        ? `@${message.sender.username.replace(/^@/, "")}`
        : "SCL Team")
    );
  }
  return (
    message.sender.displayName?.trim() ||
    (message.sender.username
      ? `@${message.sender.username.replace(/^@/, "")}`
      : message.sender.email)
  );
}

function adminQuickReplies(provider?: StoreProvider | null): string[] {
  if (provider === "WHOP") {
    return [
      "Thanks for submitting your Whop setup — we're reviewing your affiliate connection now.",
      "Please confirm Sports Cappers Leaderboard was added as an affiliate on Whop.",
      "Your Whop packages are approved and will go live on your SCL profile shortly.",
    ];
  }
  if (provider === "WINIBLE") {
    return [
      "Thanks for submitting your Winible affiliate request — we're accepting the invite now.",
      "Please send your Winible package checkout links when ready.",
      "Your Winible packages are approved and will go live on your SCL profile shortly.",
    ];
  }
  return [
    "Thanks for reaching out — we're reviewing your storefront setup.",
    "Could you share any missing package or affiliate details?",
  ];
}

export function StorefrontConversationPanel({
  storeConnectionId,
  viewer,
  messages,
  provider,
  capperUsername,
  highlighted = false,
}: {
  storeConnectionId: string;
  viewer: "admin" | "capper";
  messages: Message[];
  provider?: StoreProvider | null;
  capperUsername?: string | null;
  highlighted?: boolean;
}) {
  const router = useRouter();
  const bottomRef = useRef<HTMLDivElement>(null);
  const [body, setBody] = useState("");
  const [pending, startTransition] = useTransition();
  const quickReplies = useMemo(
    () => (viewer === "admin" ? adminQuickReplies(provider) : []),
    [viewer, provider],
  );

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth", block: "end" });
  }, [messages.length]);

  function send() {
    const trimmed = body.trim();
    if (trimmed.length < 1) return;
    startTransition(async () => {
      try {
        const result = await sendStorefrontMessageAction({
          storeConnectionId,
          body: trimmed,
        });
        if (!result.ok) {
          toast.error(result.error);
          return;
        }
        setBody("");
        toast.success("Message sent");
        router.refresh();
      } catch {
        toast.error("Could not send the message. Try again.");
      }
    });
  }

  const platform = provider ? providerLabel(provider) : "storefront";

  return (
    <section
      id={`storefront-thread-${storeConnectionId}`}
      className={cn(
        "border-border flex flex-col overflow-hidden rounded-xl border",
        highlighted && "ring-brand/40 ring-2",
      )}
      aria-labelledby={`storefront-thread-title-${storeConnectionId}`}
    >
      <header className="border-border bg-surface-2 border-b px-4 py-3">
        <h3
          id={`storefront-thread-title-${storeConnectionId}`}
          className="flex items-center gap-2 text-sm font-semibold"
        >
          <MessageSquare className="size-4" aria-hidden />
          {viewer === "admin"
            ? "Conversation with capper"
            : "Messages from SCL"}
        </h3>
        <p className="text-muted-foreground mt-0.5 text-xs">
          {platform} setup
          {capperUsername ? ` · @${capperUsername.replace(/^@/, "")}` : ""}
          {viewer === "capper"
            ? " — reply here to keep everything in one thread."
            : " — messages also email the capper with a link back here."}
        </p>
      </header>

      <div
        className="bg-background max-h-80 min-h-40 flex-1 space-y-3 overflow-y-auto px-4 py-4"
        role="log"
        aria-live="polite"
        aria-relevant="additions"
      >
        {messages.length ? (
          messages.map((message) => {
            const fromViewer =
              (viewer === "admin" && message.senderRole === "ADMIN") ||
              (viewer === "capper" && message.senderRole === "CAPPER");
            return (
              <article
                key={message.id}
                className={cn(
                  "flex",
                  fromViewer ? "justify-end" : "justify-start",
                )}
              >
                <div
                  className={cn(
                    "max-w-[min(100%,28rem)] rounded-2xl px-3 py-2 text-sm leading-relaxed",
                    fromViewer
                      ? "bg-primary text-primary-foreground rounded-br-md"
                      : "bg-surface-2 text-foreground rounded-bl-md",
                  )}
                >
                  <p className="text-[0.65rem] font-semibold tracking-wide uppercase opacity-80">
                    {senderLabel(message)}
                  </p>
                  <p className="mt-1 whitespace-pre-wrap">{message.body}</p>
                  <p className="mt-1 text-[0.65rem] tabular-nums opacity-70">
                    {new Date(message.createdAt).toLocaleString()}
                  </p>
                </div>
              </article>
            );
          })
        ) : (
          <p className="text-muted-foreground text-sm leading-relaxed">
            {viewer === "admin"
              ? "No messages yet. Send the first note — the capper will see it here and get an email with a link to reply."
              : "No messages yet. When SCL reviews your affiliate setup, updates will appear here."}
          </p>
        )}
        <div ref={bottomRef} />
      </div>

      <div className="border-border bg-card space-y-3 border-t p-4">
        {quickReplies.length ? (
          <div className="flex flex-wrap gap-2">
            {quickReplies.map((reply) => (
              <button
                key={reply}
                type="button"
                disabled={pending}
                onClick={() => setBody(reply)}
                className="border-border bg-surface-2 hover:bg-surface-3 rounded-full border px-3 py-1.5 text-left text-xs leading-snug transition-colors"
              >
                {reply}
              </button>
            ))}
          </div>
        ) : null}
        <label
          htmlFor={`storefront-thread-compose-${storeConnectionId}`}
          className="sr-only"
        >
          {viewer === "admin" ? "Message to capper" : "Reply to SCL"}
        </label>
        <textarea
          id={`storefront-thread-compose-${storeConnectionId}`}
          value={body}
          onChange={(event) => setBody(event.target.value)}
          maxLength={4000}
          rows={3}
          disabled={pending}
          placeholder={
            viewer === "admin"
              ? "Write a message to the capper…"
              : "Reply to SCL about your storefront setup…"
          }
          className="border-input bg-background placeholder:text-muted-foreground focus-visible:border-ring focus-visible:ring-ring/50 min-h-20 w-full resize-y rounded-lg border px-3 py-2 text-sm outline-none focus-visible:ring-3"
        />
        <div className="flex justify-end">
          <Button
            type="button"
            size="sm"
            className="min-h-10"
            disabled={pending || body.trim().length < 1}
            onClick={send}
          >
            {pending
              ? "Sending…"
              : viewer === "admin"
                ? "Send to capper"
                : "Send reply"}
          </Button>
        </div>
      </div>
    </section>
  );
}
