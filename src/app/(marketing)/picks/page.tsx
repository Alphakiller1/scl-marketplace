import type { Metadata } from "next";
import { ReceiptText } from "lucide-react";

import { PublicPicksLedger } from "@/components/scl/public-picks-ledger";
import { EmptyState } from "@/components/scl/states";
import { VerificationHelpLink } from "@/components/scl/verification-help-link";
import { VerificationLegend } from "@/components/scl/verification-legend";
import { getGradingHealth } from "@/lib/grading-health";
import { parsePublicPicksLedgerFilters } from "@/lib/public-picks-ledger";
import { getLeaderboardResult } from "@/lib/queries/leaderboard";
import { getPublicRecentPicksResult } from "@/lib/queries/plays";
import { publicFeedCappers } from "@/lib/public-picks";

export const metadata: Metadata = {
  title: { absolute: "Latest picks · SCL" },
  description:
    "A chronological ledger of tracked public picks, capture evidence, and graded results.",
};

export const revalidate = 60;

export default async function PicksPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const params = await searchParams;
  const filters = parsePublicPicksLedgerFilters(params);
  const now = new Date();
  const {
    cappers,
    unranked,
    failed: leaderboardFailed,
  } = await getLeaderboardResult();
  const { picks, failed: picksFailed } = await getPublicRecentPicksResult(
    publicFeedCappers(cappers, unranked),
    24,
    filters,
    now,
  );
  const gradingHealthy = await getGradingHealth();
  const failed = leaderboardFailed || picksFailed;
  const requestedReceipt = Array.isArray(params.receipt)
    ? params.receipt[0]
    : params.receipt;
  const initialReceiptId = picks.some((pick) => pick.id === requestedReceipt)
    ? requestedReceipt
    : null;

  return (
    <main
      className="mx-auto max-w-[1400px] px-4 py-5 sm:px-6 sm:py-7 lg:px-8"
      data-visual-mode="proof"
    >
      <header className="border-border border-b pb-5 sm:pb-6">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
          <div className="max-w-3xl border-l-2 border-l-[color:var(--scl-pink)] pl-3 sm:pl-4">
            <p className="scl-eyebrow text-[color:var(--scl-muted-label)]">
              SCL public evidence ledger
            </p>
            <h1 className="scl-display text-foreground mt-1 text-3xl leading-none font-bold tracking-tight sm:text-4xl">
              Latest picks
            </h1>
            <p className="text-muted-foreground mt-2 text-sm leading-relaxed sm:text-base">
              A chronological ledger of public submissions, capture evidence,
              and graded results.
            </p>
          </div>
          <VerificationHelpLink className="text-muted-foreground hover:text-foreground inline-flex min-h-11 shrink-0 gap-1.5 self-start px-2 text-xs font-medium sm:self-auto" />
        </div>
        <VerificationLegend className="mt-4" />
      </header>

      {!failed ? (
        <PublicPicksLedger
          key={`${filters.window}:${filters.sport}:${filters.status}:${initialReceiptId ?? "closed"}`}
          picks={picks}
          initialFilters={filters}
          initialReceiptId={initialReceiptId}
          gradingHealthy={gradingHealthy}
        />
      ) : (
        <EmptyState
          className="mt-6"
          icon={ReceiptText}
          title="Couldn't load public picks"
          description="Recent tracked submissions are temporarily unavailable. Please try again shortly."
        />
      )}
    </main>
  );
}
