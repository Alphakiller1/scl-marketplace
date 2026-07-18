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
import { Card } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { summarizeClvTracker, type ClvTrackerSummary } from "@/lib/clv-tracker";
import { formatOdds, formatUnits } from "@/lib/format";
import type { CapperSummary } from "@/lib/mock";
import { americanToDecimal } from "@/lib/odds";
import { pickContextLabel } from "@/lib/pick-identity";
import { perfScale, perfToneClass } from "@/lib/perf-scale";
import {
  deriveProofReceiptState,
  formatClvPts,
  type ProofReceiptDensity,
} from "@/lib/proof-receipt";
import type { PlayView } from "@/lib/queries/plays";
import { hasSignal, isProvisional } from "@/lib/sample";
import { isVerifiedTier } from "@/lib/verification";
import { cn } from "@/lib/utils";

const LENS_KEY = "scl-trust-lens";
type TrustLens = "simple" | "analyst" | "audit";

function VerifiedMeter({ pct }: { pct: number | null }) {
  if (pct == null) {
    return <StatBlock label="Verified" value="—" className="min-w-[4.5rem]" />;
  }
  return (
    <div className="flex min-w-[5.5rem] flex-col gap-1">
      <div className="flex items-center gap-1.5">
        <ShieldCheck
          className="size-4 text-[color:var(--scl-pink)]"
          aria-hidden
        />
        <span
          className="scl-data text-foreground text-lg font-semibold tabular-nums sm:text-xl"
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
  const state = deriveProofReceiptState({
    outcome: play.outcome,
    eventStartsAt: play.eventStartsAt,
    verificationTier: play.verificationTier,
  });
  const projected = play.units * (americanToDecimal(play.oddsAmerican) - 1);
  const toWin =
    play.profitUnits != null
      ? formatUnits(play.profitUnits)
      : formatUnits(projected, true, false);
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
 * Capper profile Evidence Brief — Trust Lens + metrics + featured paper receipt
 * + Proof history. Proof-first: brief and paper artifact belong in the first viewport.
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
    <section aria-label="Featured proof receipt" className="space-y-2">
      <div className="border-t border-[color:var(--scl-pink-deep)] pt-2 lg:border-t-0 lg:pt-0">
        <h2 className="scl-display text-sm font-bold tracking-[0.05em] uppercase">
          Latest proof
        </h2>
        <p className="text-muted-foreground mt-0.5 text-xs leading-snug">
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

  return (
    <div className={cn("space-y-4 sm:space-y-5", className)}>
      {/*
        Brief metrics + Latest Proof stay co-anchored across lens switches.
        CLV / cumulative charts render below the first receipt so Analyst
        never pushes proof ~600px down.
      */}
      <div className="grid gap-4 lg:grid-cols-12 lg:items-start lg:gap-5">
        <Card className="gap-0 p-3 sm:p-4 lg:col-span-5">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <h2 className="scl-eyebrow text-[color:var(--scl-muted-label)]">
              Evidence Brief
            </h2>
            <div className="flex flex-wrap items-center gap-2">
              {provisional ? <ProvisionalRecordHelp /> : null}
            </div>
          </div>

          <Tabs value={lens} onValueChange={onLensChange} className="mt-2">
            <TabsList
              variant="line"
              className="h-9 w-full max-w-md justify-start gap-1 sm:h-10"
              aria-label="Trust lens"
            >
              <TabsTrigger
                value="simple"
                className="min-h-8 px-2.5 sm:min-h-9 sm:px-3"
              >
                Simple
              </TabsTrigger>
              <TabsTrigger
                value="analyst"
                className="min-h-8 px-2.5 sm:min-h-9 sm:px-3"
              >
                Analyst
              </TabsTrigger>
              <TabsTrigger
                value="audit"
                className="min-h-8 px-2.5 sm:min-h-9 sm:px-3"
              >
                Audit
              </TabsTrigger>
            </TabsList>

            <TabsContent
              value="simple"
              className="mt-2.5 space-y-2.5 sm:mt-3 sm:space-y-3"
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
              <SampleMaturityMeter graded={graded} />
            </TabsContent>

            <TabsContent
              value="analyst"
              className="mt-2.5 space-y-2.5 sm:mt-3 sm:space-y-3"
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
              className="mt-2.5 space-y-2.5 sm:mt-3 sm:space-y-3"
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
                  Historical plays without a closing snapshot stay as em-dashes
                  — CLV only populates forward when a close is captured.
                </p>
              ) : null}
            </TabsContent>
          </Tabs>

          <div className="border-border mt-2.5 flex flex-wrap items-center gap-x-4 gap-y-1.5 border-t pt-2 sm:mt-3 sm:pt-2.5">
            <VerificationHelpLink />
            <a
              href="/responsible-gaming"
              className="text-muted-foreground hover:text-foreground inline-flex min-h-10 items-center text-xs underline-offset-4 hover:underline"
            >
              Responsible gaming
            </a>
          </div>
        </Card>

        <div className="lg:sticky lg:top-20 lg:col-span-7">{latestProof}</div>
      </div>

      {showDeepAnalysis ? (
        <section aria-label="Analyst deep dive" className="space-y-3">
          <CumulativeUnitsChart points={cumulative} gradedCount={graded} />
          <ClvTrackerPanel summary={clvTracker} />
        </section>
      ) : null}

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
              {historyPlays.map((play) => playToProofReceipt(play, "feed"))}
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
    <div className="grid grid-cols-2 gap-2.5 sm:grid-cols-3">
      <RecordStat record={capper.record} />
      <div className="space-y-1.5">
        <RoiStat roi={capper.roi} gradedCount={graded} />
        {provisional ? (
          <span className="border-border text-muted-foreground inline-flex min-h-8 items-center rounded-md border px-2 text-[0.7rem] font-semibold tracking-wide uppercase">
            Provisional
          </span>
        ) : null}
      </div>
      <UnitStat units={capper.units} gradedCount={graded} />
      <StatBlock
        label="Sample"
        value={graded.toLocaleString()}
        className="min-w-[4.5rem]"
      />
      <VerifiedMeter pct={verifiedPct} />
      {showClv ? (
        <StatBlock
          label="CLV"
          value={avgClv != null ? formatClvPts(avgClv) : "—"}
          valueClassName={perfToneClass(clvScale.tone)}
          aria-label={clvScale.ariaLabel}
          className="min-w-[4.5rem]"
        />
      ) : (
        <WinRateStat winPct={capper.winPct} gradedCount={graded} />
      )}
    </div>
  );
}
