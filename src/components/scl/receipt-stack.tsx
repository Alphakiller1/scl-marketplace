"use client";

import Link from "next/link";

import { StatusBadge } from "@/components/scl/badges";
import { Ticket } from "@/components/scl/ticket";
import { Button } from "@/components/ui/button";
import { bookLabel, bookShort } from "@/lib/books";
import { formatOdds, formatUnits } from "@/lib/format";
import { cn } from "@/lib/utils";
import {
  isVerifiedTier,
  submissionReceiptCopy,
  type BulkSinglesReceipt,
  type StraightReceipt,
} from "@/lib/verification";

const PINK_CTA =
  "border-[color:var(--scl-pink)] bg-[color:var(--scl-pink)] text-[color:var(--scl-pink-ink)] hover:bg-[color:var(--scl-pink-deep)] hover:text-[color:var(--scl-pink-ink)]";

function CompactPickTicket({ pick }: { pick: StraightReceipt }) {
  const verified = isVerifiedTier(pick.tier);
  const book =
    pick.book != null
      ? `${bookShort(pick.book)} · ${bookLabel(pick.book)}`
      : null;
  const eventLine = [pick.market, book, pick.moveNote]
    .filter(Boolean)
    .join(" · ");
  const stake = pick.units != null ? formatUnits(pick.units, true, false) : "—";
  const toWin =
    pick.toWinUnits != null ? formatUnits(pick.toWinUnits, true, false) : "—";

  return (
    <div className="space-y-2">
      <div className="flex flex-wrap items-center gap-2 px-0.5">
        {pick.loggedPreGame ? <StatusBadge status="pre-game" /> : null}
      </div>
      <Ticket
        selectionTitle={pick.selection}
        eventLine={eventLine || null}
        legs={1}
        odds={formatOdds(pick.oddsAmerican)}
        stake={stake}
        toWin={toWin}
        capturedAt={pick.capturedAt}
        status={verified ? "verified" : "muted"}
        className="shadow-none"
      />
    </div>
  );
}

/**
 * Bulk-singles receipt stack (M5 §6.2) — header + N compact Tickets.
 * Partial batches show a muted suspended note; CTA still View My Picks.
 */
export function ReceiptStack({
  receipt,
  picksHref = "/dashboard/picks",
  className,
}: {
  receipt: BulkSinglesReceipt;
  picksHref?: string;
  className?: string;
}) {
  const copy = submissionReceiptCopy(receipt);

  return (
    <div className={cn("mx-auto max-w-md space-y-4", className)}>
      <div className="space-y-1">
        <p className="scl-eyebrow text-[color:var(--scl-muted-label)]">
          SCL · Pick Receipts
        </p>
        <h2 className="scl-display text-foreground text-xl font-bold tracking-tight uppercase">
          {copy.headline}
        </h2>
        <p className="scl-data text-muted-foreground text-sm">{copy.summary}</p>
        {receipt.suspendedCount > 0 ? (
          <p className="text-muted-foreground text-xs" role="status">
            {copy.statusLine}
          </p>
        ) : null}
      </div>

      <ul className="space-y-3">
        {receipt.picks.map((pick, i) => (
          <li key={`${pick.selection}-${pick.capturedAt}-${i}`}>
            <CompactPickTicket pick={pick} />
          </li>
        ))}
      </ul>

      <p className="text-muted-foreground text-sm">{copy.gradingLine}</p>
      <Button
        className={`min-h-12 w-full text-base ${PINK_CTA}`}
        render={<Link href={picksHref} />}
        nativeButton={false}
      >
        View My Picks
      </Button>
    </div>
  );
}
