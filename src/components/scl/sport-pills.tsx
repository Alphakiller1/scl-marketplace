"use client";

import { useEffect, useState } from "react";

import { LeagueMark } from "@/components/scl/league-mark";
import { cn } from "@/lib/utils";
import { SPORTS } from "@/lib/constants";

type SlateDayKeys = { today: string; tomorrow: string };

function localDateKey(d: Date): string {
  return d.toDateString();
}

function slateDayKeys(now = new Date()): SlateDayKeys {
  const tomorrow = new Date(now);
  tomorrow.setDate(tomorrow.getDate() + 1);
  return { today: localDateKey(now), tomorrow: localDateKey(tomorrow) };
}

function nearTermCount(events: { commenceTime: string }[]): number {
  const keys = slateDayKeys();
  return events.filter((e) => {
    const k = localDateKey(new Date(e.commenceTime));
    return k === keys.today || k === keys.tomorrow;
  }).length;
}

/**
 * Sport pill rail — SCL-DESIGN-SPEC SPORT PILL recipe.
 * 44px, radius 22px, mono count badge, blue active (navigation), opacity .42 when count is 0.
 */
export function SportPills({
  value,
  onChange,
  counts: countsProp,
  className,
}: {
  value: string;
  onChange: (sport: string) => void;
  /** Optional external counts; when omitted, pills prefetch near-term event counts. */
  counts?: Partial<Record<string, number>>;
  className?: string;
}) {
  const [fetched, setFetched] = useState<Partial<Record<string, number>>>({});

  useEffect(() => {
    if (countsProp) return;
    let cancelled = false;
    void (async () => {
      let entries: ReadonlyArray<readonly [string, number]>;
      try {
        const res = await fetch("/api/odds?sport=ALL");
        const data = res.ok
          ? ((await res.json()) as {
              events?: { sport: string; commenceTime: string }[];
            })
          : null;
        entries = SPORTS.map(
          (sport) =>
            [
              sport.key,
              nearTermCount(
                (data?.events ?? []).filter(
                  (event) => event.sport === sport.key,
                ),
              ),
            ] as const,
        );
      } catch {
        entries = SPORTS.map((sport) => [sport.key, 0] as const);
      }
      if (!cancelled) setFetched(Object.fromEntries(entries));
    })();
    return () => {
      cancelled = true;
    };
  }, [countsProp]);

  const counts = countsProp ?? fetched;

  return (
    <div
      className={cn(
        "-mx-4 flex scroll-px-4 [scrollbar-width:none] gap-2 overflow-x-auto px-4 pb-1 [-ms-overflow-style:none] [&::-webkit-scrollbar]:hidden",
        className,
      )}
    >
      {SPORTS.map((s) => {
        const active = value === s.key;
        const count = counts[s.key];
        const known = typeof count === "number";
        const zero = known && count === 0;
        return (
          <button
            key={s.key}
            type="button"
            onClick={() => onChange(s.key)}
            aria-pressed={active}
            className={cn(
              "scl-display flex h-11 shrink-0 items-center gap-1.5 rounded-full border px-2.5 text-xs leading-none font-semibold tracking-[0.04em] transition-opacity",
              active
                ? "border-[color:var(--scl-blue)] bg-[color:var(--scl-blue)] text-[color:var(--scl-blue-ink)]"
                : "border-[color:var(--scl-line)] bg-[color:var(--scl-ink-800)] text-[color:var(--scl-muted-data)]",
              zero && !active && "opacity-[0.42]",
            )}
          >
            <LeagueMark leagueKey={s.key} size="sm" />
            {s.label}
            {known ? (
              <span
                className={cn(
                  "scl-data rounded-full border px-1.5 py-0.5 text-[10px] leading-none font-medium",
                  active
                    ? "border-transparent bg-black/18 text-[color:var(--scl-blue-ink)]"
                    : "border-[color:var(--scl-line)] bg-[color:var(--scl-ink-950)] text-[color:var(--scl-muted-label)]",
                )}
              >
                {count}
              </span>
            ) : null}
          </button>
        );
      })}
    </div>
  );
}
