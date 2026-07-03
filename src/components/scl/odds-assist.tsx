"use client";

import { useEffect, useState } from "react";
import { ChevronDown, Clock3, Zap } from "lucide-react";

import { Card } from "@/components/ui/card";
import { SkeletonCard } from "@/components/scl/states";
import { TeamMark } from "@/components/scl/team-mark";
import { formatOdds } from "@/lib/format";
import type { OddsEvent, OddsSelection } from "@/lib/odds-api";
import { cn } from "@/lib/utils";

export type OddsPick = {
  market: string;
  selection: string;
  oddsAmerican: number;
  team?: string;
};

type BoardData = { events: OddsEvent[]; configured: boolean };

const MARKET_ORDER = ["Moneyline", "Spread", "Total"] as const;

function groupByMarket(
  selections: OddsSelection[],
): [string, OddsSelection[]][] {
  const groups = new Map<string, OddsSelection[]>();
  for (const selection of selections) {
    const group = groups.get(selection.market);
    if (group) group.push(selection);
    else groups.set(selection.market, [selection]);
  }
  return [...groups.entries()].sort(
    (a, b) =>
      MARKET_ORDER.indexOf(a[0] as (typeof MARKET_ORDER)[number]) -
      MARKET_ORDER.indexOf(b[0] as (typeof MARKET_ORDER)[number]),
  );
}

function isSelected(selection: OddsSelection, selected?: OddsPick | null) {
  return (
    selected?.market === selection.market &&
    selected.selection === selection.selection &&
    selected.oddsAmerican === selection.oddsAmerican
  );
}

export function OddsAssist({
  sport,
  onPick,
  selected,
}: {
  sport: string;
  onPick: (pick: OddsPick) => void;
  selected?: OddsPick | null;
}) {
  const [cache, setCache] = useState<Record<string, BoardData>>({});
  const [openBySport, setOpenBySport] = useState<Record<string, string | null>>(
    {},
  );

  useEffect(() => {
    if (!sport || sport in cache) return;
    let cancelled = false;
    fetch(`/api/odds?sport=${encodeURIComponent(sport)}`)
      .then((response) => response.json())
      .then((data) => {
        if (cancelled) return;
        const events = Array.isArray(data.events)
          ? (data.events as OddsEvent[])
          : [];
        setCache((current) => ({
          ...current,
          [sport]: {
            events,
            configured: Boolean(data.configured),
          },
        }));
      })
      .catch(() => {
        if (!cancelled) {
          setCache((current) => ({
            ...current,
            [sport]: { events: [], configured: true },
          }));
        }
      });
    return () => {
      cancelled = true;
    };
  }, [sport, cache]);

  if (!sport) return null;
  const board = cache[sport];
  const loading = !(sport in cache);
  const events = board?.events;
  const configured = board?.configured ?? true;
  const openId =
    sport in openBySport ? openBySport[sport] : (events?.[0]?.id ?? null);

  return (
    <Card className="gap-0 overflow-hidden p-0">
      <div className="flex items-center gap-1.5 px-4 py-3 text-sm font-medium">
        <Zap className="text-brand size-4" aria-hidden />
        Tonight&apos;s board
        <span className="text-muted-foreground ml-auto text-xs font-normal">
          Select a price
        </span>
      </div>

      {loading || events == null ? (
        <div className="px-4 pb-4">
          <SkeletonCard />
        </div>
      ) : events.length ? (
        <ul className="divide-border border-border max-h-[34rem] divide-y overflow-auto border-t">
          {events.map((event) => {
            const open = openId === event.id;
            return (
              <li key={event.id} className="bg-card">
                <button
                  type="button"
                  onClick={() =>
                    setOpenBySport((current) => ({
                      ...current,
                      [sport]: open ? null : event.id,
                    }))
                  }
                  className="hover:bg-surface-2 grid w-full grid-cols-[minmax(0,1fr)_auto_minmax(0,1fr)] items-center gap-3 px-3 py-3 text-left text-sm"
                  aria-expanded={open}
                >
                  <span className="flex min-w-0 items-center gap-2">
                    <TeamMark team={event.away} sport={sport} />
                    <span className="truncate font-semibold">{event.away}</span>
                  </span>
                  <span className="text-muted-foreground flex flex-col items-center text-[0.65rem] font-semibold uppercase">
                    <span>@</span>
                    <Clock3 className="mt-0.5 size-3" aria-hidden />
                  </span>
                  <span className="flex min-w-0 items-center justify-end gap-2">
                    <span className="truncate text-right font-semibold">
                      {event.home}
                    </span>
                    <TeamMark team={event.home} sport={sport} />
                    <ChevronDown
                      className={cn(
                        "text-muted-foreground size-4 shrink-0 transition-transform",
                        open && "rotate-180",
                      )}
                      aria-hidden
                    />
                  </span>
                </button>

                {open ? (
                  <div className="bg-surface-2/50 space-y-3 border-t px-3 py-3">
                    <p className="text-muted-foreground text-center text-xs">
                      {new Date(event.commenceTime).toLocaleString(undefined, {
                        month: "short",
                        day: "numeric",
                        hour: "numeric",
                        minute: "2-digit",
                      })}
                    </p>
                    {groupByMarket(event.selections).map(
                      ([market, selections]) => (
                        <div key={market}>
                          <p className="text-muted-foreground mb-1 text-[0.7rem] font-semibold tracking-wide uppercase">
                            {market}
                          </p>
                          <div className="grid grid-cols-2 gap-2">
                            {selections.map((selection, index) => (
                              <button
                                key={index}
                                type="button"
                                onClick={() =>
                                  onPick({
                                    market: selection.market,
                                    selection: selection.selection,
                                    oddsAmerican: selection.oddsAmerican,
                                    team: selection.team,
                                  })
                                }
                                aria-pressed={isSelected(selection, selected)}
                                className={cn(
                                  "border-border bg-card hover:border-brand flex min-h-11 items-center gap-2 rounded-lg border px-2.5 py-2 text-left text-xs transition-colors",
                                  isSelected(selection, selected)
                                    ? "border-brand bg-brand/10 ring-brand/30 ring-1"
                                    : "hover:bg-surface-3",
                                )}
                              >
                                {selection.team ? (
                                  <TeamMark
                                    team={selection.team}
                                    sport={sport}
                                    className="size-6"
                                  />
                                ) : null}
                                <span className="min-w-0 flex-1 truncate">
                                  {selection.label}
                                </span>
                                <span className="text-brand nums shrink-0 font-semibold tabular-nums">
                                  {formatOdds(selection.oddsAmerican)}
                                </span>
                              </button>
                            ))}
                          </div>
                        </div>
                      ),
                    )}
                  </div>
                ) : null}
              </li>
            );
          })}
        </ul>
      ) : configured ? (
        <p className="text-muted-foreground px-4 pb-4 text-xs">
          No live games for this sport right now. Try MLB, or enter the play
          manually.
        </p>
      ) : (
        <p className="text-muted-foreground px-4 pb-4 text-xs">
          Live odds aren&apos;t enabled yet. Add{" "}
          <code className="text-foreground">ODDS_API_KEY</code> in Vercel and
          redeploy. Manual entry remains available.
        </p>
      )}
    </Card>
  );
}
