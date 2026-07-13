"use client";

import { useEffect, useState } from "react";
import { Check, ChevronDown, Zap } from "lucide-react";

import { Card } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { SkeletonCard } from "@/components/scl/states";
import { TeamMark } from "@/components/scl/team-mark";
import { cn } from "@/lib/utils";
import { formatOdds } from "@/lib/format";
import { pickKey } from "@/lib/slip";
import {
  availablePropMarkets,
  filterPlayerPropGroups,
  groupPropsByPlayer,
  propMarketShortLabel,
  splitMarketPreview,
} from "@/lib/prop-board";
import { getTeamIdentity, type TeamIdentity } from "@/lib/teams";
import type { OddsEvent, OddsSelection } from "@/lib/odds-api";

/** Re-export for callers that historically imported `pickKey` from this module. */
export { pickKey } from "@/lib/slip";

type SlateDay = "today" | "tomorrow";

/** Local calendar-day key (matches the date the board displays), no time component. */
function localDateKey(d: Date): string {
  return d.toDateString();
}

function slateDayKeys(now = new Date()): Record<SlateDay, string> {
  const tomorrow = new Date(now);
  tomorrow.setDate(tomorrow.getDate() + 1);
  return { today: localDateKey(now), tomorrow: localDateKey(tomorrow) };
}

export type OddsPick = {
  market: string;
  selection: string;
  oddsAmerican: number;
  // Event binding (C2) — makes the pick eligible for the strict/verified path.
  eventId: string;
  eventStartsAt: string; // ISO commence time
  side: string;
  line?: number;
  player?: string;
};

type BoardData = { events: OddsEvent[]; configured: boolean; failed?: boolean };

// Per-event board load: absent = still loading; ready (may be empty) or error otherwise.
type EventDetailData =
  | { status: "ready"; selections: OddsSelection[] }
  | { status: "error" };

const MARKET_ORDER = ["Moneyline", "Spread", "Total"] as const;
// Alternate spread/total ladders are long — show the closest-to-main lines, expand for the rest.
const ALT_LINE_CAP = 8;

const PROP_PILL_CLASS =
  "min-h-10 rounded-full border px-3.5 text-sm font-semibold transition-colors";

const CHIP_CLASS =
  "border-border hover:border-brand hover:bg-surface-2 flex min-h-10 items-center gap-1.5 rounded-md border px-3 py-2 text-xs transition-colors";

/** Game markets first (in MARKET_ORDER); prop groups sort after, alphabetically by label. */
function marketOrder(market: string): number {
  const i = MARKET_ORDER.indexOf(market as (typeof MARKET_ORDER)[number]);
  return i === -1 ? MARKET_ORDER.length : i;
}

function isGameMarket(market: string): boolean {
  return (MARKET_ORDER as readonly string[]).includes(market);
}

function groupByMarket(
  selections: OddsSelection[],
): [string, OddsSelection[]][] {
  const groups = new Map<string, OddsSelection[]>();
  for (const s of selections) {
    const arr = groups.get(s.market);
    if (arr) arr.push(s);
    else groups.set(s.market, [s]);
  }
  return [...groups.entries()].sort((a, b) => {
    const r = marketOrder(a[0]) - marketOrder(b[0]);
    return r !== 0 ? r : a[0].localeCompare(b[0]);
  });
}

/**
 * Books-first entry: auto-loads the live board for the chosen sport so cappers pick
 * a real market/price instead of typing. Expanding an event lazily loads its alternate
 * lines + player props. Prefills the form on pick; manual entry still works when there's
 * no key/sport/games.
 */
