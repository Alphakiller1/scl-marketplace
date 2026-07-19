"use client";

import { useMemo, useState, type ReactNode } from "react";
import { ListChecks, Receipt, ShieldCheck } from "lucide-react";

import {
  CumulativeUnitsChart,
  buildCumulativeUnits,
} from "@/components/scl/cumulative-units-chart";
import { ClvTrackerPanel } from "@/components/scl/clv-tracker-panel";
import { LeagueRef, TeamRef } from "@/components/scl/entity-marks";
import { ProofReceipt } from "@/components/scl/proof-receipt";
import { ProvisionalRecordHelp } from "@/components/scl/provisional-record-help";
import {
  RecordStat,
  RoiStat,
  StatBlock,
  UnitStat,
  WinRateStat,
} from "@/components/scl/stat";
import { SampleMaturityMeter } from "@/components/scl/sample-maturity-meter";
import { EmptyState } from "@/components/scl/states";
import { VerificationHelpLink } from "@/components/scl/verification-help-link";
import { VerificationLegend } from "@/components/scl/verification-legend";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { summarizeClvTracker, type ClvTrackerSummary } from "@/lib/clv-tracker";
import { formatOdds, formatUnits } from "@/lib/format";
import type { CapperSummary } from "@/lib/mock";
import { profitUnitsForOutcome } from "@/lib/odds";
import { pickContextLabel } from "@/lib/pick-identity";
import { perfScale, perfToneClass } from "@/lib/perf-scale";
import {
  deriveProofReceiptState,
  formatClvPts,
  formatEvidenceId,
  type ProofReceiptDensity,
} from "@/lib/proof-receipt";
import type { PlayView } from "@/lib/queries/plays";
import { isValidPublicStake } from "@/lib/public-eligibility";
import { hasSignal, isProvisional } from "@/lib/sample";
import { isVerifiedTier } from "@/lib/verification";
import { cn } from "@/lib/utils";

const LENS_KEY = "scl-trust-lens";
type TrustLens = "simple" | "analyst" | "audit";

function VerifiedMeter({ pct }: { pct: number | null }) {
  if (pct == null) {
    return (
      <StatBlock
        label="Verified"
        value="—"
        className="min-w-[4.5rem]"
        truncateValue={false}
      />
    );
  }
  return (
    <div className="flex min-w-[5.5rem] flex-col gap-1">
      <div className="flex items-center gap-1.5">
        <ShieldCheck
          className="size-4 shrink-0 text-[color:var(--scl-pink)]"
          aria-hidden
        />
        <span
          className="scl-data text-foreground min-w-[3.5ch] text-lg font-semibold whitespace-nowrap tabular-nums sm:text-xl"
          aria-label={`${pct} percent board-verified`}
        >
          {pct}%
        </span>
      </div>
      <span className="scl-eyebrow text-[color:var(--scl-muted-label)]">
        Verified
      </span>
      <div
        className="bg-surface-2 border-border h-1.5 overflow-hidden rounded-full border"
        role="meter"
        aria-valuemin={0}
        aria-valuemax={100}
        aria-valuenow={pct}
        aria-label="Verified share meter"
      >
        <div
          className="h-full rounded-full bg-[color:var(--scl-pink)]"
          style={{ width: `${pct}%` }}
        />
      </div>
    </div>
  );
}

function playToProofReceipt(
  play: PlayView,
  density: ProofReceiptDensity,
): ReactNode {
  // Public receipts must never show 0U / sub-minimum stakes (data error).
  if (!isValidPublicStake(play.units)) return null;
  const state = deriveProofReceiptState({
    outcome: play.outcome,
    eventStartsAt: play.eventStartsAt,
    verificationTier: play.verificationTier,
  });
  const settled = play.outcome !== "PENDING";
  const receiptUnits =
    play.profitUnits ??
    profitUnitsForOutcome(
      settled ? play.outcome : "WIN",
      play.oddsAmerican,
      play.units,
    );
  const toWin =
    receiptUnits == null ? "—" : formatUnits(receiptUnits, true, settled);
  const market = pickContextLabel({
    sport: play.sport,
    league: play.league,
    market: play.market,
  });
  return (
    <ProofReceipt
      key={`${play.id}-${density}`}
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
      toWin={toWin}
      capturedAt={play.createdAt.toISOString()}
      book={play.book}
      state={state}
      density={density}
      verificationDominant={density === "expanded-paper"}
      boardVerified={isVerifiedTier(play.verificationTier)}
      closingOddsAmerican={play.closingOddsAmerican ?? null}
      clvPts={play.clvPts ?? null}
      evidenceId={play.id}
      eventStartsAt={play.eventStartsAt}
      analysis={play.notesPublic === false ? null : play.notes}
    />
  );
}

