"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { Activity, ArrowRight } from "lucide-react";

import { LeagueMark } from "@/components/scl/league-mark";
import { SportTag } from "@/components/scl/badges";
import { StatValue } from "@/components/scl/stat-value";
import { EmptyState } from "@/components/scl/states";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  LEAGUE_ACTION_CATEGORY_EMPTY,
  type LeagueActionCategoryItem,
  type LeagueActionItem,
} from "@/lib/league-action";
import { cn } from "@/lib/utils";

const LEAGUES_EMPTY = "No verified league activity in the last 14 days.";
const FOOTNOTE =
  "Counts include ranked and building-a-record cappers. Test accounts are excluded.";

/** Top Leagues list — keep header + rows on the same tracks. */
const LEAGUE_LIST_COLS =
  "grid-cols-[1.5rem_1.75rem_minmax(0,1fr)_4.5rem_4.5rem]";

type TabKey = "leagues" | LeagueActionCategoryItem["key"];

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

function CategoryPanel({
  cat,
  maxPicks,
}: {
  cat: LeagueActionCategoryItem;
  maxPicks: number;
}) {
  if (cat.picks <= 0) {
    return (
      <p className="text-muted-foreground py-6 text-sm leading-relaxed">
        {LEAGUE_ACTION_CATEGORY_EMPTY[cat.key]}
      </p>
    );
  }

  return (
    <div className="space-y-4 py-2">
      <div className="grid grid-cols-2 gap-4 sm:max-w-md">
        <Metric label="Verified picks" value={cat.picks} emphasize />
        <Metric label="Active cappers" value={cat.cappers} />
      </div>
      <div className="space-y-1.5">
        <div className="text-muted-foreground flex items-center justify-between text-[0.7rem] font-semibold tracking-wide uppercase">
          <span>Share of category volume</span>
          <span className="scl-data">
            {maxPicks > 0
              ? `${Math.round((cat.picks / maxPicks) * 100)}% of top segment`
              : "—"}
          </span>
        </div>
        <VolumeBar value={cat.picks} max={maxPicks} />
      </div>
      <ButtonishPicksLink label={`Browse ${cat.label.toLowerCase()}`} />
    </div>
  );
}

function ButtonishPicksLink({ label }: { label: string }) {
  return (
    <Link
      href="/picks"
      className="inline-flex min-h-10 items-center gap-1.5 text-sm font-semibold text-[color:var(--scl-blue)] hover:underline"
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
  failed = false,
}: {
  leagues: LeagueActionItem[];
  categories: LeagueActionCategoryItem[];
  windowDays: number;
  failed?: boolean;
}) {
  const totalPicks = useMemo(
    () => categories.reduce((sum, c) => sum + c.picks, 0),
    [categories],
  );
  const maxCategoryPicks = useMemo(
    () => Math.max(0, ...categories.map((c) => c.picks)),
    [categories],
  );
  const maxLeaguePicks = useMemo(
    () => Math.max(0, ...leagues.map((l) => l.pickCount)),
    [leagues],
  );
  const liveSegments = categories.filter((c) => c.picks > 0).length;

  const defaultTab = useMemo<TabKey>(() => {
    if (leagues.length > 0) return "leagues";
    const hottest = [...categories].sort((a, b) => b.picks - a.picks)[0];
    if (hottest && hottest.picks > 0) return hottest.key;
    return "leagues";
  }, [categories, leagues]);

  const [tab, setTab] = useState<TabKey>(defaultTab);

  if (failed) {
    return (
      <EmptyState
        icon={Activity}
        title="Couldn't Load League Action"
        description="Recent league activity is temporarily unavailable. Please try again shortly."
      />
    );
  }

  if (totalPicks === 0 && leagues.length === 0) {
    return (
      <EmptyState
        icon={Activity}
        title="No League Action Yet"
        description="Tracked pick volume will appear here as founding cappers submit board-verified plays."
      />
    );
  }

  return (
    <div className="border-border bg-card overflow-hidden rounded-xl border">
      <div className="border-border flex flex-wrap items-end justify-between gap-4 border-b bg-gradient-to-br from-[color:var(--scl-ink-800)] to-[color:var(--scl-ink-900)] px-4 py-4 sm:px-5">
        <div className="flex flex-wrap gap-6 sm:gap-8">
          <Metric
            label={`${windowDays}d verified picks`}
            value={totalPicks}
            emphasize
          />
          <Metric label="Leagues ranked" value={leagues.length} />
          <Metric label="Live segments" value={liveSegments} />
        </div>
        <ButtonishPicksLink label="Open pick feed" />
      </div>

      {/* At-a-glance volume — replaces the old empty five-column wall */}
      <div className="border-border grid grid-cols-2 gap-px border-b bg-[color:var(--scl-line)] sm:grid-cols-5">
        {categories.map((cat) => {
          const active = tab === cat.key;
          const hasVolume = cat.picks > 0;
          return (
            <button
              key={cat.key}
              type="button"
              onClick={() => setTab(cat.key)}
              className={cn(
                "bg-card hover:bg-surface-2 focus-visible:ring-ring flex min-h-[4.5rem] flex-col items-start justify-between gap-2 p-3 text-left transition-colors focus-visible:ring-2 focus-visible:outline-none focus-visible:ring-inset",
                active && "bg-surface-2",
                !hasVolume && "opacity-55",
              )}
            >
              <span className="text-muted-foreground text-[0.65rem] font-semibold tracking-wide uppercase">
                {cat.label}
              </span>
              <div className="w-full space-y-1.5">
                <span
                  className={cn(
                    "scl-data block text-lg font-bold tabular-nums",
                    hasVolume ? "text-foreground" : "text-muted-foreground",
                  )}
                >
                  {cat.picks.toLocaleString()}
                </span>
                <VolumeBar value={cat.picks} max={maxCategoryPicks || 1} />
              </div>
            </button>
          );
        })}
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
              value="leagues"
              className="min-h-9 px-3 data-active:text-[color:var(--scl-blue)]"
            >
              Top Leagues
              {leagues.length > 0 ? (
                <span className="scl-data text-muted-foreground ml-1 text-[0.7rem]">
                  {leagues.length}
                </span>
              ) : null}
            </TabsTrigger>
            {categories.map((cat) => (
              <TabsTrigger
                key={cat.key}
                value={cat.key}
                className="min-h-9 px-3 data-active:text-[color:var(--scl-blue)]"
              >
                {cat.label}
                <span
                  className={cn(
                    "scl-data ml-1 text-[0.7rem]",
                    cat.picks > 0 ? "text-foreground" : "text-muted-foreground",
                  )}
                >
                  {cat.picks}
                </span>
              </TabsTrigger>
            ))}
          </TabsList>
        </div>

        <div className="px-4 py-4 sm:px-5">
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

          {categories.map((cat) => (
            <TabsContent key={cat.key} value={cat.key} className="mt-0">
              <CategoryPanel cat={cat} maxPicks={maxCategoryPicks || 1} />
            </TabsContent>
          ))}
        </div>
      </Tabs>

      <p className="text-muted-foreground border-border border-t px-4 py-2.5 text-xs sm:px-5">
        {FOOTNOTE}
      </p>
    </div>
  );
}
