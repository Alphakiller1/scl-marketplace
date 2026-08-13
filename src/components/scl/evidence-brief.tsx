"use client";

import {
  Fragment,
  useCallback,
  useEffect,
  useMemo,
  useState,
  useTransition,
  type ReactNode,
} from "react";
import {
  ChevronDown,
  ListChecks,
  LockKeyhole,
  ReceiptText,
} from "lucide-react";

import { CumulativeUnitsChart } from "@/components/scl/cumulative-units-chart";
import { ClvTrackerPanel } from "@/components/scl/clv-tracker-panel";
import { LeagueRef, TeamRef } from "@/components/scl/entity-marks";
import { LegacySportBreakdown } from "@/components/scl/legacy-sport-breakdown";
import { PlayerHeadshot } from "@/components/scl/player-headshot";
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
import { loadPublicProfileHistory } from "@/app/actions/public-profile-history";
import { summarizeClvTracker, type ClvTrackerSummary } from "@/lib/clv-tracker";
import { asDate, formatOdds, formatUnits } from "@/lib/format";
import type { LegacySportRecordView } from "@/lib/legacy-sport-records";
import type { CapperSummary } from "@/lib/mock";
import type {
  PackageEvidence,
  ProfilePackageInsight,
} from "@/lib/package-register";
import { profitUnitsForOutcome } from "@/lib/odds";
import { pickContextLabel } from "@/lib/pick-identity";
import { perfScale, perfToneClass } from "@/lib/perf-scale";
import { toHeadshotLeague } from "@/lib/player-headshots";
import {
  PROFILE_CHART_WINDOWS,
  buildProfileChartSeries,
  type ProfileChartSeries,
  type ProfileChartWindow,
} from "@/lib/profile-chart-window";
import {
  deriveProofReceiptState,
  formatClvPts,
  type ProofReceiptDensity,
} from "@/lib/proof-receipt";
import type { PlayView } from "@/lib/queries/plays";
import { isValidPublicStake } from "@/lib/public-eligibility";
import { isProvisional } from "@/lib/sample";
import { isVerifiedTier } from "@/lib/verification";
import { cn } from "@/lib/utils";

