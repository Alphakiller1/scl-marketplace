"use client";

import { useEffect, useState } from "react";
import { ChevronDown } from "lucide-react";

import { Card } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { DayToggle } from "@/components/scl/day-toggle";
import { MarketChip } from "@/components/scl/market-chip";
import { PlayerHeadshot } from "@/components/scl/player-headshot";
import { SkeletonCard } from "@/components/scl/states";
import { TeamMark } from "@/components/scl/team-mark";
import { cn } from "@/lib/utils";
import { formatOdds } from "@/lib/format";
import { bookShort } from "@/lib/books";
import { selectionForActiveBook } from "@/lib/game-picker";
import { allGameLineLabels, isGameLineMarket } from "@/lib/market-kind";
import { pickKey } from "@/lib/slip";
import { toHeadshotLeague } from "@/lib/player-headshots";
import {
  availablePropMarkets,
  filterPlayerPropGroups,
  groupPropsByPlayer,
  propMarketShortLabel,
  splitMarketPreview,
} from "@/lib/prop-board";
import { filterBySlateDay, type SlateDay } from "@/lib/slate";
import { getTeamIdentity, type TeamIdentity } from "@/lib/teams";
import type { OddsEvent, OddsSelection } from "@/lib/odds-board";
import { dedupeOddsEvents, isExtremeAmericanOdds } from "@/lib/odds-board";
import { mergeEventBoardSelections } from "@/lib/odds-event-board-contract";

/** Re-export for callers that historically imported `pickKey` from this module. */
export { pickKey } from "@/lib/slip";

export type OddsPick = {
  market: string;
  selection: string;
  oddsAmerican: number;
  // Event binding (C2) — makes the pick eligible for the strict/verified path.
  eventId: string;
  eventLabel?: string;
  eventStartsAt: string; // ISO commence time
  side: string;
  /** SCL sport key from the board event (for createPlay / parlay legs). */
  sport: string;
  /** Soccer league key (EPL, MLS, …) when sport is SOCCER. */
  league?: string;
  line?: number;
  player?: string;
  /** Odds API bookmaker key for the displayed price (capture attribution). */
  book?: string;
};

type BoardData = { events: OddsEvent[]; configured: boolean; failed?: boolean };

// Per-event board load: absent = still loading; ready (may be empty) or error otherwise.
type EventDetailData =
  | { status: "ready"; selections: OddsSelection[] }
  | { status: "error" };

/**
 * Every game-line label, in the order a sportsbook lists them: full game first,
 * then F3/F5/F7 and halves, then team totals.
 *
 * This drives the tab strip, and it must come from the registry rather than a
 * hardcoded list. Tabs used to be `CORE_GAME_MARKETS` alone, so a period market
 * had nowhere to render: `isGameLineMarket` correctly kept F5/F3/F7 out of the
 * player-prop bucket, but no tab matched them, so they were fetched, billed and
 * silently shown nowhere. Deriving the order here means registering a segment
 * is enough to surface it.
 */
const MARKET_ORDER = allGameLineLabels();
// Alternate spread/total ladders are long — show the closest-to-main lines, expand for the rest.
const ALT_LINE_CAP = 8;

const PROP_PILL_CLASS =
  "scl-display h-8 rounded-full border px-2.5 text-sm leading-none font-semibold tracking-[0.04em] transition-colors";

const PROP_PILL_ACTIVE =
  "border-[color:var(--scl-blue)] bg-[color:var(--scl-blue)] text-[color:var(--scl-blue-ink)]";

const PROP_PILL_IDLE =
  "border-[color:var(--scl-line)] bg-[color:var(--scl-ink-800)] text-[color:var(--scl-muted-data)]";

/** Game markets first (in MARKET_ORDER); prop groups sort after, alphabetically by label. */
function marketOrder(market: string): number {
  const i = MARKET_ORDER.indexOf(market as (typeof MARKET_ORDER)[number]);
  return i === -1 ? MARKET_ORDER.length : i;
}

