"use client";

import { useEffect, useState } from "react";
import { ChevronDown, Zap } from "lucide-react";

import { Card } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { SkeletonCard } from "@/components/scl/states";
import { formatOdds } from "@/lib/format";
import type { OddsEvent, OddsSelection } from "@/lib/odds-api";

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
// Props with many players get long — show this many by default, with a "show all".
const PROP_PLAYER_CAP = 12;

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

/** Sub-group a prop market's selections by player, preserving the incoming (sorted) order. */
function groupByPlayer(
  selections: OddsSelection[],
): [string, OddsSelection[]][] {
  const groups = new Map<string, OddsSelection[]>();
  for (const s of selections) {
    const player = s.player ?? "";
    const arr = groups.get(player);
    if (arr) arr.push(s);
    else groups.set(player, [s]);
  }
  return [...groups.entries()];
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
}: {
  sport: string;
  onPick: (pick: OddsPick) => void;
}) {
  const [cache, setCache] = useState<Record<string, BoardData>>({});
  const [openId, setOpenId] = useState<string | null>(null);
  const [detail, setDetail] = useState<Record<string, EventDetailData>>({});

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

  return (
    <Card className="space-y-3 p-4">
      <div className="flex items-center gap-1.5 text-sm font-medium">
        <Zap className="text-brand size-4" /> Tonight&apos;s board
        <span className="text-muted-foreground ml-auto text-xs font-normal">
          Tap a price to fill your play
        </span>
      </div>

      {loading || events == null ? (
        <SkeletonCard />
      ) : events.length ? (
        <ul className="divide-border border-border max-h-96 divide-y overflow-auto rounded-lg border">
          {events.map((e) => {
            const open = openId === e.id;
            return (
              <li key={e.id} className="bg-card">
                <button
                  type="button"
                  onClick={() => setOpenId(open ? null : e.id)}
                  className="hover:bg-surface-2 flex w-full items-center justify-between gap-2 px-3 py-2.5 text-left text-sm"
                  aria-expanded={open}
                >
                  <span className="truncate font-medium">
                    {e.away} <span className="text-muted-foreground">@</span>{" "}
                    {e.home}
                  </span>
                  <span className="text-muted-foreground flex shrink-0 items-center gap-1.5 text-xs">
                    {new Date(e.commenceTime).toLocaleDateString(undefined, {
                      month: "short",
                      day: "numeric",
                    })}
                    <ChevronDown
                      className={`size-4 transition-transform ${open ? "rotate-180" : ""}`}
                    />
                  </span>
                </button>
                {open ? (
                  <EventDetail
                    event={e}
                    detail={detail[e.id]}
                    onPick={onPick}
                  />
                ) : null}
              </li>
            );
          })}
        </ul>
      ) : board?.failed ? (
        <p className="text-muted-foreground text-xs">
          Couldn&apos;t load the board right now. Try again in a moment, or
          enter the play manually below.
        </p>
      ) : configured ? (
        <p className="text-muted-foreground text-xs">
          No live games for this sport right now — likely off-season. Try MLB,
          or enter the play manually below.
        </p>
      ) : (
        <p className="text-muted-foreground text-xs">
          Live odds aren&apos;t enabled yet — add{" "}
          <code className="text-foreground">ODDS_API_KEY</code> in Vercel and
          redeploy to turn on the board. You can enter plays manually for now.
        </p>
      )}
    </Card>
  );
}

/**
 * One expanded event: featured game lines (shown immediately) plus alternate lines and player
 * props once the per-event fetch returns. Props are searchable by player and grouped per player;
 * long lists are capped until "show all". Local search/expand state resets when the event closes.
 */
function EventDetail({
  event,
  detail,
  onPick,
}: {
  event: OddsEvent;
  detail: EventDetailData | undefined;
  onPick: (pick: OddsPick) => void;
}) {
  const [query, setQuery] = useState("");
  const [showAll, setShowAll] = useState(false);

  const shown =
    detail?.status === "ready" && detail.selections.length > 0
      ? detail.selections
      : event.selections;
  const grouped = groupByMarket(shown);
  const gameGroups = grouped.filter(([m]) => isGameMarket(m));
  const propGroups = grouped.filter(([m]) => !isGameMarket(m));
  const q = query.trim().toLowerCase();

  const renderChip = (s: OddsSelection, key: string) => (
    <button
      key={key}
      type="button"
      onClick={() =>
        onPick({
          market: s.market,
          selection: s.selection,
          oddsAmerican: s.oddsAmerican,
          eventId: event.id,
          eventStartsAt: event.commenceTime,
          side: s.side,
          line: s.line,
          player: s.player,
        })
      }
      className={CHIP_CLASS}
    >
      <span>{s.selection}</span>
      <span className="text-brand nums font-semibold tabular-nums">
        {formatOdds(s.oddsAmerican)}
      </span>
    </button>
  );

  const propSections = propGroups
    .map(([market, opts]) => {
      const byPlayer = groupByPlayer(opts).filter(
        ([player]) => !q || player.toLowerCase().includes(q),
      );
      const visible =
        !q && !showAll ? byPlayer.slice(0, PROP_PLAYER_CAP) : byPlayer;
      return { market, visible, total: byPlayer.length };
    })
    .filter((section) => section.visible.length > 0);

  return (
    <div className="space-y-3 px-3 pt-0.5 pb-3">
      {gameGroups.map(([market, opts]) => (
        <div key={market}>
          <p className="text-muted-foreground mb-1 text-[0.7rem] font-semibold tracking-wide uppercase">
            {market}
          </p>
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

      {propGroups.length ? (
        <div className="space-y-2.5">
          <input
            type="text"
            value={query}
            onChange={(ev) => setQuery(ev.target.value)}
            placeholder="Search props by player…"
            aria-label="Search props by player"
            className="border-input dark:bg-input/30 focus-visible:border-ring focus-visible:ring-ring/50 h-10 w-full rounded-lg border bg-transparent px-3 text-sm shadow-xs focus-visible:ring-[3px] focus-visible:outline-none"
          />
          {propSections.map(({ market, visible, total }) => (
            <div key={market}>
              <p className="text-muted-foreground mb-1 text-[0.7rem] font-semibold tracking-wide uppercase">
                {market}
              </p>
              <div className="space-y-2">
                {visible.map(([player, plays]) => (
                  <div key={player}>
                    <p className="text-foreground text-xs font-medium">
                      {player}
                    </p>
                    <div className="mt-1 flex flex-wrap gap-1.5">
                      {plays.map((s, i) => renderChip(s, `${player}-${i}`))}
                    </div>
                  </div>
                ))}
              </div>
              {!q && !showAll && total > PROP_PLAYER_CAP ? (
                <button
                  type="button"
                  onClick={() => setShowAll(true)}
                  className="text-brand mt-2 text-xs font-medium hover:underline"
                >
                  Show all {total} players
                </button>
              ) : null}
            </div>
          ))}
          {q && propSections.length === 0 ? (
            <p className="text-muted-foreground text-xs">
              No players match “{query}”.
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
      <div className="flex flex-wrap gap-1.5">
        {Array.from({ length: 6 }).map((_, i) => (
          <Skeleton key={i} className="h-10 w-20 rounded-md" />
        ))}
      </div>
    </div>
  );
}
