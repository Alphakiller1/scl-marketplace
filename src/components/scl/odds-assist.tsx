"use client";

import { useEffect, useState } from "react";
import { ChevronDown, Zap } from "lucide-react";

import { Card } from "@/components/ui/card";
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

type BoardData = { events: OddsEvent[]; configured: boolean };

const MARKET_ORDER = ["Moneyline", "Spread", "Total"] as const;

/** Game markets first (in MARKET_ORDER); prop groups sort after, alphabetically by label. */
function marketOrder(market: string): number {
  const i = MARKET_ORDER.indexOf(market as (typeof MARKET_ORDER)[number]);
  return i === -1 ? MARKET_ORDER.length : i;
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
 * a real market/price instead of typing. Prefills the form on pick. Falls back to a
 * quiet message (manual entry still works) when no key/sport/games.
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
  // Per-event board (featured + alternate lines), fetched lazily the first time an event is
  // opened. undefined = not loaded yet; [] = loaded but nothing extra (or fetch failed).
  const [detail, setDetail] = useState<Record<string, OddsSelection[]>>({});

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
            [sport]: { events: [], configured: true },
          }));
      });
    return () => {
      cancelled = true;
    };
  }, [sport, cache]);

  // Lazy-load the expanded board (alternate lines) for whichever event is open.
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
          [openId]: Array.isArray(d.selections)
            ? (d.selections as OddsSelection[])
            : [],
        }));
      })
      .catch(() => {
        if (!cancelled) setDetail((prev) => ({ ...prev, [openId]: [] }));
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
            const rows = detail[e.id];
            // Show featured lines immediately; swap to featured+alt once loaded.
            const shown = rows && rows.length ? rows : e.selections;
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
                  <div className="space-y-2.5 px-3 pt-0.5 pb-3">
                    {groupByMarket(shown).map(([market, opts]) => (
                      <div key={market}>
                        <p className="text-muted-foreground mb-1 text-[0.7rem] font-semibold tracking-wide uppercase">
                          {market}
                        </p>
                        <div className="flex flex-wrap gap-1.5">
                          {opts.map((s, i) => (
                            <button
                              key={i}
                              type="button"
                              onClick={() =>
                                onPick({
                                  market: s.market,
                                  selection: s.selection,
                                  oddsAmerican: s.oddsAmerican,
                                  eventId: e.id,
                                  eventStartsAt: e.commenceTime,
                                  side: s.side,
                                  line: s.line,
                                  player: s.player,
                                })
                              }
                              className="border-border hover:border-brand hover:bg-surface-2 flex items-center gap-1.5 rounded-md border px-2.5 py-1.5 text-xs transition-colors"
                            >
                              <span>{s.selection}</span>
                              <span className="text-brand nums font-semibold tabular-nums">
                                {formatOdds(s.oddsAmerican)}
                              </span>
                            </button>
                          ))}
                        </div>
                      </div>
                    ))}
                    {rows === undefined ? (
                      <p className="text-muted-foreground text-xs">
                        Loading alternate lines…
                      </p>
                    ) : null}
                  </div>
                ) : null}
              </li>
            );
          })}
        </ul>
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
