"use client";

import Link from "next/link";
import { useMemo, useState, useSyncExternalStore } from "react";
import { Activity, ArrowRight } from "lucide-react";

import { LeagueMark } from "@/components/scl/league-mark";
import { SampleMaturityMeter } from "@/components/scl/sample-maturity-meter";
import { SportTag } from "@/components/scl/badges";
import { StatValue } from "@/components/scl/stat-value";
import { EmptyState } from "@/components/scl/states";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { formatRoi, formatUnits } from "@/lib/format";
import {
  LEAGUE_ACTION_CATEGORY_EMPTY,
  PLATFORM_REPORT_ELIGIBILITY_FOOTNOTE,
  PLATFORM_REPORT_SEGMENT_LABEL,
  countLabel,
  marketCategories,
  platformTrackedPicks,
  shapeCategories,
  type LeagueActionCategoryItem,
  type LeagueActionItem,
} from "@/lib/league-action";
import { perfScale, perfToneClass, type PerfTone } from "@/lib/perf-scale";
import { hasSignal } from "@/lib/sample";
import { cn } from "@/lib/utils";

const LEAGUES_EMPTY = "No verified league activity in the last 14 days.";

/** Desktop Top Leagues tracks. */
const LEAGUE_LIST_COLS =
  "grid-cols-[1.5rem_1.75rem_minmax(0,1fr)_4.5rem_4.5rem]";

/** Desktop bet-type tracks — never applied under sm (mobile uses cards). */
const BET_TYPE_COLS =
  "grid-cols-[minmax(0,1.1fr)_minmax(5.5rem,0.7fr)_4.25rem_4.25rem_4.5rem]";

type TabKey = "types" | "leagues";

function subscribeLg(onStoreChange: () => void) {
  const mq = window.matchMedia("(min-width: 1024px)");
  mq.addEventListener("change", onStoreChange);
  return () => mq.removeEventListener("change", onStoreChange);
}

function getLgSnapshot() {
  return window.matchMedia("(min-width: 1024px)").matches;
}

function Metric({
  label,
  value,
  emphasize = false,
}: {
  label: string;
  value: number;
  emphasize?: boolean;
}) {
  return (
    <div className="min-w-0">
      <StatValue
        tone="text"
        className={cn(
          "block font-bold tabular-nums",
          emphasize ? "text-2xl sm:text-3xl" : "text-xl",
        )}
      >
        {value.toLocaleString()}
      </StatValue>
      <span className="scl-eyebrow mt-1 block">{label}</span>
    </div>
  );
}

/** Sample-volume bar — neutral muted fill (never blue). No animated width. */
function SampleVolumeBar({ value, max }: { value: number; max: number }) {
  const pct = max > 0 ? Math.max(value > 0 ? 8 : 0, (value / max) * 100) : 0;
  return (
    <div
      className="bg-surface-3 h-1.5 w-full overflow-hidden rounded-full"
      aria-hidden
    >
      <div
        className="h-full rounded-full bg-[color:var(--scl-muted-label)]/55"
        style={{ width: `${pct}%` }}
      />
    </div>
  );
}

function perfBarFill(tone: PerfTone): string {
  switch (tone) {
    case "pos":
      return "bg-[color:var(--scl-perf-strong)]";
    case "neg":
      return "bg-[color:var(--scl-perf-weak)]";
    case "amber":
      return "bg-[color:var(--scl-perf-mid)]";
    case "muted":
    default:
      return "bg-[color:var(--scl-muted-label)]/55";
  }
}

/**
 * Performance magnitude bar — fill from perf-scale tone (never blue).
 * Static width (not on the sanctioned motion list).
 */
function PerfMagnitudeBar({
  metric,
  value,
  graded,
  maxAbs,
}: {
  metric: "roi" | "units";
  value: number | null;
  graded: number;
  maxAbs: number;
}) {
  if (value == null || !hasSignal(graded) || maxAbs <= 0) {
    return (
      <div
        className="bg-surface-3 h-1.5 w-full overflow-hidden rounded-full"
        aria-hidden
      />
    );
  }
  const scale = perfScale(metric, value, { gradedCount: graded });
  const pct = Math.max(8, Math.min(100, (Math.abs(value) / maxAbs) * 100));
  return (
    <div
      className="bg-surface-3 h-1.5 w-full overflow-hidden rounded-full"
      aria-hidden
    >
      <div
        className={cn("h-full rounded-full", perfBarFill(scale.tone))}
        style={{ width: `${pct}%` }}
      />
    </div>
  );
}

