"use client";

import Link from "next/link";

import { StatusBadge } from "@/components/scl/badges";
import { BookMark } from "@/components/scl/book-mark";
import { LeagueRef, TeamRef } from "@/components/scl/entity-marks";
import { Ticket } from "@/components/scl/ticket";
import { Button } from "@/components/ui/button";
import { bookLabel } from "@/lib/books";
import { formatOdds, formatUnits } from "@/lib/format";
import { cn } from "@/lib/utils";
import {
  isVerifiedTier,
  submissionReceiptCopy,
  type BulkReceiptIssue,
  type BulkSinglesReceipt,
  type StraightReceipt,
} from "@/lib/verification";

function CompactPickTicket({ pick }: { pick: StraightReceipt }) {
  const verified = isVerifiedTier(pick.tier);
  const metaBits = [pick.market, pick.moveNote].filter(Boolean);
  const stake = pick.units != null ? formatUnits(pick.units, true, false) : "—";
  const toWin =
    pick.toWinUnits != null ? formatUnits(pick.toWinUnits, true, false) : "—";
  const sport = pick.sport?.trim() || "";

  return (
    <div className="space-y-2">
      <div className="flex flex-wrap items-center gap-2 px-0.5">
        {pick.loggedPreGame ? <StatusBadge status="pre-game" /> : null}
      </div>
      <Ticket
        selectionTitle={pick.selection}
        leadingMark={
          sport ? (
            <TeamRef name={pick.side} sport={sport} size="md" knownOnly />
          ) : null
        }
        eventLine={
          <span className="inline-flex flex-wrap items-center gap-1.5 tracking-normal normal-case">
            {sport ? <LeagueRef sport={sport} /> : null}
            {pick.book ? (
              <span className="scl-data inline-flex items-center gap-1 tracking-[0.06em] uppercase">
                <BookMark bookKey={pick.book} size={16} />
                {bookLabel(pick.book)} BOARD
                {metaBits.length ? ` · ${metaBits.join(" · ")}` : ""}
              </span>
            ) : metaBits.length ? (
              <span className="scl-data tracking-[0.06em] uppercase">
                {metaBits.join(" · ")}
              </span>
            ) : null}
          </span>
        }
        legs={1}
        odds={formatOdds(pick.oddsAmerican)}
        stake={stake}
        toWin={toWin}
        capturedAt={pick.capturedAt}
        book={pick.book}
        status={verified ? "verified" : "muted"}
        className="shadow-none"
      />
    </div>
  );
}

function IssueRow({ issue }: { issue: BulkReceiptIssue }) {
  return (
    <li
      className="border-border rounded-[12px] border border-dashed bg-[color:var(--scl-ink-800)] px-4 py-3"
      role="status"
    >
      <p className="scl-display text-muted-foreground text-sm font-semibold tracking-wide uppercase">
        {issue.selection}
      </p>
      <p className="text-muted-foreground mt-1 text-xs">
        {issue.kind === "suspended" ? "Suspended" : "Not submitted"}
        {issue.market ? ` · ${issue.market}` : ""}
        {" — "}
        {issue.reason}
      </p>
    </li>
  );
}

/**
 * Bulk-singles receipt stack (M5 §6.2) — header + N compact Tickets.
 * Partial batches show muted failed/suspended rows; CTA still View My Picks.
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
  const issues = [...receipt.failed, ...receipt.suspended];

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
        {issues.length > 0 ? (
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
        {issues.map((issue, i) => (
          <IssueRow
            key={`${issue.kind}-${issue.moveKey ?? issue.selection}-${i}`}
            issue={issue}
          />
        ))}
      </ul>

      <p className="text-muted-foreground text-sm">{copy.gradingLine}</p>
      <Button
        className="scl-cta-brand min-h-12 w-full text-base"
        render={<Link href={picksHref} />}
        nativeButton={false}
      >
        View My Picks
      </Button>
    </div>
  );
}