/**
 * Game lines, including period segments and team totals.
 *
 * Delegates to `isGameLineMarket`, which is derived from the market registries
 * and covered by `market-kind.test.ts`. This test used to live here as a local
 * literal list, un-exported and untestable inside a `.tsx` — which is how two
 * markets shipped invisible: anything it failed to name fell into the player
 * prop bucket, was grouped by a player it did not have, and was discarded.
 */
function isGameMarket(market: string): boolean {
  return isGameLineMarket(market);
}

/**
 * Inside a player's accordion the name is already the header, so repeating
 * "Aaron Judge" on every chip (plus his face three times) is noise. Strip the
 * leading player name and the market tail so chips read like a book: "Over 1.5".
 */
function propChipLabel(
  selection: string,
  player: string,
  market: string,
): string {
  let label = selection;
  if (player && label.toLowerCase().startsWith(player.toLowerCase())) {
    label = label.slice(player.length).trim();
  }
  label = label.replace(/\s+[-–—]\s+/, " ").trim();
  if (market && label.toLowerCase().endsWith(market.toLowerCase())) {
    label = label.slice(0, -market.length).trim();
  }
  return label || selection;
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
  // null / a stale sport = auto (default to whichever of today/upcoming has games).
  const [dayChoice, setDayChoice] = useState<{
    sport: string;
    day: SlateDay;
  } | null>(null);
  /** Displayed board sport — lags `sport` during the dim→crossfade handoff. */
  const [renderSport, setRenderSport] = useState(sport);
  const [switchPhase, setSwitchPhase] = useState<"idle" | "out" | "in">("idle");

  useEffect(() => {
    if (!sport || sport === renderSport) return;
    const reduce =
      typeof window !== "undefined" &&
      window.matchMedia("(prefers-reduced-motion: reduce)").matches;

    // Defer all setState into timers — avoids react-hooks/set-state-in-effect.
    if (reduce) {
      const t = window.setTimeout(() => {
        setRenderSport(sport);
        setOpenId(null);
        setSwitchPhase("idle");
      }, 0);
      return () => window.clearTimeout(t);
    }

    const tOut = window.setTimeout(() => {
      setOpenId(null);
      setSwitchPhase("out");
    }, 0);
    const tSwap = window.setTimeout(() => {
      setRenderSport(sport);
      setSwitchPhase("in");
    }, 150);
    const tIdle = window.setTimeout(() => setSwitchPhase("idle"), 360);
    return () => {
      window.clearTimeout(tOut);
      window.clearTimeout(tSwap);
      window.clearTimeout(tIdle);
    };
  }, [sport, renderSport]);

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
            events: Array.isArray(d.events)
              ? dedupeOddsEvents(d.events as OddsEvent[])
              : [],
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
  const boardSport = renderSport || sport;
  const board = cache[boardSport];
  const loading = !(boardSport in cache);
  const events = board?.events;
  const configured = board?.configured ?? true;

  const list = events ?? [];
  const todayEvents = filterBySlateDay(list, "today");
  const upcomingEvents = filterBySlateDay(list, "upcoming");
  const hasNearTerm = todayEvents.length + upcomingEvents.length > 0;
  const chosenDay = dayChoice?.sport === boardSport ? dayChoice.day : null;
  const day: SlateDay =
    chosenDay ?? (todayEvents.length ? "today" : "upcoming");
  const dayEvents = day === "today" ? todayEvents : upcomingEvents;

  return (
    <Card
      className={cn(
        "scl-elevated relative space-y-3 p-4 transition-opacity duration-150 ease-out",
        switchPhase === "out" && "opacity-50",
        switchPhase === "in" && "scl-board-fade-in",
      )}
    >
      {switchPhase === "out" ? (
        <div
          className="absolute inset-0 z-10 rounded-[var(--scl-radius-card)] bg-[color:var(--scl-ink-950)]/50"
          aria-hidden
        />
      ) : null}
      <div className="scl-section-mark flex items-baseline justify-between gap-2">
        <h2 className="scl-display text-sm font-semibold tracking-[0.08em] uppercase">
          {boardSport} Board
        </h2>
        <span className="scl-data text-[0.625rem] tracking-[0.1em] text-[color:var(--scl-muted-label)] uppercase">
          Odds: Live Feed · {loading || events == null ? "…" : dayEvents.length}{" "}
          Events
        </span>
      </div>

      {loading || events == null ? (
        <>
          <DayToggle
            day="today"
            todayCount={0}
            upcomingCount={0}
            loading
            onChange={() => {}}
          />
          <SkeletonCard />
        </>
      ) : hasNearTerm ? (
        <>
          <DayToggle
            day={day}
            todayCount={todayEvents.length}
            upcomingCount={upcomingEvents.length}
            loading={false}
            onChange={(d) => {
              setDayChoice({ sport: boardSport, day: d });
              setOpenId(null);
            }}
          />
          {dayEvents.length ? (
            <ul className="max-h-96 space-y-2.5 overflow-auto">
              {dayEvents.map((e) => {
                const open = openId === e.id;
                return (
                  <li
                    key={e.id}
                    className="bg-card border-border overflow-hidden rounded-[14px] border"
                  >
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
              No {day === "today" ? "more games today" : "upcoming games"} for
              this sport —{" "}
              <button
                type="button"
                onClick={() =>
                  setDayChoice({
                    sport: boardSport,
                    day: day === "today" ? "upcoming" : "today",
                  })
                }
                className="inline-flex min-h-10 items-center font-medium text-[color:var(--scl-muted-data)] underline-offset-2 hover:underline"
              >
                {day === "today" ? "check Upcoming" : "check Today"}
              </button>{" "}
              or pick another sport above.
            </p>
          )}
        </>
      ) : events.length ? (
        <p className="text-muted-foreground text-xs">
          No games on the board for this sport yet — check back closer to game
          day, or pick another sport above.
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
  const awaySel = moneylineSelection(event, away);
  const homeSel = moneylineSelection(event, home);
  const awayFav =
    typeof awayMl === "number" && typeof homeMl === "number" && awayMl < homeMl;
  const homeFav =
    typeof awayMl === "number" && typeof homeMl === "number" && homeMl < awayMl;
  const timeLabel = new Date(event.commenceTime).toLocaleTimeString(undefined, {
    hour: "numeric",
    minute: "2-digit",
  });

  return (
    <button
      type="button"
      onClick={onToggle}
      className="hover:bg-surface-2/60 w-full text-left transition-colors"
      aria-expanded={open}
      aria-label={`${event.away} at ${event.home}`}
    >
      <div className="grid grid-cols-[4px_minmax(0,1fr)_auto] items-stretch">
        <span className="flex flex-col" aria-hidden>
          <span
            className="min-h-5 flex-1"
            style={{ backgroundColor: away.primaryColor }}
          />
          <span
            className="min-h-5 flex-1"
            style={{ backgroundColor: home.primaryColor }}
          />
        </span>
        <span className="min-w-0 space-y-1 px-3 pt-3 pb-1.5">
          <BoardTeamLine team={away} fav={awayFav} />
          <BoardTeamLine team={home} fav={homeFav} />
        </span>
        <span className="scl-data text-muted-foreground flex flex-col justify-center gap-1.5 px-3 pt-3 pb-1.5 text-right text-sm font-semibold">
          <BoardMlPrice american={awayMl} selection={awaySel} />
          <BoardMlPrice american={homeMl} selection={homeSel} />
        </span>
      </div>
      <span className="scl-data text-muted-foreground flex items-center gap-2 px-3 pt-1.5 pb-3 pl-[1.625rem] text-[0.65rem] tracking-[0.1em] uppercase">
        <span>{timeLabel} ET</span>
        <span className="text-pos">Pre-Game ✓</span>
        <ChevronDown
          className={cn(
            "ml-auto size-4 transition-transform",
            open && "rotate-180",
          )}
        />
      </span>
    </button>
  );
}

function BoardTeamLine({ team, fav }: { team: TeamIdentity; fav?: boolean }) {
  return (
    <span className="flex min-w-0 items-center gap-2.5">
      <TeamMark team={team} size="md" />
      <span className="scl-display truncate text-[19px] font-semibold tracking-[0.02em]">
        {team.shortName}
      </span>
      {fav ? (
        <span className="scl-data text-foreground shrink-0 rounded border border-[color:var(--scl-pink)] px-1.5 py-px text-[8.5px] tracking-[0.12em] uppercase">
          Fav
        </span>
      ) : null}
    </span>
  );
}

function moneylineSelection(
  event: OddsEvent,
  team: TeamIdentity,
): OddsSelection | undefined {
  return event.selections.find(
    (s) =>
      s.market === "Moneyline" &&
      getTeamIdentity(s.side, event.sport).key === team.key,
  );
}

function moneylineFor(
  event: OddsEvent,
  team: TeamIdentity,
): number | undefined {
  return moneylineSelection(event, team)?.oddsAmerican;
}

function BoardMlPrice({
  american,
  selection,
}: {
  american: number | undefined;
  selection?: OddsSelection;
}) {
  if (typeof american !== "number") {
    return <span>—</span>;
  }
  const extreme = isExtremeAmericanOdds(american);
  const bookTag = selection?.book ? bookShort(selection.book) : null;
  return (
    <span
      className={cn(
        "flex flex-col items-end gap-0.5",
        american < 0 ? "text-foreground" : undefined,
      )}
      title={
        extreme ? "Extreme price — flagged for operator review" : undefined
      }
    >
      <span>{formatOdds(american)}</span>
      {extreme ? (
        <span className="scl-data text-[0.5rem] font-medium tracking-[0.1em] text-[color:var(--scl-muted-label)] uppercase">
          Review
          {bookTag ? ` · ${bookTag}` : ""}
        </span>
      ) : null}
    </span>
  );
}

/**
 * One expanded event: featured game lines (shown immediately) plus alternate lines and player
 * props once the per-event fetch returns. Props: sticky player search, category filter pills,
 * and player accordions (collapsed by default; 3-market preview + Show all). Local state resets
 * when the event closes. Optional `activeBook` drives per-book prices via getOddsForBook
 * (honest "—" when that book has no line).
 */
export function EventDetail({
  event,
  detail,
  onPick,
  selectedKeys,
  activeBook,
}: {
  event: OddsEvent;
  detail: EventDetailData | undefined;
  onPick: (pick: OddsPick) => void;
  selectedKeys?: Set<string>;
  /** Capper book rail selection — null/undefined = best attributed price. */
  activeBook?: string | null;
}) {
  const [query, setQuery] = useState("");
  const [propMarket, setPropMarket] = useState<string | null>(null);
  const [playerOpen, setPlayerOpen] = useState<Record<string, boolean>>({});
  const [playerShowAll, setPlayerShowAll] = useState<Record<string, boolean>>(
    {},
  );
  const [altExpanded, setAltExpanded] = useState<Record<string, boolean>>({});
  const [tab, setTab] = useState<string | null>(null);

  const shown =
    detail?.status === "ready" && detail.selections.length > 0
      ? mergeEventBoardSelections(event.selections, detail.selections)
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

  const renderChip = (
    s: OddsSelection,
    key: string,
    labelOverride?: string,
  ) => {
    const priced = selectionForActiveBook(s, activeBook);
    const pick: OddsPick | null =
      priced.oddsAmerican === null
        ? null
        : {
            market: s.market,
            selection: s.selection,
            oddsAmerican: priced.oddsAmerican,
            eventId: event.id,
            eventLabel: `${event.away} @ ${event.home}`,
            eventStartsAt: event.commenceTime,
            side: s.side,
            sport: event.sport,
            league: event.league,
            line: s.line,
            player: s.player,
            book: priced.book,
          };
    const selected = pick ? (selectedKeys?.has(pickKey(pick)) ?? false) : false;
    return (
      <MarketChip
        key={key}
        label={labelOverride ?? s.selection}
        oddsAmerican={priced.oddsAmerican}
        book={priced.book}
        selected={selected}
        onClick={pick ? () => onPick(pick) : undefined}
      />
    );
  };

  const marketLabel = (market: string) => (
    <p className="scl-data text-muted-foreground mb-1 text-[0.56rem] font-semibold tracking-[0.18em] uppercase">
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

  // ── Sportsbook market tabs ────────────────────────────────────────────────
  // A book never dumps every market in one scroll: you choose a bet type first,
  // then see only those prices. Tabs are built from what this event actually
  // offers, and each game-market tab carries its own alternate ladder so the
  // main line and its alternates live together instead of in separate sections.
  const gameMarketTabs = MARKET_ORDER.filter((market) =>
    shown.some((s) => s.market === market),
  );
  const tabs: { key: string; label: string; count: number }[] = [
    ...(featuredGroups.length
      ? [
          {
            key: "popular",
            label: "Popular",
            count: featuredGroups.reduce((n, [, opts]) => n + opts.length, 0),
          },
        ]
      : []),
    ...gameMarketTabs.map((market) => ({
      key: `market:${market}`,
      label: altSections.some(
        (section) => section.market === market && section.total,
      )
        ? `${market} + Alts`
        : market,
      count: shown.filter((s) => s.market === market).length,
    })),
    ...(propSelections.length
      ? [
          {
            key: "props",
            label: "Player Props",
            count: propSelections.length,
          },
        ]
      : []),
  ];
  const expandedSport = event.sport === "MLB" || event.sport === "WNBA";
  const defaultTab =
    expandedSport && detail?.status === "ready" && propSelections.length
      ? "props"
      : (tabs[0]?.key ?? "popular");
  const activeTab = tab && tabs.some((t) => t.key === tab) ? tab : defaultTab;

  const marketBlock = (market: string) => {
    const featured = shown.filter((s) => s.market === market && s.featured);
    const alt = altSections.find((a) => a.market === market);
    return (
      <div className="space-y-3">
        {featured.length ? (
          <div>
            {marketLabel("Main line")}
            <div className="grid grid-cols-1 gap-1.5 sm:grid-cols-2">
              {featured.map((s, i) => renderChip(s, `main-${market}-${i}`))}
            </div>
          </div>
        ) : null}
        {alt && alt.total > 0 ? (
          <div>
            {/* The feed only flags full-game lines as featured, so a period
                market (F5/F3/F7, halves) has no "main line" of its own — these
                ARE its lines, and calling them alternates reads as a sidebar to
                something that isn't shown. */}
            {marketLabel(featured.length ? `Alternate ${market}` : market)}
            <div className="grid grid-cols-1 gap-1.5 sm:grid-cols-2">
              {alt.visible.map((s, i) => renderChip(s, `alt-${market}-${i}`))}
            </div>
            {alt.total > ALT_LINE_CAP ? (
              <button
                type="button"
                onClick={() =>
                  setAltExpanded((p) => ({ ...p, [market]: !alt.expanded }))
                }
                className="mt-2 inline-flex min-h-10 items-center text-xs font-medium text-[color:var(--scl-muted-data)] underline-offset-2 hover:underline"
              >
                {alt.expanded
                  ? "Show fewer"
                  : `Show all ${alt.total} ${market.toLowerCase()} lines`}
              </button>
            ) : null}
          </div>
        ) : null}
      </div>
    );
  };

  return (
    <div className="space-y-3 px-3 pt-0.5 pb-3">
      {/* Market tabs — choose a bet type, then see only those prices. */}
      {tabs.length > 1 ? (
        <div
          className="bg-card z-20 -mx-3 overflow-x-auto px-3 pb-1 sm:sticky sm:top-0"
          role="tablist"
          aria-label="Bet type"
        >
          <div className="flex w-max gap-1.5">
            {tabs.map((t) => {
              const active = t.key === activeTab;
              return (
                <button
                  key={t.key}
                  type="button"
                  role="tab"
                  aria-selected={active}
                  onClick={() => setTab(t.key)}
                  className={cn(
                    PROP_PILL_CLASS,
                    "shrink-0 whitespace-nowrap",
                    active ? PROP_PILL_ACTIVE : PROP_PILL_IDLE,
                  )}
                >
                  {t.label}
                  <span className="scl-data ml-1.5 text-[0.7em] font-bold tabular-nums opacity-70">
                    {t.count}
                  </span>
                </button>
              );
            })}
          </div>
        </div>
      ) : null}

      {/* Popular — the main game lines, exactly what a book opens on. */}
      {activeTab === "popular" && featuredGroups.length ? (
        <section aria-label="Popular lines" className="space-y-2">
          {featuredGroups.map(([market, opts]) => (
            <div key={market}>
              {marketLabel(market)}
              <div className="grid grid-cols-1 gap-1.5 sm:grid-cols-2">
                {opts.map((s, i) => renderChip(s, `${market}-${i}`))}
              </div>
            </div>
          ))}
        </section>
      ) : null}

      {/* A single game market: its main line + that market's alternate ladder. */}
      {activeTab.startsWith("market:") ? (
        <section aria-label={`${activeTab.slice(7)} lines`}>
          {marketBlock(activeTab.slice(7))}
        </section>
      ) : null}

      {detail === undefined ? <DetailSkeleton /> : null}
      {detail?.status === "error" ? (
        <p className="text-muted-foreground text-xs">
          Couldn&apos;t load alternate lines &amp; props for this game.
        </p>
      ) : null}

      {/* Player props — search, stat pills, per-player accordions */}
      {activeTab === "props" && propSelections.length ? (
        <div className="space-y-2.5">
          <div className="bg-card z-10 space-y-2 pb-1 lg:sticky lg:top-12">
            <input
              type="text"
              value={query}
              onChange={(ev) => setQuery(ev.target.value)}
              placeholder="Search props by player…"
              aria-label="Search props by player"
              className="border-input dark:bg-input/30 focus-visible:border-ring focus-visible:ring-ring/50 h-11 w-full rounded-lg border bg-transparent px-3 text-sm shadow-xs focus-visible:ring-[3px] focus-visible:outline-none"
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
                    propMarket === null ? PROP_PILL_ACTIVE : PROP_PILL_IDLE,
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
                        active ? PROP_PILL_ACTIVE : PROP_PILL_IDLE,
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
                    <PlayerHeadshot
                      selection={player}
                      league={toHeadshotLeague(event.sport)}
                      size={28}
                    />
                    <span className="min-w-0 flex-1 truncate font-medium">
                      {player}
                    </span>
                    <span className="text-muted-foreground flex shrink-0 items-center gap-1.5 text-xs">
                      <span className="nums scl-data tabular-nums">
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
                          <div className="grid grid-cols-1 gap-1.5 sm:grid-cols-2">
                            {opts.map((s, i) =>
                              renderChip(
                                s,
                                `${player}-${market}-${i}`,
                                propChipLabel(s.selection, player, market),
                              ),
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
                          className="min-h-10 text-xs font-medium text-[color:var(--scl-muted-data)] underline-offset-2 hover:underline"
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
    </div>
  );
}

/** Skeleton pill rows shown under the featured lines while alternate lines + props load. */
function DetailSkeleton() {
  return (
    <div className="space-y-1.5" aria-hidden>
      <Skeleton className="h-2.5 w-16 rounded" />
      <div className="grid grid-cols-1 gap-1.5 sm:grid-cols-2">
        {Array.from({ length: 6 }).map((_, i) => (
          <Skeleton key={i} className="h-10 w-20 rounded-md" />
        ))}
      </div>
    </div>
  );
}