/**
 * Capper profile Evidence Brief — Trust Lens metrics + Latest Proof as peers,
 * followed by deep-dive charts and Proof history. Marketplace remains a
 * downstream, full-width page section so proof stays visually dominant.
 */
export function EvidenceBrief({
  capper,
  plays,
  playsError,
  avgClv,
  clvTracker: clvTrackerProp,
  emptyName,
  className,
}: {
  capper: CapperSummary;
  plays: PlayView[];
  playsError?: boolean;
  avgClv?: number | null;
  clvTracker?: ClvTrackerSummary;
  emptyName: string;
  className?: string;
}) {
  const graded = capper.settledPicks ?? 0;
  const provisional = isProvisional(graded);
  const signal = hasSignal(graded);
  const verifiedPct =
    capper.verifiedShare != null && capper.verifiedShare > 0
      ? Math.round(capper.verifiedShare)
      : null;

  const clvTracker = useMemo(() => {
    if (clvTrackerProp) return clvTrackerProp;
    const fromPlays = plays
      .map((p) => p.clvPts)
      .filter((v): v is number => v != null && Number.isFinite(v));
    return summarizeClvTracker(fromPlays);
  }, [clvTrackerProp, plays]);

  const displayAvgClv = clvTracker.avgClv ?? avgClv ?? null;
  const clvScale = perfScale("clv", displayAvgClv, {
    gradedCount: clvTracker.snapshotCount,
  });

  const [lens, setLens] = useState<TrustLens>(() => {
    if (typeof window === "undefined") return "simple";
    try {
      const raw = localStorage.getItem(LENS_KEY);
      if (raw === "simple" || raw === "analyst" || raw === "audit") return raw;
    } catch {
      /* ignore */
    }
    return "simple";
  });

  function onLensChange(next: string | number | null) {
    const v = String(next ?? "simple") as TrustLens;
    if (v !== "simple" && v !== "analyst" && v !== "audit") return;
    setLens(v);
    try {
      localStorage.setItem(LENS_KEY, v);
    } catch {
      /* ignore */
    }
  }

  const cumulative = useMemo(() => {
    const gradedPlays = [...plays]
      .filter((p) => p.outcome !== "PENDING" && p.profitUnits != null)
      .sort((a, b) => a.createdAt.getTime() - b.createdAt.getTime());
    if (capper.performanceTrend?.length) {
      return capper.performanceTrend.map((units, i) => ({
        n: i + 1,
        units,
      }));
    }
    return buildCumulativeUnits(gradedPlays.map((p) => p.profitUnits ?? 0));
  }, [plays, capper.performanceTrend]);

  const showClv = signal || lens === "analyst" || lens === "audit";
  const showAuditMeta = lens === "audit";
  const showDeepAnalysis = lens === "analyst" || lens === "audit";
  const featured = plays[0] ?? null;
  const historyPlays = plays.slice(1);

  const latestProof = (
    <section aria-label="Featured proof receipt" className="min-w-0 space-y-2">
      <div className="border-t border-[color:var(--scl-pink-deep)] pt-2 lg:border-t-0 lg:pt-0">
        <h2 className="scl-display text-sm font-bold tracking-[0.05em] uppercase">
          Latest proof
        </h2>
        <p className="text-muted-foreground mt-0.5 hidden text-xs leading-snug sm:block">
          Expanded paper receipt — inspectable capture, close, and CLV.
        </p>
      </div>
      {featured ? (
        playToProofReceipt(featured, "expanded-paper")
      ) : playsError ? (
        <EmptyState
          icon={Receipt}
          title="Couldn't load latest proof"
          description="Try again shortly."
        />
      ) : (
        <EmptyState
          icon={Receipt}
          title="No tracked plays yet"
          description={`${emptyName} hasn't posted a graded play yet. When they do, the Proof Receipt appears here — timestamps, lines, and results included.`}
        />
      )}
    </section>
  );

  const evidenceRecord = (
    <section className="border-border min-w-0 border-y py-3 sm:py-4 lg:pr-6">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h2 className="scl-eyebrow text-[color:var(--scl-muted-label)]">
          Evidence Brief
        </h2>
        <div className="flex flex-wrap items-center gap-2">
          {provisional ? <ProvisionalRecordHelp /> : null}
        </div>
      </div>

      <Tabs
        value={lens}
        onValueChange={onLensChange}
        className="mt-1.5 sm:mt-2"
      >
        <TabsList
          variant="line"
          className="h-10 w-full max-w-md justify-start gap-1"
          aria-label="Trust lens"
        >
          <TabsTrigger value="simple" className="min-h-10 px-3">
            Simple
          </TabsTrigger>
          <TabsTrigger value="analyst" className="min-h-10 px-3">
            Analyst
          </TabsTrigger>
          <TabsTrigger value="audit" className="min-h-10 px-3">
            Audit
          </TabsTrigger>
        </TabsList>

        <TabsContent
          value="simple"
          className="mt-2 space-y-2 sm:mt-3 sm:space-y-3"
        >
          <MetricRow
            capper={capper}
            graded={graded}
            provisional={provisional}
            verifiedPct={verifiedPct}
            avgClv={avgClv}
            clvScale={clvScale}
            showClv={false}
          />
          <SampleMaturityMeter graded={graded} className="hidden sm:block" />
        </TabsContent>

        <TabsContent
          value="analyst"
          className="mt-2 space-y-2 sm:mt-3 sm:space-y-3"
        >
          <MetricRow
            capper={capper}
            graded={graded}
            provisional={provisional}
            verifiedPct={verifiedPct}
            avgClv={displayAvgClv}
            clvScale={clvScale}
            showClv={showClv}
          />
          <SampleMaturityMeter graded={graded} showLegend />
        </TabsContent>

        <TabsContent
          value="audit"
          className="mt-2 space-y-2 sm:mt-3 sm:space-y-3"
        >
          <MetricRow
            capper={capper}
            graded={graded}
            provisional={provisional}
            verifiedPct={verifiedPct}
            avgClv={displayAvgClv}
            clvScale={clvScale}
            showClv
          />
          <SampleMaturityMeter graded={graded} showLegend />
          {showAuditMeta ? (
            <p className="text-muted-foreground text-xs leading-relaxed">
              Audit lens shows Evidence IDs and Close/CLV on each receipt.
              Historical plays without a closing snapshot stay as em-dashes —
              CLV only populates forward when a close is captured.
            </p>
          ) : null}
        </TabsContent>
      </Tabs>

      <div className="border-border mt-2 hidden flex-wrap items-center gap-x-4 gap-y-1.5 border-t pt-2 sm:mt-3 sm:flex sm:pt-2.5">
        <VerificationHelpLink />
        <a
          href="/responsible-gaming"
          className="text-muted-foreground hover:text-foreground inline-flex min-h-10 items-center text-xs underline-offset-4 hover:underline"
        >
          Responsible gaming
        </a>
      </div>
    </section>
  );

  return (
    <div className={cn("space-y-5 sm:space-y-6", className)}>
      {/*
        Desktop (lg+): Evidence | Latest Proof peers; Marketplace always a
        full-width band under the peers (no 3-col rail — avoids squeezing
        the evidence stats and reads cleaner than a sidebar ad).
        Mobile: stacked Evidence then Proof (unchanged). Storefront never
        injects above Meta on mobile — page owns that band.
      */}
      <div
        className={cn(
          "grid items-start gap-4 sm:gap-5 lg:gap-0",
          "lg:grid-cols-[minmax(0,1.7fr)_minmax(400px,0.9fr)]",
        )}
      >
        {evidenceRecord}
        <div className="border-border min-w-0 lg:border-l lg:pl-6">
          {latestProof}
        </div>
      </div>

      <div className="grid items-start gap-5 lg:grid-cols-[minmax(0,1.7fr)_minmax(400px,0.9fr)] lg:gap-0">
        <section
          aria-label="Performance trend"
          className="border-border min-w-0 space-y-3 border-b pb-5 lg:border-r lg:border-b-0 lg:pr-6 lg:pb-0"
        >
          <CumulativeUnitsChart points={cumulative} gradedCount={graded} />
          {showDeepAnalysis ? <ClvTrackerPanel summary={clvTracker} /> : null}
        </section>
        <RecentProofLedger plays={historyPlays} playsError={playsError} />
      </div>

      <section id="recent-picks" className="scroll-mt-20">
        <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
          <div>
            <h2 className="scl-display text-base font-bold tracking-[0.05em] uppercase">
              Proof history
            </h2>
            <p className="text-muted-foreground mt-1 text-sm">
              Inspectable receipts — newest first. Verified ≠ Won.
            </p>
          </div>
          <VerificationHelpLink className="text-muted-foreground hover:text-foreground inline-flex min-h-11 shrink-0 gap-1.5 self-start px-2 text-xs font-medium" />
        </div>

        {historyPlays.length ? (
          <>
            <VerificationLegend className="mt-4" />
            <div className="mt-3 space-y-3">
              {historyPlays
                .map((play) => playToProofReceipt(play, "feed"))
                .filter(Boolean)}
            </div>
          </>
        ) : featured ? (
          <p className="text-muted-foreground mt-4 text-sm leading-relaxed">
            Additional receipts will stack here as more plays settle.
          </p>
        ) : playsError ? (
          <EmptyState
            className="mt-4"
            icon={ListChecks}
            title="Couldn't Load Recent Plays"
            description="We hit a snag loading this capper's plays. Please try again shortly."
          />
        ) : (
          <EmptyState
            className="mt-4"
            icon={ListChecks}
            title="No Tracked Plays Yet"
            description={`${emptyName} hasn't posted any graded plays yet. Every new play will stay inspectable here — timestamps, lines, and results included.`}
          />
        )}
      </section>
    </div>
  );
}

