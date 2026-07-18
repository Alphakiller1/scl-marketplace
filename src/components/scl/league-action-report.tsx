"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
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
  marketCategories,
  platformTrackedPicks,
  shapeCategories,
  type LeagueActionCategoryItem,
  type LeagueActionItem,
} from "@/lib/league-action";
import { perfScale, perfToneClass } from "@/lib/perf-scale";
import { hasSignal } from "@/lib/sample";
import { cn } from "@/lib/utils";

const LEAGUES_EMPTY = "No verified league activity in the last 14 days.";

/** Top Leagues list — keep header + rows on the same tracks. */
const LEAGUE_LIST_COLS =
  "grid-cols-[1.5rem_1.75rem_minmax(0,1fr)_4.5rem_4.5rem]";

const BET_TYPE_COLS =
  "grid-cols-[minmax(0,1.1fr)_minmax(5.5rem,0.7fr)_4.25rem_4.25rem_4.5rem]";

type TabKey = "types" | "leagues";

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
      <span className="text-muted-foreground text-[0.7rem] font-semibold tracking-wide uppercase">
        {label}
      </span>
    </div>
  );
}

function VolumeBar({ value, max }: { value: number; max: number }) {
  const pct = max > 0 ? Math.max(value > 0 ? 8 : 0, (value / max) * 100) : 0;
  return (
    <div
      className="bg-surface-3 h-1.5 w-full overflow-hidden rounded-full"
      aria-hidden
    >
      <div
        className="h-full rounded-full bg-[color:var(--scl-blue)] transition-[width] duration-300"
        style={{ width: `${pct}%` }}
      />
    </div>
  );
}

function PerfCell({
  metric,
  value,
  graded,
}: {
  metric: "roi" | "units";
  value: number | null;
  graded: number;
}) {
  if (value == null || !hasSignal(graded)) {
    return (
      <span
        className="block text-right"
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
    <span className="block text-right" title={scale.ariaLabel}>
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

function BetTypeRow({ cat }: { cat: LeagueActionCategoryItem }) {
  if (cat.picks <= 0) {
    return (
      <li className="border-border border-b py-3 last:border-b-0">
        <p className="scl-eyebrow text-muted-foreground mb-1">{cat.label}</p>
        <p className="text-muted-foreground text-sm leading-relaxed">
          {LEAGUE_ACTION_CATEGORY_EMPTY[cat.key]}
        </p>
      </li>
    );
  }

  const timing =
    cat.preGame != null && cat.live != null
      ? `${cat.preGame.toLocaleString()} pre-game · ${cat.live.toLocaleString()} live`
      : null;

  return (
    <li
      className={`border-border grid min-h-14 ${BET_TYPE_COLS} items-center gap-2 border-b py-3 last:border-b-0 sm:gap-3`}
    >
      <div className="min-w-0">
        <h3 className="scl-display text-sm font-bold tracking-[0.04em] uppercase">
          {cat.label}
        </h3>
        <p className="text-muted-foreground mt-0.5 text-xs">
          {cat.picks.toLocaleString()} tracked · {cat.cappers.toLocaleString()}{" "}
          cappers
          {timing ? ` · ${timing}` : ""}
        </p>
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
}: {
  title: string;
  rows: LeagueActionCategoryItem[];
}) {
  return (
    <section className="space-y-2">
      <h3 className="scl-eyebrow text-muted-foreground">{title}</h3>
      <div className="border-border overflow-x-auto rounded-lg border">
        <div
          className={`text-muted-foreground hidden min-w-[28rem] ${BET_TYPE_COLS} items-end gap-2 border-b px-3 py-2 text-[0.7rem] font-semibold uppercase sm:grid sm:gap-3`}
        >
          <span>Type</span>
          <span className="text-right">Sample</span>
          <span className="text-right">Graded</span>
          <span className="text-right">ROI</span>
          <span className="text-right">Units</span>
        </div>
        <ul className="min-w-[28rem] px-3">
          {rows.map((cat) => (
            <BetTypeRow key={cat.key} cat={cat} />
          ))}
        </ul>
      </div>
    </section>
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

  const [tab, setTab] = useState<TabKey>(
    trackedPicks > 0 || categories.some((c) => c.picks > 0)
      ? "types"
      : leagues.length > 0
        ? "leagues"
        : "types",
  );

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
      className="border-border bg-card overflow-hidden rounded-xl border"
      data-visual-mode="live"
    >
      <div className="border-border flex flex-wrap items-end justify-between gap-4 border-b bg-gradient-to-br from-[color:var(--scl-ink-800)] to-[color:var(--scl-ink-900)] px-4 py-4 sm:px-5">
        <div className="flex flex-wrap gap-6 sm:gap-8">
          <Metric
            label={`${windowDays}d board-verified`}
            value={trackedPicks}
            emphasize
          />
          <Metric label="Live segments" value={liveSegments} />
          <Metric label="Leagues ranked" value={leagues.length} />
        </div>
        <ButtonishPicksLink label="Open pick feed" />
      </div>

      <Tabs
        value={tab}
        onValueChange={(v) => setTab(v as TabKey)}
        className="gap-0"
      >
        <div className="border-border overflow-x-auto border-b px-2 py-2 sm:px-3">
          <TabsList
            variant="line"
            className="h-auto w-max min-w-full justify-start gap-1"
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

        <div className="px-4 py-4 sm:px-5">
          <TabsContent value="types" className="mt-0 space-y-6">
            <BetTypeSection title="Shape" rows={shape} />
            <BetTypeSection title="Market" rows={market} />
            <ButtonishPicksLink label="Browse verified picks" />
          </TabsContent>

          <TabsContent value="leagues" className="mt-0">
            {leagues.length === 0 ? (
              <p className="text-muted-foreground py-6 text-sm leading-relaxed">
                {LEAGUES_EMPTY}
              </p>
            ) : (
              <div>
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
                          <VolumeBar
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
            )}
          </TabsContent>
        </div>
      </Tabs>

      <p className="text-muted-foreground border-border border-t px-4 py-2.5 text-xs sm:px-5">
        {PLATFORM_REPORT_ELIGIBILITY_FOOTNOTE}
      </p>
    </div>
  );
}
