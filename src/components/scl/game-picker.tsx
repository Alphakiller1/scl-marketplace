"use client";

import { useEffect, useState } from "react";
import { ChevronDown, LayoutGrid, Lock, Search } from "lucide-react";
import { toast } from "sonner";

import { Card } from "@/components/ui/card";
import { DayToggle } from "@/components/scl/day-toggle";
import { EventDetail, type OddsPick } from "@/components/scl/odds-assist";
import { LeagueMark } from "@/components/scl/league-mark";
import { SkeletonCard } from "@/components/scl/states";
import { TeamMark } from "@/components/scl/team-mark";
import {
  categoryCounts,
  filterGamePickerEvents,
  ODDS_BOARD_REQUEST_TIMEOUT_MS,
  preGameEvents,
  ODDS_BOARD_SPORTS,
} from "@/lib/game-picker";
import { loadOddsSlate } from "@/lib/odds-slate-client";
import { filterBySlateDay, type SlateDay } from "@/lib/slate";
import { getTeamIdentity } from "@/lib/teams";
import { cn } from "@/lib/utils";
import type { OddsEvent, OddsSelection } from "@/lib/odds-board";

export type { OddsPick };

type EventDetailData =
  | { status: "ready"; selections: OddsSelection[] }
  | { status: "error" };

type SlateState = {
  events: OddsEvent[];
  configured: boolean;
  failed?: boolean;
  warning?: string;
  stale?: boolean;
};

const EMPTY_SLATE_RETRY_MS = 15_000;
const SLATE_BACKGROUND_REFRESH_MS = 60_000;

/**
 * Shared game browser for straight + parlay (M4 PR-3).
 * Multi-sport slate · day toggle · search · category pills with counts · best price ·
 * TeamMark rows · Request coverage · expands existing EventDetail.
 * Entry-page wiring lands in PR-4 — this ships the component + tests only.
 */