function PerfCell({
  metric,
  value,
  graded,
  align = "right",
}: {
  metric: "roi" | "units";
  value: number | null;
  graded: number;
  align?: "left" | "right";
}) {
  const alignClass = align === "right" ? "text-right" : "text-left";
  if (value == null || !hasSignal(graded)) {
    return (
      <span
        className={cn("block", alignClass)}
        title="Not available — sample below signal threshold"
      >
        <StatValue tone="data" className="text-sm font-semibold">
          —
        </StatValue>
      </span>
    );
  }
  const scale = perfScale(metric, value, { gradedCount: graded });
  return (
    <span className={cn("block", alignClass)} title={scale.ariaLabel}>
      <StatValue
        tone="text"
        className={cn(
          "text-sm font-bold tabular-nums",
          perfToneClass(scale.tone),
        )}
      >
        {metric === "roi" ? formatRoi(value) : formatUnits(value)}
      </StatValue>
    </span>
  );
}

function betTypeTiming(cat: LeagueActionCategoryItem): string | null {
  if (cat.preGame == null || cat.live == null) return null;
  return `${cat.preGame.toLocaleString()} pre-game · ${cat.live.toLocaleString()} live`;
}

/** Mobile card — stacks metrics; no horizontal min-width. */
function BetTypeMobileCard({
  cat,
  maxUnitsAbs,
}: {
  cat: LeagueActionCategoryItem;
  maxUnitsAbs: number;
}) {
  if (cat.picks <= 0) {
    return (
      <li className="border-border border-b border-[color:var(--scl-line)] py-3 last:border-b-0">
        <p className="scl-eyebrow mb-1">{cat.label}</p>
        <p className="text-muted-foreground text-sm leading-relaxed">
          {LEAGUE_ACTION_CATEGORY_EMPTY[cat.key]}
        </p>
      </li>
    );
  }

  const timing = betTypeTiming(cat);

  return (
    <li className="border-border space-y-3 border-b border-[color:var(--scl-line)] py-3 last:border-b-0">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <h3 className="scl-display text-sm font-bold tracking-[0.04em] uppercase">
            {cat.label}
          </h3>
          <p className="text-muted-foreground mt-0.5 text-xs leading-relaxed">
            {countLabel(cat.picks, "pick", "picks")} tracked ·{" "}
            {countLabel(cat.cappers, "capper", "cappers")}
            {timing ? ` · ${timing}` : ""}
          </p>
        </div>
        <SampleMaturityMeter graded={cat.graded} compact />
      </div>
      <div className="grid grid-cols-3 gap-3">
        <div>
          <p className="scl-eyebrow">Graded</p>
          <StatValue tone="text" className="mt-0.5 text-sm font-bold">
            {cat.graded.toLocaleString()}
          </StatValue>
        </div>
        <div>
          <p className="scl-eyebrow">ROI</p>
          <div className="mt-0.5">
            <PerfCell
              metric="roi"
              value={cat.roi}
              graded={cat.graded}
              align="left"
            />
          </div>
        </div>
        <div>
          <p className="scl-eyebrow">Units</p>
          <div className="mt-0.5">
            <PerfCell
              metric="units"
              value={cat.units}
              graded={cat.graded}
              align="left"
            />
          </div>
        </div>
      </div>
      <PerfMagnitudeBar
        metric="units"
        value={cat.units}
        graded={cat.graded}
        maxAbs={maxUnitsAbs || 1}
      />
    </li>
  );
}

function BetTypeDesktopRow({
  cat,
  maxUnitsAbs,
}: {
  cat: LeagueActionCategoryItem;
  maxUnitsAbs: number;
}) {
  if (cat.picks <= 0) {
    return (
      <li className="border-border border-b py-3 last:border-b-0">
        <p className="scl-eyebrow mb-1">{cat.label}</p>
        <p className="text-muted-foreground text-sm leading-relaxed">
          {LEAGUE_ACTION_CATEGORY_EMPTY[cat.key]}
        </p>
      </li>
    );
  }

  const timing = betTypeTiming(cat);

  return (
    <li
      className={`border-border grid min-h-14 ${BET_TYPE_COLS} items-center gap-3 border-b py-3 last:border-b-0`}
    >
      <div className="min-w-0">
        <h3 className="scl-display text-sm font-bold tracking-[0.04em] uppercase">
          {cat.label}
        </h3>
        <p className="text-muted-foreground mt-0.5 text-xs">
          {countLabel(cat.picks, "pick", "picks")} tracked ·{" "}
          {countLabel(cat.cappers, "capper", "cappers")}
          {timing ? ` · ${timing}` : ""}
        </p>
        <div className="mt-1.5 max-w-[12rem]">
          <PerfMagnitudeBar
            metric="units"
            value={cat.units}
            graded={cat.graded}
            maxAbs={maxUnitsAbs || 1}
          />
        </div>
      </div>
      <SampleMaturityMeter graded={cat.graded} compact />
      <StatValue
        tone="text"
        className="text-right text-sm font-bold tabular-nums"
      >
        {cat.graded.toLocaleString()}
      </StatValue>
      <PerfCell metric="roi" value={cat.roi} graded={cat.graded} />
      <PerfCell metric="units" value={cat.units} graded={cat.graded} />
    </li>
  );
}

