"use client";

import { useState } from "react";
import { Copy, KeyRound } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { issueAccountClaimLinkAction } from "@/lib/actions/account-claim.action";

/**
 * Hands a capper their first set of credentials.
 *
 * Accounts carried over from the previous platform have no password, and the
 * ones imported without a real address (`@legacy.scl`) can't be reached by the
 * self-serve reset either — so the link is shown here for an admin to pass on
 * directly. Without this, those cappers have no route into their own record.
 */
export function AccountClaimControl({
  userId,
  unclaimed,
}: {
  userId: string;
  unclaimed: boolean;
}) {
  const [pending, setPending] = useState(false);
  const [link, setLink] = useState<string | null>(null);

  async function issue() {
    setPending(true);
    setLink(null);
    try {
      const result = await issueAccountClaimLinkAction({ userId });
      if (!result.ok) {
        toast.error(result.error);
        return;
      }
      if (result.delivered) {
        toast.success(`Claim link emailed to ${result.email}`);
        return;
      }
      setLink(result.link ?? null);
      toast.success("Claim link ready — copy it and send it to the capper");
    } catch {
      toast.error("Couldn't issue a claim link. Try again.");
    } finally {
      setPending(false);
    }
  }

  async function copy() {
    if (!link) return;
    try {
      await navigator.clipboard.writeText(link);
      toast.success("Claim link copied");
    } catch {
      toast.error("Copy failed — select the link and copy it manually.");
    }
  }

  return (
    <div className="space-y-2">
      <div className="flex flex-wrap items-center gap-2">
        <Button
          type="button"
          size="sm"
          variant="outline"
          className="min-h-10"
          disabled={pending}
          onClick={() => void issue()}
        >
          <KeyRound className="size-4" aria-hidden />
          {pending
            ? "Issuing…"
            : unclaimed
              ? "Issue claim link"
              : "Issue password reset link"}
        </Button>
        <p className="text-muted-foreground text-xs">
          {unclaimed
            ? "No password set — this capper cannot sign in yet."
            : "Single-use link, expires in one hour."}
        </p>
      </div>

      {link ? (
        <div className="border-border bg-surface-2 space-y-2 rounded-lg border p-3">
          <p className="text-muted-foreground text-xs">
            Email delivery is unavailable for this account. Send this single-use
            link to the capper directly — it expires in one hour.
          </p>
          <div className="flex items-start gap-2">
            <code className="min-w-0 flex-1 text-xs break-all">{link}</code>
            <Button
              type="button"
              size="icon"
              variant="ghost"
              className="size-10 shrink-0"
              aria-label="Copy claim link"
              onClick={() => void copy()}
            >
              <Copy className="size-4" aria-hidden />
            </Button>
          </div>
        </div>
      ) : null}
    </div>
  );
}