export function GamePicker({
  onPick,
  selectedKeys,
  onRequestCoverage,
  className,
}: {
  onPick: (pick: OddsPick) => void;
  selectedKeys?: Set<string>;
  /** Interest only — must not create a pick. */
  onRequestCoverage?: (ctx: {
    search: string;
    category: string;
    day: SlateDay;
  }) => void;
  className?: string;
}) {
  const [slate, setSlate] = useState<SlateState | null>(null);
  const [loading, setLoading] = useState(true);
  const [dayChoice, setDayChoice] = useState<SlateDay | null>(null);
  const [category, setCategory] = useState<string>("all");
  const [search, setSearch] = useState("");
  const [openId, setOpenId] = useState<string | null>(null);
  const [detail, setDetail] = useState<Record<string, EventDetailData>>({});
  const [coverageSent, setCoverageSent] = useState(false);

  useEffect(() => {
    let cancelled = false;
    let retryTimer: ReturnType<typeof setTimeout> | null = null;

    const requestSlate = (forceRefresh = false) => {
      loadOddsSlate(fetch, forceRefresh)
        .then((data) => {
          if (cancelled) return;
          setSlate({
            events: data.events,
            configured: data.configured,
            warning: data.meta?.warning,
            stale: data.meta?.stale,
            failed:
              data.events.length === 0 &&
              data.meta?.warning === "circuit_break",
          });
          if (data.configured && data.events.length === 0) {
            retryTimer = setTimeout(
              () => requestSlate(true),
              EMPTY_SLATE_RETRY_MS,
            );
          }
        })
        .catch((error: unknown) => {
          console.warn("[odds-board] slate request failed", {
            reason: error instanceof Error ? error.name : "unknown",
          });
          if (!cancelled) {
            setSlate({
              events: [],
              configured: true,
              failed: true,
            });
            retryTimer = setTimeout(
              () => requestSlate(true),
              EMPTY_SLATE_RETRY_MS,
            );
          }
        })
        .finally(() => {
          if (!cancelled) setLoading(false);
        });
    };

    requestSlate();
    const refreshInterval = setInterval(
      () => requestSlate(true),
      SLATE_BACKGROUND_REFRESH_MS,
    );
    return () => {
      cancelled = true;
      clearInterval(refreshInterval);
      if (retryTimer) clearTimeout(retryTimer);
    };
  }, []);

  // Pre-game only, everywhere. Day defaults, counts, cards, and the expanded
  // matchup all read from this list so a started game is never selectable.
  const events = preGameEvents(slate?.events ?? []);
  const todayEvents = filterBySlateDay(events, "today");
  const tomorrowEvents = filterBySlateDay(events, "tomorrow");
  const day: SlateDay =
    dayChoice ?? (todayEvents.length ? "today" : "tomorrow");
  const counts = categoryCounts(events);
  const visible = filterGamePickerEvents(events, {
    day,
    category,
    search,
  });

  const openEvent = openId
    ? (events.find((e) => e.id === openId) ?? null)
    : null;

  useEffect(() => {
    if (!openEvent) return;
    if (openEvent.id in detail) return;
    let cancelled = false;
    fetch(
      `/api/odds/event?sport=${encodeURIComponent(openEvent.sport)}&eventId=${encodeURIComponent(openEvent.id)}`,
      { signal: AbortSignal.timeout(ODDS_BOARD_REQUEST_TIMEOUT_MS) },
    )
      .then((r) => {
        if (!r.ok) throw new Error(`Odds detail request failed: ${r.status}`);
        return r.json();
      })
      .then((d) => {
        if (cancelled) return;
        setDetail((prev) => ({
          ...prev,
          [openEvent.id]: {
            status: "ready",
            selections: Array.isArray(d.selections)
              ? (d.selections as OddsSelection[])
              : [],
          },
        }));
      })
      .catch((error: unknown) => {
        console.warn("[odds-board] event detail request failed", {
          sport: openEvent.sport,
          reason: error instanceof Error ? error.name : "unknown",
        });
        if (!cancelled) {
          setDetail((prev) => ({
            ...prev,
            [openEvent.id]: { status: "error" },
          }));
        }
      });
    return () => {
      cancelled = true;
    };
  }, [openEvent, detail]);

  function requestCoverage() {
    const ctx = { search, category, day };
    onRequestCoverage?.(ctx);
    setCoverageSent(true);
    toast.message("Coverage requested", {
      description:
        "We logged your interest — this does not create a pick. Board lines stay the only verified path.",
    });
  }

  function openMatchup(eventId: string) {
    setOpenId(eventId);
  }

  function closeMatchup() {
    setOpenId(null);
  }

  const categoryPills: { key: string; label: string; count: number }[] = [
    { key: "all", label: "All", count: counts.all },
    ...ODDS_BOARD_SPORTS.map((s) => ({
      key: s.key,
      label: s.label,
      count: counts.bySport[s.key] ?? 0,
    })),
  ].filter((pill) => pill.key === "all" || pill.count > 0);

  return (
    <Card className={cn("scl-elevated relative space-y-3 p-4", className)}>
      <div className="scl-section-mark flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <LayoutGrid
            className="size-4 text-[color:var(--scl-blue)]"
            aria-hidden
          />
          <h2 className="scl-display text-sm font-semibold tracking-[0.08em] uppercase">
            Market Board
          </h2>
        </div>
        <span
          className="scl-data inline-flex items-center gap-1.5 rounded-full border border-[color:var(--scl-line)] bg-[color:var(--scl-ink-800)] px-2.5 py-1 text-[0.625rem] font-semibold tracking-[0.08em] text-[color:var(--scl-muted-data)] uppercase"
          title="SCL accepts pre-game picks only — no live betting"
        >
          <Lock className="size-3 shrink-0" aria-hidden />
          {loading ? "…" : visible.length} pre-game
        </span>
      </div>

      <div className="space-y-1.5">
        <p className="scl-eyebrow text-[color:var(--scl-muted-data)]">
          Source Price
        </p>
        <p className="scl-data inline-flex min-h-8 items-center rounded-full border border-[color:var(--scl-blue)] bg-[color:var(--scl-blue)] px-3 text-[10px] font-semibold tracking-[0.08em] text-[color:var(--scl-blue-ink)] uppercase">
          Best available · all books
        </p>
      </div>

      <DayToggle
        day={day}
        todayCount={todayEvents.length}
        tomorrowCount={tomorrowEvents.length}
        loading={loading}
        onChange={(d) => {
          setDayChoice(d);
          setOpenId(null);
        }}
      />

      <label className="relative block">
        <span className="sr-only">Search teams, leagues, or matchups</span>
        <Search
          className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-[color:var(--scl-muted-data)]"
          aria-hidden
        />
        <input
          type="search"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Search teams, leagues, or matchups…"
          className="border-input dark:bg-input/30 focus-visible:border-ring focus-visible:ring-ring/50 h-11 w-full rounded-lg border bg-transparent py-2 pr-3 pl-10 text-sm shadow-xs focus-visible:ring-[3px] focus-visible:outline-none"
        />
      </label>

      <div
        className="flex flex-wrap gap-2 pb-1"
        role="group"
        aria-label="Filter by sport"
      >
        {categoryPills.map((p) => {
          const active = category === p.key;
          return (
            <button
              key={p.key}
              type="button"
              onClick={() => {
                setCategory(p.key);
                setOpenId(null);
              }}
              aria-pressed={active}
              className={cn(
                "scl-display flex h-11 shrink-0 items-center gap-2 rounded-[22px] border px-3.5 text-[15px] font-semibold tracking-[0.05em] transition-opacity",
                active
                  ? "border-[color:var(--scl-blue)] bg-[color:var(--scl-blue)] text-[color:var(--scl-blue-ink)]"
                  : "border-[color:var(--scl-line)] bg-[color:var(--scl-ink-800)] text-[color:var(--scl-muted-data)]",
              )}
            >
              {p.key !== "all" ? (
                <LeagueMark
                  leagueKey={p.key}
                  size="sm"
                  className="rounded-md"
                />
              ) : null}
              {p.label}
              <span
                className={cn(
                  "scl-data rounded-[9px] border px-1.5 py-0.5 text-[10px] font-medium",
                  active
                    ? "border-transparent bg-black/18 text-[color:var(--scl-blue-ink)]"
                    : "border-[color:var(--scl-line)] bg-[color:var(--scl-ink-950)] text-[color:var(--scl-muted-data)]",
                )}
              >
                {p.count}
              </span>
            </button>
          );
        })}
      </div>

      {/*
        The second half of this notice used to promise "every price is checked
        live again before your pick is recorded". That stopped being true when
        the final odds check was removed — `preparePlayLine` states outright that
        submission does not call the odds provider or re-price the line. The
        stale-slate warning itself is still honest and still earns its place, so
        only the claim the product no longer honours is gone.
      */}
      {slate?.stale && events.length > 0 ? (
        <p
          className="rounded-lg border border-amber-500/35 bg-amber-500/10 px-3 py-2 text-xs text-[color:var(--scl-text)]"
          role="status"
        >
          Showing the last available slate — prices may have moved.
        </p>
      ) : null}

      {loading ? (
        <SkeletonCard />
      ) : visible.length ? (
        <ul className="space-y-2 lg:max-h-[40rem] lg:overflow-y-auto lg:pr-1">
          {visible.map((e) => {
            const open = openId === e.id;
            return (
              <li
                key={e.id}
                className="bg-card border-border overflow-hidden rounded-[14px] border"
              >
                <GameRow
                  event={e}
                  open={open}
                  triggerId={`market-event-${e.id}`}
                  onToggle={() => (open ? closeMatchup() : openMatchup(e.id))}
                />
                {open ? (
                  <EventDetail
                    event={e}
                    detail={detail[e.id]}
                    onPick={onPick}
                    selectedKeys={selectedKeys}
                  />
                ) : null}
              </li>
            );
          })}
        </ul>
      ) : slate?.failed ? (
        <p className="text-muted-foreground text-xs">
          Couldn&apos;t load the slate right now — refresh in a moment.
        </p>
      ) : slate?.configured === false ? (
        <p className="text-muted-foreground text-xs">
          Odds feed not configured — add{" "}
          <code className="text-foreground">ODDS_API_KEY</code> in Vercel and
          redeploy to turn on the board.
        </p>
      ) : events.length === 0 && slate?.configured ? (
        <p className="text-muted-foreground text-xs">
          No live board events for this slate right now — try another day or
          sport, or check back closer to game time.
        </p>
      ) : (
        <p className="text-muted-foreground text-xs">
          No games match this filter — try another day, sport, or search.
        </p>
      )}

      <button
        type="button"
        onClick={requestCoverage}
        disabled={coverageSent}
        className="flex min-h-10 w-full items-center justify-center rounded-[14px] border border-dashed border-[color:var(--scl-line)] bg-[color:var(--scl-ink-800)] px-3 text-sm font-medium text-[color:var(--scl-muted-data)] transition-colors hover:bg-[color:var(--scl-ink-700)] disabled:opacity-60"
      >
        {coverageSent
          ? "Coverage request recorded"
          : "Request coverage — tell us what's missing"}
      </button>
    </Card>
  );
}