export function OddsAssist({
  sport,
  onPick,
  selectedKeys,
}: {
  sport: string;
  onPick: (pick: OddsPick) => void;
  // Keys (see `pickKey`) of picks already on the slip — those chips render selected + disabled.
  // Conflicting (non-exact) chips stay clickable so conflict toasts can fire.
  selectedKeys?: Set<string>;
}) {
  const [cache, setCache] = useState<Record<string, BoardData>>({});
  const [openId, setOpenId] = useState<string | null>(null);
  const [detail, setDetail] = useState<Record<string, EventDetailData>>({});
  // Keyed to the sport so switching sports auto-re-defaults the day (no reset effect needed);
  // null / a stale sport = auto (default to whichever of today/tomorrow has games).
  const [dayChoice, setDayChoice] = useState<{
    sport: string;
    day: SlateDay;
  } | null>(null);

  useEffect(() => {
    if (!sport || sport in cache) return;
    let cancelled = false;
    fetch(`/api/odds?sport=${encodeURIComponent(sport)}`)
      .then((r) => r.json())
      .then((d) => {
        if (cancelled) return;
        setCache((c) => ({
          ...c,
          [sport]: {
            events: Array.isArray(d.events) ? (d.events as OddsEvent[]) : [],
            configured: Boolean(d.configured),
          },
        }));
      })
      .catch(() => {
        if (!cancelled)
          setCache((c) => ({
            ...c,
            [sport]: { events: [], configured: true, failed: true },
          }));
      });
    return () => {
      cancelled = true;
    };
  }, [sport, cache]);

  // Lazy-load the expanded board (alternate lines + props) for whichever event is open.
  useEffect(() => {
    if (!openId || openId in detail) return;
    let cancelled = false;
    fetch(
      `/api/odds/event?sport=${encodeURIComponent(sport)}&eventId=${encodeURIComponent(openId)}`,
    )
      .then((r) => r.json())
      .then((d) => {
        if (cancelled) return;
        setDetail((prev) => ({
          ...prev,
          [openId]: {
            status: "ready",
            selections: Array.isArray(d.selections)
              ? (d.selections as OddsSelection[])
              : [],
          },
        }));
      })
      .catch(() => {
        if (!cancelled)
          setDetail((prev) => ({ ...prev, [openId]: { status: "error" } }));
      });
    return () => {
      cancelled = true;
    };
  }, [openId, sport, detail]);

  if (!sport) return null;
  const board = cache[sport];
  const loading = !(sport in cache);
  const events = board?.events;
  const configured = board?.configured ?? true;

  const list = events ?? [];
  const keys = slateDayKeys();
  const todayEvents = list.filter(
    (e) => localDateKey(new Date(e.commenceTime)) === keys.today,
  );
  const tomorrowEvents = list.filter(
    (e) => localDateKey(new Date(e.commenceTime)) === keys.tomorrow,
  );
  const hasNearTerm = todayEvents.length + tomorrowEvents.length > 0;
  const chosenDay = dayChoice?.sport === sport ? dayChoice.day : null;
  const day: SlateDay =
    chosenDay ?? (todayEvents.length ? "today" : "tomorrow");
  const dayEvents = day === "today" ? todayEvents : tomorrowEvents;

  return (
    <Card className="space-y-3 p-4">
      <div className="flex items-center gap-1.5 text-sm font-medium">
        <Zap className="text-brand size-4" /> Games board
        <span className="text-muted-foreground ml-auto text-xs font-normal">
          Tap a price to fill your play
        </span>
      </div>

      {loading || events == null ? (
        <SkeletonCard />
      ) : hasNearTerm ? (
        <>
          <DayToggle
            day={day}
            todayCount={todayEvents.length}
            tomorrowCount={tomorrowEvents.length}
            onChange={(d) => {
              setDayChoice({ sport, day: d });
              setOpenId(null);
            }}
          />
          {dayEvents.length ? (
            <ul className="divide-border border-border max-h-96 divide-y overflow-auto rounded-lg border">
              {dayEvents.map((e) => {
                const open = openId === e.id;
                return (
                  <li key={e.id} className="bg-card">
                    <EventRow
                      event={e}
                      open={open}
                      onToggle={() => setOpenId(open ? null : e.id)}
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
          ) : (
            <p className="text-muted-foreground text-xs">
              No {day === "today" ? "more games today" : "games tomorrow"} for
              this sport —{" "}
              <button
                type="button"
                onClick={() =>
                  setDayChoice({
                    sport,
                    day: day === "today" ? "tomorrow" : "today",
                  })
                }
                className="text-brand font-medium hover:underline"
              >
                {day === "today" ? "check Tomorrow" : "check Today"}
              </button>{" "}
              or pick another sport above.
            </p>
          )}
        </>
      ) : events.length ? (
        <p className="text-muted-foreground text-xs">
          No games today or tomorrow for this sport yet — check back closer to
          game day, or pick another sport above.
        </p>
      ) : board?.failed ? (
        <p className="text-muted-foreground text-xs">
          Couldn&apos;t load the board right now — refresh in a moment, or pick
          another sport.
        </p>
      ) : configured ? (
        <p className="text-muted-foreground text-xs">
          No live games for this sport right now — likely off-season. Try
          another sport, like MLB or WNBA.
        </p>
      ) : (
        <p className="text-muted-foreground text-xs">
          Live odds aren&apos;t enabled yet — add{" "}
          <code className="text-foreground">ODDS_API_KEY</code> in Vercel and
          redeploy to turn on the board.
        </p>
      )}
    </Card>
  );
}

/** Today / Tomorrow slate switch — the day the capper is logging picks for. */
function DayToggle({
  day,
  todayCount,
  tomorrowCount,
  onChange,
}: {
  day: SlateDay;
  todayCount: number;
  tomorrowCount: number;
  onChange: (day: SlateDay) => void;
}) {
  const counts: Record<SlateDay, number> = {
    today: todayCount,
    tomorrow: tomorrowCount,
  };
  return (
    <div className="bg-surface-2 grid grid-cols-2 gap-1 rounded-lg p-1">
      {(["today", "tomorrow"] as const).map((d) => (
        <button
          key={d}
          type="button"
          onClick={() => onChange(d)}
          aria-pressed={day === d}
          className={cn(
            "min-h-10 rounded-md text-xs font-semibold capitalize transition-colors",
            day === d
              ? "bg-card text-foreground shadow-xs"
              : "text-muted-foreground hover:text-foreground",
          )}
        >
          {d} · {counts[d]}
        </button>
      ))}
    </div>
  );
}

function EventRow({
  event,
  open,
  onToggle,
}: {
  event: OddsEvent;
  open: boolean;
  onToggle: () => void;
}) {
  const away = getTeamIdentity(event.away, event.sport);
  const home = getTeamIdentity(event.home, event.sport);
  const awayMl = moneylineFor(event, away);
  const homeMl = moneylineFor(event, home);

  return (
    <button
      type="button"
      onClick={onToggle}
      className="hover:bg-surface-2 flex w-full items-start justify-between gap-2 px-3 py-2.5 text-left text-sm transition-colors"
      aria-expanded={open}
      aria-label={`${event.away} at ${event.home}`}
    >
      <span className="min-w-0 flex-1 space-y-1.5">
        <TeamLine team={away} moneyline={awayMl} />
        <TeamLine team={home} moneyline={homeMl} />
      </span>
      <span className="text-muted-foreground flex shrink-0 items-center gap-1.5 pt-0.5 text-xs">
        <span className="bg-surface-2 text-muted-foreground hidden rounded px-1.5 py-0.5 text-[0.65rem] font-semibold sm:inline">
          {event.sport}
        </span>
        <span className="nums tabular-nums">
          {new Date(event.commenceTime).toLocaleTimeString(undefined, {
            hour: "numeric",
            minute: "2-digit",
          })}
        </span>
        <ChevronDown
          className={`size-4 transition-transform ${open ? "rotate-180" : ""}`}
        />
      </span>
    </button>
  );
}

function TeamLine({
  team,
  moneyline,
}: {
  team: TeamIdentity;
  moneyline?: number;
}) {
  return (
    <span className="flex min-w-0 items-center gap-2">
      <span
        className="h-7 w-1 shrink-0 rounded-full"
        style={{ backgroundColor: team.primaryColor }}
        aria-hidden
      />
      <TeamMark team={team} />
      <span className="min-w-0 flex-1 font-medium">
        <span className="truncate sm:hidden">{team.shortName}</span>
        <span className="hidden truncate sm:block">{team.fullName}</span>
      </span>
      {typeof moneyline === "number" ? (
        <span className="text-muted-foreground nums shrink-0 text-xs font-semibold tabular-nums">
          {formatOdds(moneyline)}
        </span>
      ) : null}
    </span>
  );
}

function moneylineFor(
  event: OddsEvent,
  team: TeamIdentity,
): number | undefined {
  const selection = event.selections.find(
    (s) =>
      s.market === "Moneyline" &&
      getTeamIdentity(s.side, event.sport).key === team.key,
  );
  return selection?.oddsAmerican;
}

/**
 * One expanded event: featured game lines (shown immediately) plus alternate lines and player
 * props once the per-event fetch returns. Props: sticky player search, category filter pills,
 * and player accordions (collapsed by default; 3-market preview + Show all). Local state resets
 * when the event closes.
 */
function EventDetail({
  event,
  detail,
  onPick,
  selectedKeys,
}: {
  event: OddsEvent;
  detail: EventDetailData | undefined;
  onPick: (pick: OddsPick) => void;
  selectedKeys?: Set<string>;
}) {
  const [query, setQuery] = useState("");
  const [propMarket, setPropMarket] = useState<string | null>(null);
  const [playerOpen, setPlayerOpen] = useState<Record<string, boolean>>({});
  const [playerShowAll, setPlayerShowAll] = useState<Record<string, boolean>>(
    {},
  );
  const [altExpanded, setAltExpanded] = useState<Record<string, boolean>>({});

  const shown =
    detail?.status === "ready" && detail.selections.length > 0
      ? detail.selections
      : event.selections;

  // Hierarchy: featured game lines (always visible) → player props (searchable) → alternate
  // spread/total ladders (collapsed). Keeps props discoverable instead of buried under a wall.
  const featuredGroups = groupByMarket(
    shown.filter((s) => isGameMarket(s.market) && s.featured),
  );
  const propSelections = shown.filter((s) => !isGameMarket(s.market));
  const propMarkets = availablePropMarkets(propSelections);
  const playerGroups = filterPlayerPropGroups(
    groupPropsByPlayer(propSelections),
    { query, market: propMarket },
  );
  const altGroups = groupByMarket(
    shown.filter((s) => isGameMarket(s.market) && !s.featured),
  );
  const q = query.trim();
  // Search auto-opens matching players so a named prop is ≤2 taps (type + chip).
  const searching = q.length > 0;

  const renderChip = (s: OddsSelection, key: string) => {
    const pick: OddsPick = {
      market: s.market,
      selection: s.selection,
      oddsAmerican: s.oddsAmerican,
      eventId: event.id,
      eventStartsAt: event.commenceTime,
      side: s.side,
      line: s.line,
      player: s.player,
    };
    const selected = selectedKeys?.has(pickKey(pick)) ?? false;
    return (
      <button
        key={key}
        type="button"
        onClick={() => onPick(pick)}
        // Exact-selected only — conflict chips stay enabled so the page can toast.
        disabled={selected}
        aria-pressed={selected}
        className={cn(
          CHIP_CLASS,
          selected &&
            "border-brand bg-brand text-brand-foreground hover:bg-brand hover:border-brand cursor-default",
        )}
      >
        {selected ? (
          <Check className="text-brand-foreground size-3.5 shrink-0" />
        ) : null}
        <span className="min-w-0 truncate">
          {selected ? "Added · " : ""}
          {s.selection}
        </span>
        <span
          className={cn(
            "nums shrink-0 font-semibold tabular-nums",
            selected ? "text-brand-foreground/90" : "text-brand",
          )}
        >
          {formatOdds(s.oddsAmerican)}
        </span>
      </button>
    );
  };

  const marketLabel = (market: string) => (
    <p className="text-muted-foreground mb-1 text-[0.7rem] font-semibold tracking-wide uppercase">
      {market}
    </p>
  );

  // Alt ladders sorted by proximity to the main line, capped until expanded per market.
  const altSections = altGroups.map(([market, opts]) => {
    const ref = shown.find(
      (s) => s.market === market && s.featured && typeof s.line === "number",
    )?.line;
    const refAbs = typeof ref === "number" ? Math.abs(ref) : null;
    const sorted = [...opts].sort((a, b) => {
      const la = Math.abs(a.line ?? 0);
      const lb = Math.abs(b.line ?? 0);
      if (refAbs !== null) return Math.abs(la - refAbs) - Math.abs(lb - refAbs);
      return la - lb;
    });
    const expanded = Boolean(altExpanded[market]);
    return {
      market,
      visible: expanded ? sorted : sorted.slice(0, ALT_LINE_CAP),
      total: sorted.length,
      expanded,
    };
  });

  return (
    <div className="space-y-3 px-3 pt-0.5 pb-3">
      {/* 1 · Featured game lines — always visible */}
      {featuredGroups.map(([market, opts]) => (
        <div key={market}>
          {marketLabel(market)}
          <div className="flex flex-wrap gap-1.5">
            {opts.map((s, i) => renderChip(s, `${market}-${i}`))}
          </div>
        </div>
      ))}

      {detail === undefined ? <DetailSkeleton /> : null}
      {detail?.status === "error" ? (
        <p className="text-muted-foreground text-xs">
          Couldn&apos;t load alternate lines &amp; props for this game.
        </p>
      ) : null}

      {/* 2 · Player props — sticky search, category pills, player accordions */}
      {propSelections.length ? (
        <div className="space-y-2.5">
          <div className="bg-card sticky top-0 z-10 space-y-2 pb-1">
            <input
              type="text"
              value={query}
              onChange={(ev) => setQuery(ev.target.value)}
              placeholder="Search props by player…"
              aria-label="Search props by player"
              className="border-input dark:bg-input/30 focus-visible:border-ring focus-visible:ring-ring/50 h-10 w-full rounded-lg border bg-transparent px-3 text-sm shadow-xs focus-visible:ring-[3px] focus-visible:outline-none"
            />
            {propMarkets.length > 1 ? (
              <div
                className="flex flex-wrap gap-1.5"
                role="group"
                aria-label="Filter props by stat"
              >
                <button
                  type="button"
                  onClick={() => setPropMarket(null)}
                  aria-pressed={propMarket === null}
                  className={cn(
                    PROP_PILL_CLASS,
                    propMarket === null
                      ? "border-brand bg-brand/10 text-brand"
                      : "border-border text-muted-foreground hover:text-foreground hover:border-foreground/30",
                  )}
                >
                  All
                </button>
                {propMarkets.map((market) => {
                  const active = propMarket === market;
                  return (
                    <button
                      key={market}
                      type="button"
                      onClick={() => setPropMarket(active ? null : market)}
                      aria-pressed={active}
                      className={cn(
                        PROP_PILL_CLASS,
                        active
                          ? "border-brand bg-brand/10 text-brand"
                          : "border-border text-muted-foreground hover:text-foreground hover:border-foreground/30",
                      )}
                    >
                      {propMarketShortLabel(market)}
                    </button>
                  );
                })}
              </div>
            ) : null}
          </div>

          <div className="divide-border border-border divide-y overflow-hidden rounded-lg border">
            {playerGroups.map(({ player, markets }) => {
              const open = searching || Boolean(playerOpen[player]);
              const showAll = Boolean(playerShowAll[player]);
              const { preview, remaining } = splitMarketPreview(markets);
              const visibleMarkets = showAll ? markets : preview;
              const marketCount = markets.length;
              const chipCount = markets.reduce(
                (n, [, opts]) => n + opts.length,
                0,
              );
              return (
                <div key={player} className="bg-card">
                  <button
                    type="button"
                    onClick={() =>
                      setPlayerOpen((p) => ({ ...p, [player]: !open }))
                    }
                    aria-expanded={open}
                    className="hover:bg-surface-2 flex min-h-10 w-full items-center justify-between gap-2 px-3 py-2 text-left text-sm transition-colors"
                  >
                    <span className="min-w-0 truncate font-medium">
                      {player}
                    </span>
                    <span className="text-muted-foreground flex shrink-0 items-center gap-1.5 text-xs">
                      <span className="nums tabular-nums">
                        {marketCount} {marketCount === 1 ? "market" : "markets"}
                        {" · "}
                        {chipCount}
                      </span>
                      <ChevronDown
                        className={cn(
                          "size-4 transition-transform",
                          open ? "rotate-180" : "",
                        )}
                      />
                    </span>
                  </button>
                  {open ? (
                    <div className="space-y-2.5 px-3 pb-3">
                      {visibleMarkets.map(([market, opts]) => (
                        <div key={market}>
                          {marketLabel(market)}
                          <div className="flex flex-wrap gap-1.5">
                            {opts.map((s, i) =>
                              renderChip(s, `${player}-${market}-${i}`),
                            )}
                          </div>
                        </div>
                      ))}
                      {remaining > 0 ? (
                        <button
                          type="button"
                          onClick={() =>
                            setPlayerShowAll((p) => ({
                              ...p,
                              [player]: !showAll,
                            }))
                          }
                          className="text-brand min-h-10 text-xs font-medium hover:underline"
                        >
                          {showAll
                            ? "Show fewer"
                            : `Show all (${markets.length})`}
                        </button>
                      ) : null}
                    </div>
                  ) : null}
                </div>
              );
            })}
          </div>
          {playerGroups.length === 0 ? (
            <p className="text-muted-foreground text-xs">
              {q
                ? `No players match “${query}”.`
                : propMarket
                  ? `No ${propMarketShortLabel(propMarket)} props for this game.`
                  : "No props for this game."}
            </p>
          ) : null}
        </div>
      ) : null}

      {/* 3 · Alternate spread/total ladders — collapsed by default */}
      {altSections.map(({ market, visible, total, expanded }) => (
        <div key={market}>
          {marketLabel(`Alternate ${market}`)}
          <div className="flex flex-wrap gap-1.5">
            {visible.map((s, i) => renderChip(s, `alt-${market}-${i}`))}
          </div>
          {total > ALT_LINE_CAP ? (
            <button
              type="button"
              onClick={() =>
                setAltExpanded((p) => ({ ...p, [market]: !expanded }))
              }
              className="text-brand mt-2 text-xs font-medium hover:underline"
            >
              {expanded
                ? "Show fewer"
                : `Show all ${total} ${market.toLowerCase()} lines`}
            </button>
          ) : null}
        </div>
      ))}
    </div>
  );
}

/** Skeleton pill rows shown under the featured lines while alternate lines + props load. */
function DetailSkeleton() {
  return (
    <div className="space-y-1.5" aria-hidden>
      <Skeleton className="h-2.5 w-16 rounded" />
      <div className="flex flex-wrap gap-1.5">
        {Array.from({ length: 6 }).map((_, i) => (
          <Skeleton key={i} className="h-10 w-20 rounded-md" />
        ))}
      </div>
    </div>
  );
}
