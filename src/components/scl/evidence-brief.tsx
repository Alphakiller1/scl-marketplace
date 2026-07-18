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
          className="scl-data text-foreground min-w-[3.5ch] text-lg font-semibold break-words whitespace-normal tabular-nums sm:text-xl"
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
 * Capper profile Evidence Brief — Trust Lens metrics + Latest Proof as peers,
 * then deep-dive charts and Proof history. Desktop storefront is composed by
 * the page via `desktopStorefront` (lg+ only); mobile storefront stays after
 * CapperProfileMeta so stacked order is unchanged.
 */
export function EvidenceBrief({
  capper,
  plays,
  playsError,
  avgClv,
  clvTracker: clvTrackerProp,
  emptyName,
  desktopStorefront,
  className,
}: {
  capper: CapperSummary;
  plays: PlayView[];
  playsError?: boolean;
  avgClv?: number | null;
  clvTracker?: ClvTrackerSummary;
  emptyName: string;
  /** Marketplace rail/band — rendered only from `lg` upward (never on mobile). */
  desktopStorefront?: ReactNode;
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
    <Card className="min-w-0 gap-0 p-2.5 sm:p-4">
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
          className="h-8 w-full max-w-md justify-start gap-1 sm:h-10"
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
    </Card>
  );

  return (
    <div className={cn("space-y-3 sm:space-y-5", className)}>
      {/*
        Desktop (lg–<1440): Evidence | Latest Proof peers; Marketplace
        full-width band below. ≥1440: Marketplace as third column (≥320px).
        Mobile: stacked Evidence then Proof (unchanged). Storefront never
        injects above Meta on mobile — page owns that band.
      */}
      <div
        className={cn(
          "grid items-start gap-4 sm:gap-5 lg:gap-6",
          // Exclusive ranges (not `lg:` + `min-[1440px]:`) — Tailwind emits
          // `lg:grid-cols-*` after arbitrary min breakpoints, so the 2-col
          // rule would otherwise win at ≥1440. Stacked `lg:max-*` also drops
          // the lg floor in this Tailwind 4 build.
          desktopStorefront
            ? [
                "[@media(min-width:1024px)_and_(max-width:1439px)]:grid-cols-[minmax(280px,0.85fr)_minmax(460px,1.4fr)]",
                "min-[1440px]:grid-cols-[minmax(280px,0.85fr)_minmax(460px,1.4fr)_minmax(320px,0.9fr)]",
              ]
            : "lg:grid-cols-[minmax(280px,0.85fr)_minmax(460px,1.4fr)]",
        )}
      >
        {evidenceRecord}
        <div className="min-w-0 lg:sticky lg:top-20">{latestProof}</div>
        {desktopStorefront ? (
          <aside
            className={cn(
              "border-border hidden lg:block",
              // <1440: full-width band under peers; ≥1440: third column ≥320px
              "max-[1439px]:col-span-2 max-[1439px]:mt-1 max-[1439px]:border-t max-[1439px]:pt-5",
              "min-[1440px]:col-span-1 min-[1440px]:mt-0 min-[1440px]:min-w-[320px] min-[1440px]:border-t-0 min-[1440px]:border-l min-[1440px]:pt-0 min-[1440px]:pl-6",
            )}
          >
            {desktopStorefront}
          </aside>
        ) : null}
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
      <RecordStat
        record={capper.record}
        className="min-w-[4.5rem]"
        truncateValue={false}
      />
      <div className="min-w-[4.5rem] space-y-1.5">
        <RoiStat roi={capper.roi} gradedCount={graded} truncateValue={false} />
        {provisional ? (
          <span className="border-border text-muted-foreground inline-flex min-h-8 items-center rounded-md border px-2 text-[0.7rem] font-semibold tracking-wide uppercase">
            Provisional
          </span>
        ) : null}
      </div>
      <UnitStat
        units={capper.units}
        gradedCount={graded}
        className="min-w-[4.5rem]"
        truncateValue={false}
      />
      <StatBlock
        label="Sample"
        value={graded.toLocaleString()}
        className="min-w-[4.5rem]"
        truncateValue={false}
      />
      <VerifiedMeter pct={verifiedPct} />
      {showClv ? (
        <StatBlock
          label="CLV"
          value={avgClv != null ? formatClvPts(avgClv) : "—"}
          valueClassName={perfToneClass(clvScale.tone)}
          aria-label={clvScale.ariaLabel}
          className="min-w-[4.5rem]"
          truncateValue={false}
        />
      ) : (
        <WinRateStat
          winPct={capper.winPct}
          gradedCount={graded}
          className="min-w-[4.5rem]"
          truncateValue={false}
        />
      )}
    </div>
  );
}
