"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { ArrowLeft, ChevronDown, Search } from "lucide-react";
import { toast } from "sonner";

import { Card } from "@/components/ui/card";
import { DayToggle } from "@/components/scl/day-toggle";
import { EventDetail, type OddsPick } from "@/components/scl/odds-assist";
import { LeagueMark } from "@/components/scl/league-mark";
import { SkeletonCard } from "@/components/scl/states";
import { TeamMark } from "@/components/scl/team-mark";
import { BookMark } from "@/components/scl/book-mark";
import { bookShort, isBookKey } from "@/lib/books";
import {
  categoryCounts,
  filterGamePickerEvents,
  ODDS_BOARD_SPORTS,
} from "@/lib/game-picker";
import { dedupeOddsEvents } from "@/lib/odds-board";
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
  books: string[];
};

/**
 * Shared game browser for straight + parlay (M4 PR-3).
 * Multi-sport slate · day toggle · search · category pills with counts · book rail ·
 * TeamMark rows · Request coverage · expands existing EventDetail.
 * Entry-page wiring lands in PR-4 — this ships the component + tests only.
 */
export function GamePicker({
  onPick,
  selectedKeys,
  books: booksProp,
  onRequestCoverage,
  className,
}: {
  onPick: (pick: OddsPick) => void;
  selectedKeys?: Set<string>;
  /** CapperProfile.books override; when omitted, read from `/api/odds` response. */
  books?: readonly string[];
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
  const [bookChoice, setBookChoice] = useState<string | null>(null);
  const [openId, setOpenId] = useState<string | null>(null);
  const [detail, setDetail] = useState<Record<string, EventDetailData>>({});
  const [coverageSent, setCoverageSent] = useState(false);
  const backButtonRef = useRef<HTMLButtonElement>(null);
  const restoreFocusIdRef = useRef<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      setLoading(true);
      const results = await Promise.all(
        ODDS_BOARD_SPORTS.map(async (s) => {
          try {
            const res = await fetch(
              `/api/odds?sport=${encodeURIComponent(s.key)}`,
            );
            if (!res.ok) {
              return {
                events: [] as OddsEvent[],
                configured: true,
                failed: true,
                books: [] as string[],
              };
            }
            const data = (await res.json()) as {
              events?: OddsEvent[];
              configured?: boolean;
              books?: string[];
            };
            return {
              events: Array.isArray(data.events) ? data.events : [],
              configured: Boolean(data.configured),
              books: Array.isArray(data.books) ? data.books : [],
            };
          } catch {
            return {
              events: [] as OddsEvent[],
              configured: true,
              failed: true,
              books: [] as string[],
            };
          }
        }),
      );
      if (cancelled) return;
      const events = dedupeOddsEvents(results.flatMap((r) => r.events));
      const configured = results.some((r) => r.configured);
      const failed = results.every((r) => r.failed);
      const booksFromApi =
        results.find((r) => r.books.length > 0)?.books ??
        results[0]?.books ??
        [];
      setSlate({ events, configured, failed, books: booksFromApi });
      setLoading(false);
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const profileBooks = useMemo(() => {
    const raw = booksProp ?? slate?.books ?? [];
    return raw.filter(isBookKey);
  }, [booksProp, slate?.books]);

  // Prefer the capper's explicit rail choice; otherwise first profile book (or none).
  const activeBook =
    profileBooks.length === 0
      ? null
      : bookChoice &&
          profileBooks.includes(bookChoice as (typeof profileBooks)[number])
        ? bookChoice
        : profileBooks[0]!;

  const events = slate?.events ?? [];
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
    if (openId) {
      const frame = requestAnimationFrame(() => backButtonRef.current?.focus());
      return () => cancelAnimationFrame(frame);
    }

    const restoreId = restoreFocusIdRef.current;
    if (!restoreId) return;
    restoreFocusIdRef.current = null;
    const frame = requestAnimationFrame(() =>
      document.getElementById(`market-event-${restoreId}`)?.focus(),
    );
    return () => cancelAnimationFrame(frame);
  }, [openId]);

  useEffect(() => {
    if (!openEvent) return;
    if (openEvent.id in detail) return;
    let cancelled = false;
    fetch(
      `/api/odds/event?sport=${encodeURIComponent(openEvent.sport)}&eventId=${encodeURIComponent(openEvent.id)}`,
    )
      .then((r) => r.json())
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
      .catch(() => {
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
    restoreFocusIdRef.current = eventId;
    setOpenId(eventId);
  }

  function closeMatchup() {
    if (openId) restoreFocusIdRef.current = openId;
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
    <Card className={cn("scl-scanline relative space-y-3 p-4", className)}>
      <div className="flex items-baseline justify-between gap-2 border-t border-[color:var(--scl-pink-deep)] pt-2.5">
        <h2 className="scl-display text-sm font-semibold tracking-[0.08em] uppercase">
          Market board
        </h2>
        <span className="scl-data text-[0.625rem] tracking-[0.1em] text-[color:var(--scl-muted-data)] uppercase">
          {openEvent
            ? "Focused matchup"
            : `Pre-game board · ${loading ? "…" : visible.length} matchups`}
        </span>
      </div>

      {profileBooks.length > 0 ? (
        <div className="space-y-1.5">
          <p className="scl-eyebrow text-[color:var(--scl-muted-data)]">
            Source book
          </p>
          <BookRail
            books={profileBooks}
            active={activeBook}
            onChange={setBookChoice}
          />
        </div>
      ) : null}

      {openEvent ? (
        <div className="border-y border-[color:var(--scl-line)] py-2">
          <button
            ref={backButtonRef}
            type="button"
            onClick={closeMatchup}
            className="hover:bg-surface-2 inline-flex min-h-11 items-center gap-2 rounded-lg px-2 text-sm font-semibold text-[color:var(--scl-muted-data)] transition-colors hover:text-[color:var(--scl-text)]"
          >
            <ArrowLeft className="size-4" aria-hidden />
            Back to slate
          </button>
        </div>
      ) : (
        <>
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
              className="border-input dark:bg-input/30 focus-visible:border-ring focus-visible:ring-ring/50 h-11 w-full rounded-lg border bg-transparent py-2 pr-3 pl-10 text-base shadow-xs focus-visible:ring-[3px] focus-visible:outline-none sm:text-sm"
            />
          </label>

          <div
            className="-mx-1 flex scroll-px-1 [scrollbar-width:none] gap-2 overflow-x-auto px-1 pb-1 [-ms-overflow-style:none] [&::-webkit-scrollbar]:hidden"
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
        </>
      )}

      {openEvent ? (
        <ul className="space-y-2 lg:max-h-[40rem] lg:overflow-y-auto lg:pr-1">
          <li className="bg-card border-border overflow-hidden rounded-[14px] border">
            <GameRow event={openEvent} open onToggle={closeMatchup} />
            <EventDetail
              event={openEvent}
              detail={detail[openEvent.id]}
              onPick={onPick}
              selectedKeys={selectedKeys}
              activeBook={activeBook}
            />
          </li>
        </ul>
      ) : loading ? (
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
                    activeBook={activeBook}
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

      {!openEvent ? (
        <button
          type="button"
          onClick={requestCoverage}
          disabled={coverageSent}
          className="flex min-h-11 w-full items-center justify-center rounded-[14px] border border-dashed border-[color:var(--scl-line)] bg-[color:var(--scl-ink-800)] px-3 text-sm font-medium text-[color:var(--scl-muted-data)] transition-colors hover:bg-[color:var(--scl-ink-700)] disabled:opacity-60"
        >
          {coverageSent
            ? "Coverage request recorded"
            : "Request coverage — tell us what's missing"}
        </button>
      ) : null}
    </Card>
  );
}

/** Book rail — radius 18px, mono abbr; active = BLUE (navigation); ≥44px tap. */
function BookRail({
  books,
  active,
  onChange,
}: {
  books: readonly string[];
  active: string | null;
  onChange: (book: string) => void;
}) {
  return (
    <div
      className="-mx-1 flex scroll-px-1 [scrollbar-width:none] gap-1.5 overflow-x-auto px-1 [-ms-overflow-style:none] [&::-webkit-scrollbar]:hidden"
      role="group"
      aria-label="Active sportsbook"
    >
      {books.map((key) => {
        const isActive = active === key;
        return (
          <button
            key={key}
            type="button"
            onClick={() => onChange(key)}
            aria-pressed={isActive}
            aria-label={`Sportsbook ${bookShort(key)}`}
            className={cn(
              "scl-data flex min-h-11 shrink-0 items-center justify-center gap-1.5 rounded-[18px] border px-3.5 text-[11px] font-medium tracking-[0.08em] uppercase transition-colors",
              isActive
                ? "border-[color:var(--scl-blue)] bg-[color:var(--scl-blue)] text-[color:var(--scl-blue-ink)]"
                : "border-[color:var(--scl-line)] bg-[color:var(--scl-ink-800)] text-[color:var(--scl-muted-data)]",
            )}
          >
            <BookMark bookKey={key} size={16} />
            {bookShort(key)}
          </button>
        );
      })}
    </div>
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
      className="hover:bg-surface-2/60 flex min-h-11 w-full items-center gap-3 px-3 py-2.5 text-left transition-colors"
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
