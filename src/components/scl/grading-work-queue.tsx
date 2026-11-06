"use client";

import Link from "next/link";
import { useState } from "react";
import { LifeBuoy } from "lucide-react";

import { SportTag } from "@/components/scl/badges";
import { Input } from "@/components/ui/input";
import { adminGradingHref } from "@/lib/admin-grading-link";
import type { StuckPlayRow } from "@/lib/results/stuck-plays";

export function GradingWorkQueue({
  plays,
}: {
  plays: (StuckPlayRow & { reason: string; manualOnly: boolean })[];
}) {
  const [query, setQuery] = useState("");
  const terms = query.toLowerCase().trim().split(/\s+/).filter(Boolean);
  const visible = plays.filter((play) => {
    const text =
      `@${play.handle ?? ""} ${play.selection} ${play.eventLabel ?? ""} ${play.sport} ${play.market} ${play.id}`.toLowerCase();
    return terms.every((term) => text.includes(term));
  });

  return (
    <div className="mb-3 min-w-0 rounded-lg border border-[color:var(--scl-pink)]/40 bg-[color:var(--scl-pink)]/5 p-3">
      <p className="scl-eyebrow text-[color:var(--scl-pink)]">
        Needs grading — {plays.length}
      </p>
      <p className="text-muted-foreground mt-1 text-xs leading-relaxed">
        Previous-slate and overdue plays, including manual review and parlay
        legs. Grade by 5 a.m. Eastern; resolve exceptions by 7 a.m. Automatic
        retries continue where supported.
      </p>
      <label
        htmlFor="grading-queue-search"
        className="mt-3 block text-sm font-medium"
      >
        Find an ungraded play
      </label>
      <Input
        id="grading-queue-search"
        type="search"
        value={query}
        onChange={(event) => setQuery(event.target.value)}
        placeholder="Search capper, team, sport, or play ID"
        className="mt-1"
      />
      <p className="text-muted-foreground mt-2 text-xs" role="status">
        Showing {visible.length} of {plays.length} plays
      </p>
      {visible.length === 0 ? (
        <p className="text-muted-foreground py-4 text-sm">
          No plays match your search.
        </p>
      ) : (
        <ul className="divide-border border-border mt-2 max-h-96 divide-y overflow-auto rounded-lg border bg-[color:var(--scl-ink-800)] text-sm">
          {visible.map((play) => (
            <li key={play.id} className="min-w-0">
              <Link
                href={adminGradingHref(play)}
                className="hover:bg-surface-2/60 focus-visible:ring-ring flex min-w-0 flex-col gap-1 px-3 py-2 break-words focus-visible:ring-2 focus-visible:outline-none focus-visible:ring-inset"
              >
                <p className="flex flex-wrap items-center gap-2 font-medium">
                  <SportTag sport={play.sport} markOnly />
                  <span className="min-w-0 [overflow-wrap:anywhere]">
                    {play.selection}{" "}
                    <span className="text-muted-foreground font-normal">
                      · {play.market} · {play.sport}
                    </span>
                  </span>
                  <span className="scl-link ml-auto inline-flex items-center gap-1 text-xs">
                    <LifeBuoy className="size-3.5" aria-hidden />
                    {play.manualOnly ? "Grade by hand →" : "Settle now →"}
                  </span>
                </p>
                <p className="text-muted-foreground text-xs">{play.reason}</p>
                {play.eventLabel ? (
                  <p className="text-muted-foreground text-xs [overflow-wrap:anywhere]">
                    {play.eventLabel}
                    {play.book ? ` · ${play.book}` : ""}
                  </p>
                ) : null}
                <p className="text-muted-foreground scl-data text-xs [overflow-wrap:anywhere] tabular-nums">
                  @{play.handle ?? "?"} · {play.oddsAmerican} · {play.units}U ·
                  start {play.eventStartsAt ?? "unknown"} · {play.id}
                </p>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
