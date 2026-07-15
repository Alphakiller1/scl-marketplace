"use client";

import Link from "next/link";

import { PickTierBadge } from "@/components/scl/badges";
import { ReceiptStack } from "@/components/scl/receipt-stack";
import { Ticket } from "@/components/scl/ticket";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { formatOdds, formatUnits } from "@/lib/format";
import { americanToDecimal } from "@/lib/odds";
import {
  isVerifiedTier,
  submissionReceiptCopy,
  type SubmissionReceipt,
} from "@/lib/verification";

const PINK_CTA =
  "border-[color:var(--scl-pink)] bg-[color:var(--scl-pink)] text-[color:var(--scl-pink-ink)] hover:bg-[color:var(--scl-pink-deep)] hover:text-[color:var(--scl-pink-ink)]";

/**
 * Post-submit confirmation — signature Ticket performing SCL's trust model.
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
  if (receipt.kind === "bulk") {
    return (
      <ReceiptStack
        receipt={receipt}
        picksHref={picksHref}
        className={className}
      />
    );
  }

  const copy = submissionReceiptCopy(receipt);
  const verifiedTone = copy.tone === "verified";
  const showTier =
    receipt.kind === "parlay" &&
    receipt.tiers.some((t) => !isVerifiedTier(t)) &&
    receipt.verifiedLegCount > 0;

  const legs = receipt.kind === "parlay" ? receipt.legCount : 1;
  const oddsAmerican =
    receipt.kind === "parlay"
      ? receipt.combinedOddsAmerican
      : receipt.oddsAmerican;
  const selectionTitle =
    receipt.kind === "parlay"
      ? `${receipt.legCount}-Leg Parlay`
      : receipt.selection;
  const eventLine =
    receipt.kind === "parlay"
      ? copy.statusLine
      : [receipt.market, copy.statusLine].filter(Boolean).join(" · ");

  const stake =
    receipt.units != null ? formatUnits(receipt.units, true, false) : "—";
  const toWin =
    receipt.toWinUnits != null
      ? formatUnits(receipt.toWinUnits, true, false)
      : receipt.units != null
        ? formatUnits(
            receipt.units * (americanToDecimal(oddsAmerican) - 1),
            true,
            false,
          )
        : "—";

  return (
    <div className={cn("mx-auto max-w-md space-y-3", className)}>
      <Ticket
        selectionTitle={selectionTitle}
        eventLine={eventLine}
        legs={legs}
        odds={formatOdds(oddsAmerican)}
        stake={stake}
        toWin={toWin}
        capturedAt={receipt.capturedAt}
        status={verifiedTone ? "verified" : "muted"}
        footerAction={
          <div className="space-y-3">
            {showTier ? (
              <div className="flex flex-wrap items-center gap-1.5">
                <span className="sr-only">Leg tiers:</span>
                {receipt.tiers.map((tier, i) => (
                  <PickTierBadge key={`${tier}-${i}`} tier={tier} />
                ))}
              </div>
            ) : null}
            <p className="text-muted-foreground text-sm">{copy.gradingLine}</p>
            {receipt.kind === "straight" && receipt.moveNote ? (
              <p className="scl-data text-muted-foreground text-[0.65rem] tracking-[0.08em] uppercase">
                {receipt.moveNote}
              </p>
            ) : null}
            {receipt.kind === "parlay" && receipt.moveNotes?.length ? (
              <ul className="space-y-1">
                {receipt.moveNotes.map((note) => (
                  <li
                    key={note}
                    className="scl-data text-muted-foreground text-[0.65rem] tracking-[0.08em] uppercase"
                  >
                    {note}
                  </li>
                ))}
              </ul>
            ) : null}
            <Button
              className={`min-h-12 w-full text-base ${PINK_CTA}`}
              render={<Link href={picksHref} />}
              nativeButton={false}
            >
              View My Picks
            </Button>
          </div>
        }
      />
    </div>
  );
}