function RecentProofLedger({
  plays,
  playsError,
}: {
  plays: PlayView[];
  playsError?: boolean;
}) {
  const visible = plays.slice(0, 5);

  return (
    <section
      className="min-w-0 lg:pl-6"
      aria-label="Recent proof history summary"
    >
      <div className="flex items-center justify-between gap-3">
        <h2 className="scl-display text-base font-bold tracking-[0.04em]">
          Recent proof history
        </h2>
        <a
          href="#recent-picks"
          className="text-muted-foreground hover:text-foreground inline-flex min-h-10 items-center text-xs font-semibold underline-offset-4 hover:underline"
        >
          View all
        </a>
      </div>

      {!visible.length ? (
        <p className="text-muted-foreground border-border mt-3 border-y py-5 text-sm leading-relaxed">
          {playsError
            ? "Recent proof history is temporarily unavailable."
            : "No earlier graded receipts are available yet."}
        </p>
      ) : (
        <div className="border-border mt-2 overflow-hidden border-y">
          <table className="w-full table-fixed text-left text-xs">
            <caption className="sr-only">
              Five most recent proof receipts before the featured pick
            </caption>
            <thead className="text-muted-foreground border-border border-b text-[0.6rem] tracking-[0.08em] uppercase">
              <tr>
                <th className="hidden w-[5.5rem] py-2 pr-2 font-medium sm:table-cell">
                  Date
                </th>
                <th className="py-2 pr-2 font-medium">Pick</th>
                <th className="hidden w-12 py-2 pr-2 font-medium sm:table-cell">
                  Line
                </th>
                <th className="w-12 py-2 pr-2 font-medium">Result</th>
                <th className="w-14 py-2 pr-2 text-right font-medium">Units</th>
                <th className="w-[4.75rem] py-2 text-right font-medium">
                  Proof
                </th>
              </tr>
            </thead>
            <tbody className="divide-border divide-y">
              {visible.map((play) => {
                const outcome = play.outcome.toLowerCase();
                const resultClass =
                  play.outcome === "WIN"
                    ? "text-[color:var(--scl-win-text)]"
                    : play.outcome === "LOSS"
                      ? "text-[color:var(--scl-loss-text)]"
                      : "text-muted-foreground";
                return (
                  <tr key={play.id}>
                    <td className="text-muted-foreground hidden truncate py-2.5 pr-2 tabular-nums sm:table-cell">
                      {play.createdAt.toLocaleDateString("en-US", {
                        month: "short",
                        day: "numeric",
                        year: "numeric",
                        timeZone: "UTC",
                      })}
                    </td>
                    <td className="truncate py-2.5 pr-2 font-medium">
                      {play.selection}
                    </td>
                    <td className="scl-data text-muted-foreground hidden py-2.5 pr-2 tabular-nums sm:table-cell">
                      {formatOdds(play.oddsAmerican)}
                    </td>
                    <td
                      className={cn(
                        "scl-data py-2.5 pr-2 text-[0.65rem] font-semibold uppercase",
                        resultClass,
                      )}
                    >
                      {outcome}
                    </td>
                    <td
                      className={cn(
                        "scl-data py-2.5 pr-2 text-right font-semibold tabular-nums",
                        resultClass,
                      )}
                    >
                      {play.profitUnits == null
                        ? "—"
                        : formatUnits(play.profitUnits, true, false)}
                    </td>
                    <td
                      className="scl-data text-muted-foreground truncate py-2.5 text-right tabular-nums"
                      title={play.id}
                    >
                      {formatEvidenceId(play.id)}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </section>
  );
}

function MetricRow({
  capper,
  graded,
  provisional,
  verifiedPct,
  avgClv,
  clvScale,
  showClv,
}: {
  capper: CapperSummary;
  graded: number;
  provisional: boolean;
  verifiedPct: number | null;
  avgClv?: number | null;
  clvScale: ReturnType<typeof perfScale>;
  showClv: boolean;
}) {
  return (
    <div className="grid grid-cols-2 gap-y-4 sm:grid-cols-3 xl:grid-cols-6">
      <MetricCell>
        <RecordStat record={capper.record} truncateValue={false} />
      </MetricCell>
      <MetricCell>
        <div className="space-y-1.5">
          <RoiStat
            roi={capper.roi}
            gradedCount={graded}
            truncateValue={false}
          />
          {provisional ? (
            <span className="border-border text-muted-foreground inline-flex min-h-10 items-center rounded-md border px-2 text-[0.7rem] font-semibold tracking-wide uppercase">
              Provisional
            </span>
          ) : null}
        </div>
      </MetricCell>
      <MetricCell>
        <UnitStat
          units={capper.units}
          gradedCount={graded}
          truncateValue={false}
        />
      </MetricCell>
      <MetricCell>
        <StatBlock
          label="Sample"
          value={graded.toLocaleString()}
          truncateValue={false}
        />
      </MetricCell>
      <MetricCell>
        <VerifiedMeter pct={verifiedPct} />
      </MetricCell>
      <MetricCell last>
        {showClv ? (
          <StatBlock
            label="CLV"
            value={avgClv != null ? formatClvPts(avgClv) : "—"}
            valueClassName={perfToneClass(clvScale.tone)}
            aria-label={clvScale.ariaLabel}
            truncateValue={false}
          />
        ) : (
          <WinRateStat
            winPct={capper.winPct}
            gradedCount={graded}
            truncateValue={false}
          />
        )}
      </MetricCell>
    </div>
  );
}

function MetricCell({
  children,
  last = false,
}: {
  children: ReactNode;
  last?: boolean;
}) {
  return (
    <div
      className={cn(
        "border-border min-w-0 px-3 first:pl-0",
        !last && "border-r",
      )}
    >
      {children}
    </div>
  );
}
