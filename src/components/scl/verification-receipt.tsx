"use client";

import { BadgeCheck, CircleSlash } from "lucide-react";
import Link from "next/link";

import { PickTierBadge } from "@/components/scl/badges";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { cn } from "@/lib/utils";
import {
  isVerifiedTier,
  submissionReceiptCopy,
  type SubmissionReceipt,
} from "@/lib/verification";

/**
 * Compact post-submit confirmation — replaces success toast with a trust-forward
 * receipt. Copy is derived from server return facts via `submissionReceiptCopy`.
 */
export function VerificationReceipt({
  receipt,
  picksHref = "/dashboard/picks",
  className,
}: {
  receipt: SubmissionReceipt;
  picksHref?: string;
  className?: string;
}) {
  const copy = submissionReceiptCopy(receipt);
  const verifiedTone = copy.tone === "verified";
  const showTier =
    receipt.kind === "parlay" &&
    receipt.tiers.some((t) => !isVerifiedTier(t)) &&
    receipt.verifiedLegCount > 0;

  return (
    <Card
      role="status"
      aria-live="polite"
      className={cn(
        "scl-elevated mx-auto max-w-md space-y-4 border-2 p-5 sm:p-6",
        verifiedTone ? "border-live/40" : "border-border",
        className,
      )}
    >
      <div className="flex items-start gap-3">
        <div
          className={cn(
            "flex size-11 shrink-0 items-center justify-center rounded-xl",
            verifiedTone
              ? "bg-live/15 text-live"
              : "bg-surface-3 text-muted-foreground",
          )}
        >
          {verifiedTone ? (
            <BadgeCheck className="size-5" aria-hidden />
          ) : (
            <CircleSlash className="size-5" aria-hidden />
          )}
        </div>
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <p
              className={cn(
                "text-xs font-semibold tracking-wide uppercase",
                verifiedTone ? "text-live" : "text-muted-foreground",
              )}
            >
              {copy.headline}
            </p>
          </div>
          <p className="mt-1 text-lg font-bold break-words">{copy.summary}</p>
          {copy.context ? (
            <p className="text-muted-foreground text-sm">{copy.context}</p>
          ) : null}
        </div>
      </div>

      <ul className="text-muted-foreground space-y-1.5 text-sm">
        <li>{copy.statusLine}</li>
        <li>{copy.gradingLine}</li>
        {showTier ? (
          <li className="flex flex-wrap items-center gap-1.5 pt-0.5">
            <span className="sr-only">Leg tiers:</span>
            {receipt.tiers.map((tier, i) => (
              <PickTierBadge key={`${tier}-${i}`} tier={tier} />
            ))}
          </li>
        ) : null}
      </ul>

      <Button
        className="min-h-12 w-full text-base"
        render={<Link href={picksHref} />}
        nativeButton={false}
      >
        View My Picks
      </Button>
    </Card>
  );
}
