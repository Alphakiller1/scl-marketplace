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
};

const MARKET_ORDER = ["Moneyline", "Spread", "Total"] as const;

function groupByMarket(
  selections: OddsSelection[],
): [string, OddsSelection[]][] {
  const groups = new Map<string, OddsSelection[]>();
  for (const s of selections) {
    const arr = groups.get(s.market);
    if (arr) arr.push(s);
    else groups.set(s.market, [s]);
  }
  return [...groups.entries()].sort(
    (a, b) =>
      MARKET_ORDER.indexOf(a[0] as (typeof MARKET_ORDER)[number]) -
      MARKET_ORDER.indexOf(b[0] as (typeof MARKET_ORDER)[number]),
  );
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
  const [cache, setCache] = useState<Record<string, OddsEvent[]>>({});
  const [openId, setOpenId] = useState<string | null>(null);

  useEffect(() => {
    if (!sport || sport in cache) return;
    let cancelled = false;
    fetch(`/api/odds?sport=${encodeURIComponent(sport)}`)
      .then((r) => r.json())
      .then((d) => {
        if (cancelled) return;
        const events = Array.isArray(d.events) ? (d.events as OddsEvent[]) : [];
        setCache((c) => ({ ...c, [sport]: events }));
      })
      .catch(() => {
        if (!cancelled) setCache((c) => ({ ...c, [sport]: [] }));
      });
    return () => {
      cancelled = true;
    };
  }, [sport, cache]);

  if (!sport) return null;
  const events = cache[sport];
  const loading = !(sport in cache);

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
                  <div className="space-y-2.5 px-3 pt-0.5 pb-3">
                    {groupByMarket(e.selections).map(([market, opts]) => (
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
                  </div>
                ) : null}
              </li>
            );
          })}
        </ul>
      ) : (
        <p className="text-muted-foreground text-xs">
          No live board for this sport right now — check back closer to game
          time, or enter the play manually below.
        </p>
      )}
    </Card>
  );
}