function GameRow({
  event,
  open,
  triggerId,
  onToggle,
}: {
  event: OddsEvent;
  open: boolean;
  triggerId?: string;
  onToggle: () => void;
}) {
  const away = getTeamIdentity(event.away, event.sport);
  const home = getTeamIdentity(event.home, event.sport);
  const timeLabel = new Date(event.commenceTime).toLocaleTimeString(undefined, {
    hour: "numeric",
    minute: "2-digit",
  });

  return (
    <button
      id={triggerId}
      type="button"
      onClick={onToggle}
      className="hover:bg-surface-2/60 flex min-h-10 w-full items-center gap-3 px-3 py-2.5 text-left transition-colors"
      aria-expanded={open}
      aria-label={`${event.away} at ${event.home}`}
    >
      <span className="flex shrink-0 items-center -space-x-1.5" aria-hidden>
        <TeamMark team={away} size="md" />
        <TeamMark team={home} size="md" />
      </span>
      <span className="min-w-0 flex-1">
        <span className="scl-display block truncate text-[15px] font-semibold tracking-[0.02em]">
          {away.shortName}{" "}
          <span className="text-[color:var(--scl-muted-data)]">@</span>{" "}
          {home.shortName}
        </span>
        <span className="scl-data mt-0.5 block text-[0.65rem] tracking-[0.1em] text-[color:var(--scl-muted-data)] uppercase">
          {timeLabel} ET
        </span>
      </span>
      <LeagueMark leagueKey={event.sport} size="sm" />
      <ChevronDown
        className={cn(
          "size-4 shrink-0 text-[color:var(--scl-muted-data)] transition-transform",
          open && "rotate-180",
        )}
        aria-hidden
      />
    </button>
  );
}