function playToProofReceipt(
  play: PlayView,
  density: ProofReceiptDensity,
): ReactNode {
  // Public receipts must never show 0U / sub-minimum stakes (data error).
  if (!isValidPublicStake(play.units)) return null;
  if (play.isEmbargoed) {
    return (
      <div className="border-border bg-surface-2/40 flex min-h-40 flex-col items-center justify-center border-y px-5 py-8 text-center">
        <LockKeyhole
          className="size-5 text-[color:var(--scl-blue)]"
          aria-hidden
        />
        <p className="scl-display text-foreground mt-3 font-semibold">
          Paid selection temporarily hidden
        </p>
        <p className="text-muted-foreground mt-1 max-w-md text-sm leading-relaxed">
          The complete pick and receipt publish 90 minutes after the scheduled
          event start.
        </p>
      </div>
    );
  }
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
  const eventContext =
    play.eventLabel ??
    pickContextLabel({
      sport: play.sport,
      league: play.league,
      market: play.market,
    });
  return (
    <ProofReceipt
      key={`${play.id}-${density}`}
      selectionTitle={play.selection}
      leadingMark={
        play.market === "Player Prop" ? (
          <PlayerHeadshot
            selection={play.selection}
            league={toHeadshotLeague(play.sport)}
            size={26}
          />
        ) : (
          <TeamRef name={play.side} sport={play.sport} size="md" knownOnly />
        )
      }
      eventLine={
        <span className="inline-flex flex-wrap items-center gap-1.5 tracking-normal normal-case">
          <LeagueRef sport={play.sport} />
          {eventContext ? (
            <span className="scl-data tracking-[0.06em] uppercase">
              {eventContext}
            </span>
          ) : null}
        </span>
      }
      legs={1}
      odds={formatOdds(play.oddsAmerican)}
      stake={formatUnits(play.units, true, false)}
      toWin={toWin}
      capturedAt={asDate(play.createdAt)?.toISOString() ?? null}
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
 * Capper profile evidence summary, performance trend, and expandable pick
 * history. Package offers remain a downstream full-width page section.
 */
export function EvidenceBrief({
  capper,
  plays,
  playsError,
  avgClv,
  clvTracker: clvTrackerProp,
  chartSeries: chartSeriesProp,
  chartSeriesBySport = {},
  packageInsights = [],
  legacyBySport = [],
  historyNextCursor,
  emptyName,
  className,
}: {
  capper: CapperSummary;
  plays: PlayView[];
  playsError?: boolean;
  avgClv?: number | null;
  clvTracker?: ClvTrackerSummary;
  chartSeries?: ProfileChartSeries;
  chartSeriesBySport?: Record<string, ProfileChartSeries>;
  packageInsights?: ProfilePackageInsight[];
  /** Per-sport PRE_IMPORT legacy totals (full-record view only). */
  legacyBySport?: LegacySportRecordView[];
  historyNextCursor?: string | null;
  emptyName: string;
  className?: string;
}) {
  const graded = capper.settledPicks ?? 0;
  const provisional = isProvisional(graded);
  const eligiblePlays = useMemo(
    () => plays.filter((play) => isValidPublicStake(play.units)),
    [plays],
  );

  const clvTracker = useMemo(() => {
    if (clvTrackerProp) return clvTrackerProp;
    const fromPlays = eligiblePlays
      .map((p) => p.clvPts)
      .filter((v): v is number => v != null && Number.isFinite(v));
    return summarizeClvTracker(fromPlays);
  }, [clvTrackerProp, eligiblePlays]);

  const displayAvgClv = clvTracker.avgClv ?? avgClv ?? null;
  const clvScale = perfScale("clv", displayAvgClv, {
    gradedCount: clvTracker.snapshotCount,
  });

  // Package filtering is off until the capper opt-in flow exists: every offer
  // shared one unattributed record, so the selector only ever redrew the same
  // numbers under a different label. `packageInsights` still arrives from the
  // profile query so restoring the control is a UI change alone.
  const selectedPackageId = "all";
  const [chartSport, setChartSport] = useState("ALL");
  const [chartWindow, setChartWindow] = useState<ProfileChartWindow>("all");

  const chartSeries = useMemo(
    () =>
      chartSeriesProp ??
      buildProfileChartSeries(
        eligiblePlays,
        new Date(),
        120,
        // All-window only; sport filters stay receipt-only (see builder).
        selectedPackageId === "all" ? (capper.legacyBaselineUnits ?? 0) : 0,
      ),
    [
      chartSeriesProp,
      eligiblePlays,
      selectedPackageId,
      capper.legacyBaselineUnits,
    ],
  );
  const activePackage = packageInsights.find(
    (pkg) => pkg.id === selectedPackageId,
  );
  const availableSports = activePackage
    ? activePackage.sports
    : Object.keys(chartSeriesBySport).sort();
  const effectiveSport = availableSports.includes(chartSport)
    ? chartSport
    : "ALL";
  const activeChartSeries = activePackage
    ? effectiveSport === "ALL"
      ? activePackage.chartSeries
      : (activePackage.chartSeriesBySport[effectiveSport] ??
        activePackage.chartSeries)
    : effectiveSport === "ALL"
      ? chartSeries
      : (chartSeriesBySport[effectiveSport] ?? chartSeries);
  const cumulative = activeChartSeries[chartWindow];
  const activeMetrics = evidenceMetrics(
    capper,
    activePackage ? activePackage.evidence : undefined,
  );
  const historyLedgerKey = `${capper.handle}:${historyNextCursor ?? "end"}:${eligiblePlays
    .map(
      (play) =>
        `${play.id}:${play.outcome}:${play.profitUnits ?? "open"}:${play.createdAt.getTime()}`,
    )
    .join(",")}`;

  const evidenceRecord = (
    <section className="border-border min-w-0 border-y py-3 sm:py-4 lg:pr-6">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h2 className="scl-eyebrow text-[color:var(--scl-muted-label)]">
          Evidence Brief
        </h2>
        <div className="flex flex-wrap items-center gap-2">
          {provisional ? <ProvisionalRecordHelp iconOnly /> : null}
        </div>
      </div>
      <div className="mt-3 space-y-3">
        <MetricRow
          metrics={activeMetrics}
          avgClv={activePackage ? null : displayAvgClv}
          clvScale={clvScale}
        />
        <SampleMaturityMeter graded={activeMetrics.graded} showLegend />
        <p className="text-muted-foreground text-xs leading-relaxed">
          Receipt IDs uniquely identify each timestamped submission. CLV appears
          only when SCL captures a verified market close; unavailable values
          remain em dashes rather than estimates.
        </p>
      </div>
    </section>
  );

  return (
    <div className={cn("space-y-5 sm:space-y-6", className)}>
      <div data-profile-evidence-grid className="space-y-5 sm:space-y-6">
        {evidenceRecord}
        {!activePackage && legacyBySport.length > 0 ? (
          <LegacySportBreakdown records={legacyBySport} />
        ) : null}
        <section
          data-profile-performance-trend
          aria-label="Performance trend"
          className="border-border min-w-0 space-y-3 border-b pb-5"
        >
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div>
              <h2 className="scl-display text-base font-bold tracking-[0.04em]">
                Performance trend
              </h2>
              <p className="text-muted-foreground mt-0.5 text-xs leading-snug">
                {activePackage
                  ? `Cumulative units from receipts assigned to ${activePackage.title}.`
                  : chartWindow === "all" &&
                      (capper.legacyBaselineUnits ?? 0) !== 0
                    ? "Cumulative units from public graded positions (singles and parlays), starting from the carried-over legacy balance so End matches the Evidence Brief total."
                    : "Cumulative units from public graded positions (singles and parlays)."}
              </p>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              {availableSports.length > 0 ? (
                <label>
                  <span className="sr-only">Chart sport</span>
                  <select
                    value={effectiveSport}
                    onChange={(event) => setChartSport(event.target.value)}
                    className="border-input bg-background min-h-10 rounded-md border px-3 text-xs font-semibold"
                  >
                    <option value="ALL">All sports</option>
                    {availableSports.map((sport) => (
                      <option key={sport} value={sport}>
                        {sport}
                      </option>
                    ))}
                  </select>
                </label>
              ) : null}
              <div
                className="border-border bg-surface-2 inline-flex min-h-10 items-center rounded-[var(--scl-radius-chip)] border p-0.5"
                role="group"
                aria-label="Performance chart window"
              >
                {PROFILE_CHART_WINDOWS.map((window) => {
                  const active = chartWindow === window.value;
                  return (
                    <button
                      key={window.value}
                      type="button"
                      className={cn(
                        "scl-data min-h-10 min-w-10 rounded-full px-2 text-[0.68rem] leading-none font-semibold tabular-nums",
                        active
                          ? "bg-[color:var(--scl-blue)] text-[color:var(--scl-blue-ink)]"
                          : "text-muted-foreground hover:text-foreground",
                      )}
                      aria-pressed={active}
                      onClick={() => setChartWindow(window.value)}
                    >
                      {window.label}
                    </button>
                  );
                })}
              </div>
            </div>
          </div>
          <CumulativeUnitsChart
            points={cumulative.points}
            gradedCount={cumulative.gradedCount}
          />
          {!activePackage ? <ClvTrackerPanel summary={clvTracker} /> : null}
        </section>
      </div>

      <section id="recent-picks" className="scroll-mt-20">
        <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
          <div>
            <h2 className="scl-display text-base font-semibold tracking-[0.02em] normal-case">
              Pick History
            </h2>
            <p className="text-muted-foreground mt-1 text-sm">
              Select View to open the associated ticket in place.
            </p>
          </div>
        </div>

        {eligiblePlays.length || historyNextCursor ? (
          <ProofHistoryLedger
            key={historyLedgerKey}
            plays={eligiblePlays}
            handle={capper.handle}
            initialNextCursor={historyNextCursor ?? null}
          />
        ) : playsError ? (
          <EmptyState
            className="mt-4"
            icon={ListChecks}
            title="Couldn't load recent plays"
            description="We hit a snag loading this capper's plays. Please try again shortly."
          />
        ) : (
          <EmptyState
            className="mt-4"
            icon={ListChecks}
            title="No tracked plays yet"
            description={`${emptyName} hasn't posted any graded plays yet. Every new play will stay inspectable here — timestamps, lines, and results included.`}
          />
        )}
      </section>
    </div>
  );
}

const PROOF_HISTORY_PAGE_SIZE = 10;

function ProofHistoryLedger({
  plays,
  handle,
  initialNextCursor,
}: {
  plays: PlayView[];
  handle: string;
  initialNextCursor: string | null;
}) {
  const allInitial = useMemo(
    () => plays.filter((play) => isValidPublicStake(play.units)),
    [plays],
  );
  const initialRows = useMemo(
    () => allInitial.slice(0, PROOF_HISTORY_PAGE_SIZE),
    [allInitial],
  );
  const [shown, setShown] = useState(initialRows);
  const [nextCursor, setNextCursor] = useState(initialNextCursor);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [isLoading, startLoading] = useTransition();
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const localRemaining = useMemo(
    () => allInitial.slice(shown.length),
    [allInitial, shown.length],
  );
  const canLoadMore = localRemaining.length > 0 || nextCursor != null;

  const loadMore = useCallback(() => {
    if (localRemaining.length > 0) {
      setShown((current) => [
        ...current,
        ...localRemaining.slice(0, PROOF_HISTORY_PAGE_SIZE),
      ]);
      return;
    }
    if (!nextCursor || isLoading) return;
    setLoadError(null);
    startLoading(async () => {
      try {
        const requestedCursor = nextCursor;
        const page = await loadPublicProfileHistory(handle, requestedCursor);
        setShown((current) => {
          const byId = new Map(current.map((play) => [play.id, play]));
          for (const play of page.plays) byId.set(play.id, play);
          return [...byId.values()];
        });
        setNextCursor(
          page.nextCursor === requestedCursor ? null : page.nextCursor,
        );
      } catch {
        setLoadError("Pick history could not load. Try again.");
      }
    });
  }, [handle, isLoading, localRemaining, nextCursor]);

  useEffect(() => {
    // A page can be entirely hidden QA receipts. Advance automatically until
    // public evidence is found or the bounded server cursor is exhausted.
    if (shown.length !== 0 || !nextCursor || isLoading || loadError) return;
    const timer = window.setTimeout(loadMore, 0);
    return () => window.clearTimeout(timer);
  }, [isLoading, loadError, loadMore, nextCursor, shown.length]);

  return (
    <div
      data-profile-history-ledger
      className="border-border mt-3 overflow-hidden border-y"
    >
      <table className="w-full table-fixed text-left text-xs">
        <caption className="sr-only">
          Full proof history. Select Ticket to open one canonical proof receipt.
        </caption>
        <thead className="text-muted-foreground border-border border-b text-[0.6rem] tracking-[0.08em] uppercase">
          <tr>
            <th className="w-20 py-2 pr-2 font-medium">Ticket</th>
            <th className="hidden w-[6.5rem] py-2 pr-2 font-medium sm:table-cell">
              Date
            </th>
            <th className="py-2 pr-2 font-medium">Pick</th>
            <th className="hidden w-40 py-2 pr-2 font-medium md:table-cell">
              Game
            </th>
            <th className="hidden w-16 py-2 pr-2 font-medium sm:table-cell">
              Line
            </th>
            <th className="hidden w-16 py-2 pr-2 font-medium md:table-cell">
              CLV
            </th>
            <th className="w-14 py-2 pr-2 font-medium">Result</th>
            <th className="w-16 py-2 pr-2 text-right font-medium">Units</th>
          </tr>
        </thead>
        <tbody className="divide-border divide-y">
          {shown.map((play) => {
            const expanded = expandedId === play.id;
            const resultLabel = proofResultLabel(play);
            const resultClass = proofResultClass(play.outcome);
            const game =
              play.eventLabel ??
              pickContextLabel({
                sport: play.sport,
                league: play.league,
                market: play.market,
              });
            return (
              <Fragment key={play.id}>
                <tr>
                  <td className="py-1 pr-2 align-middle">
                    <button
                      type="button"
                      className="border-border bg-surface-2 text-muted-foreground hover:text-foreground focus-visible:ring-ring inline-flex min-h-10 items-center gap-1 rounded-full border px-2 text-[0.65rem] font-semibold hover:border-[color:var(--scl-blue)] focus-visible:ring-2 focus-visible:outline-none"
                      aria-expanded={expanded}
                      aria-controls={`proof-history-${play.id}`}
                      aria-label={`${expanded ? "Close" : "Open"} ticket for ${play.selection}`}
                      onClick={() => setExpandedId(expanded ? null : play.id)}
                    >
                      <ReceiptText className="size-3" aria-hidden />
                      <span>{expanded ? "Close" : "View"}</span>
                      <ChevronDown
                        className={cn(
                          "size-3 transition-transform duration-200 motion-reduce:transition-none",
                          expanded && "rotate-180",
                        )}
                        aria-hidden
                      />
                    </button>
                  </td>
                  <td className="text-muted-foreground hidden truncate py-2.5 pr-2 tabular-nums sm:table-cell">
                    {asDate(play.createdAt)?.toLocaleDateString("en-US", {
                      month: "short",
                      day: "numeric",
                      year: "numeric",
                      timeZone: "UTC",
                    }) ?? "—"}
                  </td>
                  <td className="py-2.5 pr-2 font-medium">
                    <span className="flex min-w-0 items-center gap-2">
                      {play.market === "Player Prop" ? (
                        <PlayerHeadshot
                          selection={play.selection}
                          league={toHeadshotLeague(play.sport)}
                          size={22}
                          className="shrink-0"
                        />
                      ) : null}
                      <span className="min-w-0">
                        <span className="block truncate">{play.selection}</span>
                        {game ? (
                          <span className="text-muted-foreground mt-0.5 block truncate text-[0.65rem] font-normal md:hidden">
                            {game}
                          </span>
                        ) : null}
                      </span>
                    </span>
                  </td>
                  <td className="text-muted-foreground hidden truncate py-2.5 pr-2 md:table-cell">
                    {game ?? "—"}
                  </td>
                  <td className="scl-data text-muted-foreground hidden py-2.5 pr-2 tabular-nums sm:table-cell">
                    {play.isEmbargoed ? "—" : formatOdds(play.oddsAmerican)}
                  </td>
                  <td className="scl-data text-muted-foreground hidden py-2.5 pr-2 tabular-nums md:table-cell">
                    {play.isEmbargoed ? "—" : formatClvPts(play.clvPts)}
                  </td>
                  <td
                    className={cn(
                      "scl-data py-2.5 pr-2 text-[0.65rem] font-semibold uppercase",
                      resultClass,
                    )}
                  >
                    {resultLabel}
                  </td>
                  <td
                    className={cn(
                      "scl-data py-2.5 pr-2 text-right font-semibold whitespace-nowrap tabular-nums",
                      resultClass,
                    )}
                  >
                    {play.profitUnits == null
                      ? "—"
                      : formatUnits(play.profitUnits, true, false)}
                  </td>
                </tr>
                {expanded ? (
                  <tr id={`proof-history-${play.id}`}>
                    <td
                      colSpan={8}
                      className="bg-surface-2 px-2 py-3 sm:px-4 sm:py-4"
                    >
                      <div className="mx-auto max-w-3xl">
                        {playToProofReceipt(play, "feed")}
                      </div>
                    </td>
                  </tr>
                ) : null}
              </Fragment>
            );
          })}
        </tbody>
      </table>

      {canLoadMore || shown.length > initialRows.length ? (
        <div className="border-border flex flex-wrap items-center justify-end gap-2 border-t px-2 py-2 sm:px-3">
          <div className="flex items-center gap-2">
            {shown.length > initialRows.length ? (
              <button
                type="button"
                className="text-muted-foreground hover:text-foreground min-h-10 rounded-md px-3 text-xs font-semibold underline-offset-4 hover:underline"
                onClick={() => {
                  setShown(initialRows);
                  setNextCursor(initialNextCursor);
                  setLoadError(null);
                  setExpandedId(null);
                }}
              >
                Show fewer
              </button>
            ) : null}
            {canLoadMore ? (
              <button
                type="button"
                className="border-border bg-surface-2 hover:bg-surface-3 min-h-10 rounded-md border px-3 text-xs font-semibold"
                disabled={isLoading}
                onClick={loadMore}
              >
                {isLoading
                  ? "Loading…"
                  : localRemaining.length > 0
                    ? `Show ${Math.min(PROOF_HISTORY_PAGE_SIZE, localRemaining.length)} more`
                    : "Show more"}
              </button>
            ) : null}
          </div>
          {loadError ? (
            <p
              className="basis-full text-xs text-[color:var(--scl-loss-text)]"
              role="status"
            >
              {loadError}
            </p>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}

function proofResultLabel(play: PlayView): string {
  const state = deriveProofReceiptState({
    outcome: play.outcome,
    eventStartsAt: play.eventStartsAt,
    verificationTier: play.verificationTier,
  });
  if (state === "won") return "Won";
  if (state === "loss") return "Loss";
  if (state === "push") return "Push";
  if (state === "void") return "Void";
  if (state === "live") return "Pending";
  if (state === "awaiting-grade") return "Awaiting";
  return "Pending";
}

function proofResultClass(outcome: PlayView["outcome"]): string {
  if (outcome === "WIN") return "text-[color:var(--scl-win-text)]";
  if (outcome === "LOSS") return "text-[color:var(--scl-loss-text)]";
  return "text-muted-foreground";
}

type EvidenceMetrics = {
  record: CapperSummary["record"] | null;
  winPct: number | null;
  roi: number | null;
  units: number | null;
  graded: number;
};

function evidenceMetrics(
  capper: CapperSummary,
  evidence: PackageEvidence | null | undefined,
): EvidenceMetrics {
  if (evidence === undefined) {
    return {
      record: capper.record,
      winPct: capper.winPct,
      roi: capper.roi,
      units: capper.units,
      graded: capper.settledPicks ?? 0,
    };
  }

  const record = evidence?.record ?? null;
  const decisions = record ? record.w + record.l : 0;
  return {
    record,
    winPct: decisions > 0 && record ? (record.w / decisions) * 100 : null,
    roi: evidence?.roi ?? null,
    units: evidence?.units ?? null,
    graded: evidence?.settledPicks ?? 0,
  };
}

function MetricRow({
  metrics,
  avgClv,
  clvScale,
}: {
  metrics: EvidenceMetrics;
  avgClv?: number | null;
  clvScale: ReturnType<typeof perfScale>;
}) {
  // These cells render `truncateValue={false}` so a value is never ellipsised
  // mid-number. Record is by far the widest stat — a carried-over legacy record
  // reads 1714-1569-12 — so on the five-across layout it gets a wider track and
  // every cell gets a real gap. Equal tracks let it run flush into the ROI value.
  return (
    <div
      data-profile-metric-row
      className="grid grid-cols-2 gap-x-4 gap-y-4 sm:grid-cols-3 xl:grid-cols-[1.5fr_1fr_1fr_1fr_1fr_1fr]"
    >
      <MetricCell>
        {metrics.record ? (
          <RecordStat record={metrics.record} truncateValue={false} />
        ) : (
          <StatBlock label="Record" value="—" truncateValue={false} />
        )}
      </MetricCell>
      <MetricCell>
        {metrics.winPct != null ? (
          <WinRateStat
            winPct={metrics.winPct}
            gradedCount={metrics.graded}
            truncateValue={false}
          />
        ) : (
          <StatBlock label="Win%" value="—" truncateValue={false} />
        )}
      </MetricCell>
      <MetricCell>
        {metrics.roi != null ? (
          <RoiStat
            roi={metrics.roi}
            gradedCount={metrics.graded}
            truncateValue={false}
          />
        ) : (
          <StatBlock label="ROI" value="—" truncateValue={false} />
        )}
      </MetricCell>
      <MetricCell>
        {metrics.units != null ? (
          <UnitStat
            units={metrics.units}
            gradedCount={metrics.graded}
            truncateValue={false}
          />
        ) : (
          <StatBlock label="Units" value="—" truncateValue={false} />
        )}
      </MetricCell>
      <MetricCell>
        <StatBlock
          label="Sample"
          value={metrics.graded.toLocaleString()}
          truncateValue={false}
        />
      </MetricCell>
      <MetricCell last>
        <StatBlock
          label="CLV"
          value={avgClv != null ? formatClvPts(avgClv) : "—"}
          valueClassName={perfToneClass(clvScale.tone)}
          aria-label={clvScale.ariaLabel}
          truncateValue={false}
        />
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