function BetTypeSection({
  title,
  rows,
  maxUnitsAbs,
}: {
  title: string;
  rows: LeagueActionCategoryItem[];
  maxUnitsAbs: number;
}) {
  return (
    <section className="space-y-2">
      <h3 className="scl-eyebrow">{title}</h3>

      {/* Mobile cards — no min-width, no page h-scroll at 375 */}
      <ul className="border-border divide-border divide-y overflow-hidden rounded-lg border px-3 sm:hidden">
        {rows.map((cat) => (
          <BetTypeMobileCard
            key={cat.key}
            cat={cat}
            maxUnitsAbs={maxUnitsAbs}
          />
        ))}
      </ul>

      {/* Desktop grid */}
      <div className="border-border hidden overflow-hidden rounded-lg border sm:block">
        <div
          className={`text-muted-foreground ${BET_TYPE_COLS} items-end gap-3 border-b px-3 py-2 text-[0.7rem] font-semibold uppercase sm:grid`}
        >
          <span>Type</span>
          <span className="text-right">Sample</span>
          <span className="text-right">Graded</span>
          <span className="text-right">ROI</span>
          <span className="text-right">Units</span>
        </div>
        <ul className="px-3">
          {rows.map((cat) => (
            <BetTypeDesktopRow
              key={cat.key}
              cat={cat}
              maxUnitsAbs={maxUnitsAbs}
            />
          ))}
        </ul>
      </div>
    </section>
  );
}

function LeagueMobileCard({
  league,
  index,
  maxPicks,
}: {
  league: LeagueActionItem;
  index: number;
  maxPicks: number;
}) {
  return (
    <li className="border-border space-y-2 border-b border-[color:var(--scl-line)] py-3 last:border-b-0">
      <div className="flex items-center gap-3">
        <span className="scl-data text-muted-foreground w-5 text-sm font-semibold tabular-nums">
          {index + 1}
        </span>
        <LeagueMark leagueKey={league.sport || league.league} size="md" />
        <div className="min-w-0 flex-1">
          <div className="flex min-w-0 flex-wrap items-center gap-2">
            <h3 className="scl-display truncate text-sm font-bold tracking-[0.04em] uppercase">
              {league.league}
            </h3>
            {league.sport &&
            league.sport.toUpperCase() !== league.league.toUpperCase() ? (
              <SportTag sport={league.sport} withMark={false} />
            ) : null}
          </div>
        </div>
      </div>
      <div className="grid grid-cols-2 gap-3 pl-8">
        <div>
          <p className="scl-eyebrow">Picks</p>
          <StatValue tone="text" className="mt-0.5 text-sm font-bold">
            {league.pickCount.toLocaleString()}
          </StatValue>
        </div>
        <div>
          <p className="scl-eyebrow">Cappers</p>
          <StatValue tone="text" className="mt-0.5 text-sm font-bold">
            {league.activeCappers.toLocaleString()}
          </StatValue>
        </div>
      </div>
      <div className="pl-8">
        <SampleVolumeBar value={league.pickCount} max={maxPicks || 1} />
      </div>
    </li>
  );
}

function ButtonishPicksLink({ label }: { label: string }) {
  return (
    <Link
      href="/picks"
      className="scl-link inline-flex min-h-10 items-center gap-1.5 text-sm font-semibold"
    >
      {label}
      <ArrowRight className="size-3.5" aria-hidden />
    </Link>
  );
}

