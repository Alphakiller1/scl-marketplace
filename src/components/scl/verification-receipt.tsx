"use client";

import Link from "next/link";

import { PickTierBadge } from "@/components/scl/badges";
import { LeagueRef, TeamRef } from "@/components/scl/entity-marks";
import { ProofReceipt } from "@/components/scl/proof-receipt";
import { ReceiptStack } from "@/components/scl/receipt-stack";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { formatOdds, formatUnits } from "@/lib/format";
import { americanToDecimal } from "@/lib/odds";
import { deriveProofReceiptState } from "@/lib/proof-receipt";
import {
  isVerifiedTier,
  submissionReceiptCopy,
  type SubmissionReceipt,
} from "@/lib/verification";

const VIEW_PICKS_CTA = "scl-cta-brand";

/**
 * Post-submit confirmation — canonical ProofReceipt in expanded-paper density.
 */
export function VerificationReceipt({
  receipt,
  picksHref = "/dashboard/picks",
  onMakeAnotherSelection,
  className,
}: {
  receipt: SubmissionReceipt;
  picksHref?: string;
  onMakeAnotherSelection?: () => void;
  className?: string;
}) {
  if (receipt.kind === "bulk") {
    return (
      <ReceiptStack
        receipt={receipt}
        picksHref={picksHref}
        onMakeAnotherSelection={onMakeAnotherSelection}
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
  const statusBits =
    receipt.kind === "parlay"
      ? [copy.statusLine]
      : [receipt.market, copy.statusLine].filter(Boolean);
  const sport = receipt.kind === "straight" ? receipt.sport?.trim() || "" : "";
  const side = receipt.kind === "straight" ? receipt.side : null;

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

  const state = deriveProofReceiptState({
    outcome: "PENDING",
    verified: verifiedTone,
    capturing: false,
  });

  const moveNote =
    receipt.kind === "straight"
      ? receipt.moveNote
      : receipt.moveNotes?.join(" · ");

  return (
    <div className={cn("mx-auto max-w-md space-y-3", className)}>
      <ProofReceipt
        selectionTitle={selectionTitle}
        leadingMark={
          sport ? (
            <TeamRef name={side} sport={sport} size="md" knownOnly />
          ) : null
        }
        eventLine={
          <span className="inline-flex flex-wrap items-center gap-1.5 tracking-normal normal-case">
            {sport ? <LeagueRef sport={sport} /> : null}
            {statusBits.length ? (
              <span className="scl-data tracking-[0.06em] uppercase">
                {statusBits.join(" · ")}
              </span>
            ) : null}
          </span>
        }
        legs={legs}
        odds={formatOdds(oddsAmerican)}
        stake={stake}
        toWin={toWin}
        capturedAt={receipt.capturedAt}
        book={receipt.book}
        state={state}
        density="expanded-paper"
        settling
        statusNote={copy.gradingLine}
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
            {moveNote ? (
              <p className="scl-data text-muted-foreground text-[0.65rem] tracking-[0.08em] uppercase">
                {moveNote}
              </p>
            ) : null}
            <Button
              className={`min-h-12 w-full text-base ${VIEW_PICKS_CTA}`}
              render={<Link href={picksHref} />}
              nativeButton={false}
            >
              View My Picks
            </Button>
            {onMakeAnotherSelection ? (
              <Button
                type="button"
                variant="outline"
                className="min-h-12 w-full text-base"
                onClick={onMakeAnotherSelection}
              >
                Make Another Selection
              </Button>
            ) : null}
          </div>
        }
      />
    </div>
  );
}
