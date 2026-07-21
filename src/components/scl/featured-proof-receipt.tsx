import Link from "next/link";
import { Receipt } from "lucide-react";

import { LeagueRef, TeamRef } from "@/components/scl/entity-marks";
import { ProofReceipt } from "@/components/scl/proof-receipt";
import { EmptyState } from "@/components/scl/states";
import { formatOdds, formatUnits } from "@/lib/format";
import { profitUnitsForOutcome } from "@/lib/odds";
import { pickContextLabel } from "@/lib/pick-identity";
import { deriveProofReceiptState } from "@/lib/proof-receipt";
import type { FeaturedGradedPlay } from "@/lib/queries/home-live";
import { isVerifiedTier } from "@/lib/verification";
import { cn } from "@/lib/utils";

/**
 * Homepage Featured Proof Receipt — warm expanded-paper artifact.
 * Pink verification stamp stays dominant over settlement result.
 */
export function FeaturedProofReceipt({
  play,
  failed = false,
  hideHeader = false,
  className,
}: {
  play: FeaturedGradedPlay | null;
  failed?: boolean;
  /** When true, hide the section header (legacy collage prop — unused on home). */
  hideHeader?: boolean;
  className?: string;
}) {
  return (
    <section
      className={cn("space-y-3", className)}
      aria-label="Featured Proof Receipt"
    >
      {hideHeader ? null : (
        <div className="flex flex-wrap items-end justify-between gap-3">
          <div className="min-w-0 border-t border-[color:var(--scl-pink-deep)] pt-2.5">
            <h2 className="scl-display text-[1.375rem] leading-7 font-semibold tracking-[0.02em] normal-case">
              Featured Proof Receipt
            </h2>
            <p className="text-muted-foreground mt-1 text-sm leading-snug">
              An Inspectable Receipt For A Recent Graded Pick.
            </p>
          </div>
          {play ? (
            <Link
              href={`/cappers/${play.handle}`}
              className="scl-link inline-flex min-h-11 items-center text-sm font-medium"
            >
              View All Proof Receipts
              <span aria-hidden> →</span>
            </Link>
          ) : null}
        </div>
      )}

      {!play ? (
        <div className="scl-proof-paper scl-elevated bg-card rounded-[var(--scl-radius-receipt)] border-2 border-[color:var(--border)]">
          <EmptyState
            className="rounded-[var(--scl-radius-receipt)] border-0 bg-transparent py-5 shadow-none sm:py-6"
            icon={Receipt}
            title={
              failed ? "Couldn't Load Featured Proof" : "No Graded Receipts Yet"
            }
            description={
              failed
                ? "Try Again Shortly."
                : "A Proof Receipt Appears Here After A Board-Verified Pick Is Graded."
            }
          />
        </div>
      ) : (
        <FeaturedReceiptBody play={play} />
      )}
    </section>
  );
}

function FeaturedReceiptBody({ play }: { play: FeaturedGradedPlay }) {
  const state = deriveProofReceiptState({
    outcome: play.outcome,
    eventStartsAt: play.eventStartsAt,
    verificationTier: play.verificationTier,
  });
  const computedResult = profitUnitsForOutcome(
    play.outcome,
    play.oddsAmerican,
    play.units,
  );
  const resultUnits =
    play.profitUnits != null
      ? formatUnits(play.profitUnits)
      : computedResult != null
        ? formatUnits(computedResult)
        : "—";
  const market = pickContextLabel({
    sport: play.sport,
    league: play.league,
    market: play.market,
  });
  const boardVerified = isVerifiedTier(play.verificationTier);

  return (
    <ProofReceipt
      selectionTitle={play.selection}
      leadingMark={
        <TeamRef name={play.side} sport={play.sport} size="md" knownOnly />
      }
      eventLine={
        <span className="inline-flex flex-wrap items-center gap-1.5 tracking-normal normal-case">
          <LeagueRef sport={play.sport} />
          {market ? (
            <span className="scl-data tracking-[0.06em] uppercase">
              {market}
            </span>
          ) : null}
        </span>
      }
      legs={1}
      odds={formatOdds(play.oddsAmerican)}
      stake={formatUnits(play.units, true, false)}
      toWin={resultUnits}
      capturedAt={play.createdAt.toISOString()}
      book={play.book}
      state={state}
      density="expanded-paper"
      verificationDominant
      boardVerified={boardVerified}
      closingOddsAmerican={play.closingOddsAmerican ?? null}
      clvPts={play.clvPts ?? null}
      evidenceId={play.id}
      analysis={play.notesPublic === false ? null : play.notes}
      footerAction={
        <Link
          href={`/cappers/${play.handle}`}
          className="scl-link inline-flex min-h-11 items-center text-xs font-semibold"
        >
          View @{play.handle} Record
        </Link>
      }
    />
  );
}