export function LeagueActionReport({
  leagues,
  categories,
  windowDays,
  trackedPicks: trackedPicksProp,
  failed = false,
}: {
  leagues: LeagueActionItem[];
  categories: LeagueActionCategoryItem[];
  windowDays: number;
  trackedPicks?: number;
  failed?: boolean;
}) {
  const trackedPicks = trackedPicksProp ?? platformTrackedPicks(categories);
  const shape = useMemo(() => shapeCategories(categories), [categories]);
  const market = useMemo(() => marketCategories(categories), [categories]);
  const liveSegments = categories.filter((c) => c.picks > 0).length;
  const maxLeaguePicks = useMemo(
    () => Math.max(0, ...leagues.map((l) => l.pickCount)),
    [leagues],
  );
  const maxUnitsAbs = useMemo(() => {
    const vals = categories
      .map((c) => c.units)
      .filter((v): v is number => v != null && Number.isFinite(v));
    return vals.length ? Math.max(...vals.map(Math.abs)) : 0;
  }, [categories]);

  const [tab, setTab] = useState<TabKey>(
    trackedPicks > 0 || categories.some((c) => c.picks > 0)
      ? "types"
      : leagues.length > 0
        ? "leagues"
        : "types",
  );
  const isLg = useSyncExternalStore(subscribeLg, getLgSnapshot, () => false);
  const [mobileOpen, setMobileOpen] = useState(false);

  if (failed) {
    return (
      <EmptyState
        icon={Activity}
        title="Couldn't load platform activity"
        description="Recent bet-type activity is temporarily unavailable. Please try again shortly."
      />
    );
  }

  if (trackedPicks === 0 && leagues.length === 0) {
    return (
      <EmptyState
        icon={Activity}
        title="No platform activity yet"
        description="Tracked bet-type volume will appear here as founding cappers submit board-verified plays."
      />
    );
  }

  return (
    <div
      className="border-border relative overflow-hidden rounded-xl border bg-[color:var(--scl-ink-800)]"
      data-visual-mode="live"
    >
      {/* Live cobalt rail */}
      <div
        className="pointer-events-none absolute inset-y-0 left-0 w-1 bg-[color:var(--scl-blue)]"
        aria-hidden
      />

      {/* Flat ink-800 header + structural hairline (no gradient) */}
      <div className="border-border flex flex-wrap items-end justify-between gap-4 border-b px-4 py-4 pl-5 sm:px-5 sm:pl-6">
        <div className="flex flex-wrap gap-6 sm:gap-8">
          <Metric
            label={`${windowDays}d board-verified`}
            value={trackedPicks}
            emphasize
          />
          <Metric label={PLATFORM_REPORT_SEGMENT_LABEL} value={liveSegments} />
          <Metric label="Leagues ranked" value={leagues.length} />
        </div>
        <div className="flex flex-col items-end gap-1">
          <p className="scl-eyebrow text-right">
            Last {windowDays} days · board clock
          </p>
          <ButtonishPicksLink label="Open pick feed" />
        </div>
      </div>

      {/* Mobile: secondary breakdown collapsed; desktop forced open — single mount. */}
      <details
        className="group border-border border-b"
        open={isLg ? true : mobileOpen}
        onToggle={(e) => {
          if (isLg) {
            e.currentTarget.open = true;
            return;
          }
          setMobileOpen(e.currentTarget.open);
        }}
      >
        <summary className="flex cursor-pointer list-none items-center justify-between gap-3 px-4 py-3 pl-5 outline-none focus-visible:ring-2 focus-visible:ring-[color:var(--scl-blue)] focus-visible:ring-inset lg:hidden [&::-webkit-details-marker]:hidden">
          <span className="min-w-0">
            <span className="text-foreground block text-sm font-semibold">
              Bet-type breakdown
            </span>
            <span className="text-muted-foreground mt-0.5 block text-xs leading-snug">
              Shape, market, and top leagues — expand for full report
            </span>
          </span>
          <span className="text-muted-foreground shrink-0 text-xs font-semibold tracking-wide uppercase group-open:hidden">
            Show
          </span>
          <span className="text-muted-foreground hidden shrink-0 text-xs font-semibold tracking-wide uppercase group-open:inline">
            Hide
          </span>
        </summary>
        <PlatformReportTabs
          tab={tab}
          setTab={setTab}
          shape={shape}
          market={market}
          leagues={leagues}
          maxUnitsAbs={maxUnitsAbs}
          maxLeaguePicks={maxLeaguePicks}
        />
      </details>

      <p className="text-muted-foreground border-border border-t px-4 py-2.5 pl-5 text-xs leading-relaxed sm:px-5 sm:pl-6">
        {PLATFORM_REPORT_ELIGIBILITY_FOOTNOTE}
      </p>
    </div>
  );
}

