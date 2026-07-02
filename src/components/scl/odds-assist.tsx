"use client";

import { useState } from "react";
import { Loader2, Zap } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { formatOdds } from "@/lib/format";
import type { OddsEvent } from "@/lib/odds-api";

export type OddsPick = {
  market: string;
  selection: string;
  oddsAmerican: number;
};

/**
 * Optional odds-assist: pull live games for the chosen sport and prefill the entry
 * form's market / selection / odds. Degrades to a quiet empty state when no key is
 * configured or the sport is unsupported — manual entry always works.
 */
export function OddsAssist({
  sport,
  onPick,
}: {
  sport: string;
  onPick: (pick: OddsPick) => void;
}) {
  const [events, setEvents] = useState<OddsEvent[] | null>(null);
  const [loading, setLoading] = useState(false);
  const [openId, setOpenId] = useState<string | null>(null);

  async function load() {
    if (!sport) return;
    setLoading(true);
    try {
      const res = await fetch(`/api/odds?sport=${encodeURIComponent(sport)}`);
      const data = await res.json();
      setEvents(Array.isArray(data.events) ? (data.events as OddsEvent[]) : []);
    } catch {
      setEvents([]);
    }
    setLoading(false);
  }

  return (
    <Card className="space-y-3 p-4">
      <div className="flex items-center justify-between gap-3">
        <div className="min-w-0">
          <p className="flex items-center gap-1.5 text-sm font-medium">
            <Zap className="text-brand size-4" /> Odds assist
          </p>
          <p className="text-muted-foreground text-xs">
            Pull a live game to prefill market, selection, and odds.
          </p>
        </div>
        <Button
          type="button"
          variant="outline"
          size="sm"
          onClick={load}
          disabled={loading || !sport}
        >
          {loading ? <Loader2 className="size-4 animate-spin" /> : null}
          {events == null ? "Load games" : "Refresh"}
        </Button>
      </div>

      {events != null ? (
        events.length ? (
          <ul className="divide-border border-border max-h-72 divide-y overflow-auto rounded-lg border">
            {events.map((e) => (
              <li key={e.id} className="bg-card">
                <button
                  type="button"
                  onClick={() => setOpenId(openId === e.id ? null : e.id)}
                  className="hover:bg-surface-2 flex w-full items-center justify-between gap-2 px-3 py-2 text-left text-sm"
                  aria-expanded={openId === e.id}
                >
                  <span className="truncate">
                    {e.away} @ {e.home}
                  </span>
                  <span className="text-muted-foreground shrink-0 text-xs">
                    {new Date(e.commenceTime).toLocaleDateString(undefined, {
                      month: "short",
                      day: "numeric",
                    })}
                  </span>
                </button>
                {openId === e.id ? (
                  <div className="flex flex-wrap gap-1.5 px-3 pb-2.5">
                    {e.selections.map((s, i) => (
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
                        className="border-border hover:border-brand rounded-md border px-2 py-1 text-xs transition-colors"
                      >
                        {s.label}{" "}
                        <span className="text-muted-foreground nums tabular-nums">
                          {formatOdds(s.oddsAmerican)}
                        </span>
                      </button>
                    ))}
                  </div>
                ) : null}
              </li>
            ))}
          </ul>
        ) : (
          <p className="text-muted-foreground text-xs">
            No live games available — odds assist needs a configured API key and
            a supported sport. You can still enter the play manually.
          </p>
        )
      ) : null}
    </Card>
  );
}