function PlatformReportTabs({
  tab,
  setTab,
  shape,
  market,
  leagues,
  maxUnitsAbs,
  maxLeaguePicks,
}: {
  tab: TabKey;
  setTab: (v: TabKey) => void;
  shape: LeagueActionCategoryItem[];
  market: LeagueActionCategoryItem[];
  leagues: LeagueActionItem[];
  maxUnitsAbs: number;
  maxLeaguePicks: number;
}) {
  return (
    <Tabs
      value={tab}
      onValueChange={(v) => setTab(v as TabKey)}
      className="gap-0"
    >
      <div className="border-border border-b px-2 py-2 pl-4 sm:px-3 sm:pl-5">
        <TabsList
          variant="line"
          className="h-auto w-full flex-wrap justify-start gap-1"
        >
          <TabsTrigger
            value="types"
            className="data-active:text-foreground min-h-9 px-3 data-active:underline data-active:decoration-[color:var(--scl-blue)] data-active:underline-offset-4"
          >
            Bet types
          </TabsTrigger>
          <TabsTrigger
            value="leagues"
            className="data-active:text-foreground min-h-9 px-3 data-active:underline data-active:decoration-[color:var(--scl-blue)] data-active:underline-offset-4"
          >
            Top leagues
            {leagues.length > 0 ? (
              <span className="scl-data text-muted-foreground ml-1 text-[0.7rem]">
                {leagues.length}
              </span>
            ) : null}
          </TabsTrigger>
        </TabsList>
      </div>

      <div className="px-4 py-4 pl-5 sm:px-5 sm:pl-6">
        <TabsContent value="types" className="mt-0 space-y-6">
          <BetTypeSection
            title="Shape"
            rows={shape}
            maxUnitsAbs={maxUnitsAbs}
          />
          <BetTypeSection
            title="Market"
            rows={market}
            maxUnitsAbs={maxUnitsAbs}
          />
          <ButtonishPicksLink label="Browse verified picks" />
        </TabsContent>

        <TabsContent value="leagues" className="mt-0">
          {leagues.length === 0 ? (
            <p className="text-muted-foreground py-6 text-sm leading-relaxed">
              {LEAGUES_EMPTY}
            </p>
          ) : (
            <>
              {/* Mobile league cards */}
              <ul className="border-border divide-border divide-y overflow-hidden rounded-lg border px-3 sm:hidden">
                {leagues.map((league, index) => (
                  <LeagueMobileCard
                    key={league.key}
                    league={league}
                    index={index}
                    maxPicks={maxLeaguePicks || 1}
                  />
                ))}
              </ul>

              {/* Desktop league list — open hairline rows */}
              <div className="hidden sm:block">
                <div
                  className={`text-muted-foreground mb-1 grid ${LEAGUE_LIST_COLS} items-end gap-3 pb-2 text-[0.7rem] font-semibold uppercase`}
                >
                  <span>#</span>
                  <span aria-hidden />
                  <span>League</span>
                  <span className="text-right">Picks</span>
                  <span className="text-right">Cappers</span>
                </div>
                <ul className="divide-border divide-y">
                  {leagues.map((league, index) => (
                    <li
                      key={league.key}
                      className={`grid min-h-14 ${LEAGUE_LIST_COLS} items-center gap-3 py-3 first:pt-0 last:pb-0`}
                    >
                      <span className="scl-data text-muted-foreground text-sm font-semibold tabular-nums">
                        {index + 1}
                      </span>
                      <LeagueMark
                        leagueKey={league.sport || league.league}
                        size="md"
                      />
                      <div className="min-w-0">
                        <div className="flex min-w-0 flex-wrap items-center gap-2">
                          <h3 className="scl-display truncate text-sm font-bold tracking-[0.04em] uppercase">
                            {league.league}
                          </h3>
                          {league.sport &&
                          league.sport.toUpperCase() !==
                            league.league.toUpperCase() ? (
                            <SportTag sport={league.sport} withMark={false} />
                          ) : null}
                        </div>
                        <div className="mt-1.5 max-w-xs">
                          <SampleVolumeBar
                            value={league.pickCount}
                            max={maxLeaguePicks || 1}
                          />
                        </div>
                      </div>
                      <StatValue
                        tone="text"
                        className="text-right text-sm font-bold tabular-nums"
                      >
                        {league.pickCount.toLocaleString()}
                      </StatValue>
                      <StatValue
                        tone="text"
                        className="text-right text-sm font-bold tabular-nums"
                      >
                        {league.activeCappers.toLocaleString()}
                      </StatValue>
                    </li>
                  ))}
                </ul>
              </div>
            </>
          )}
        </TabsContent>
      </div>
    </Tabs>
  );
}
