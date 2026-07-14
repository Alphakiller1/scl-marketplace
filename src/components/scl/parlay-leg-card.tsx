"use client";

import type { ReactNode } from "react";
import { ChevronDown, Trash2 } from "lucide-react";

import { BettingTitle } from "@/components/scl/betting-title";
import { StatValue } from "@/components/scl/stat-value";
import { formatOdds } from "@/lib/format";
import { cn } from "@/lib/utils";

/**
 * Collapsible parlay leg card — SCL_M4_PICK_REDESIGN §4.4 / §4.5.
 * Collapsed: one-line summary (selection · odds · league). Expanded: GamePicker (or children).
 * Fixed header rhythm so expand/collapse does not shift neighboring cards.
 */
export function ParlayLegCard({
  index,
  expanded,
  onToggle,
  onRemove,
  selection,
  oddsAmerican,
  league,
  children,
  className,
}: {
  index: number;
  expanded: boolean;
  onToggle: () => void;
  onRemove?: () => void;
  selection?: string;
  oddsAmerican?: number;
  /** Muted sub-line (sport/league). */
  league?: string;
  children?: ReactNode;
  className?: string;
}) {
  const hasPick = Boolean(selection);
  const oddsOk =
    typeof oddsAmerican === "number" && Math.abs(oddsAmerican) >= 100;

  return (
    <div
      className={cn(
        "border-border overflow-hidden rounded-[14px] border bg-[color:var(--scl-ink-800)]",
        className,
      )}
    >
      <div className="flex min-h-11 items-stretch">
        <button
          type="button"
          onClick={onToggle}
          aria-expanded={expanded}
          className="hover:bg-surface-2/40 flex min-w-0 flex-1 items-center gap-3 px-3 py-2.5 text-left transition-colors"
        >
          <span className="scl-data shrink-0 text-[0.65rem] font-semibold tracking-[0.14em] text-[color:var(--scl-muted-label)] uppercase">
            Leg {index + 1}
          </span>
          <span className="min-w-0 flex-1">
            {hasPick ? (
              <>
                <BettingTitle
                  as="span"
                  text={selection!}
                  className="block truncate text-sm font-semibold"
                />
                <span className="scl-data mt-0.5 block truncate text-[0.65rem] tracking-[0.08em] text-[color:var(--scl-muted-label)] uppercase">
                  {oddsOk ? (
                    <StatValue tone="data" className="font-semibold">
                      {formatOdds(oddsAmerican!)}
                    </StatValue>
                  ) : null}
                  {oddsOk && league ? " · " : null}
                  {league ?? null}
                </span>
              </>
            ) : (
              <span className="text-muted-foreground text-sm">
                Pick a game and line
              </span>
            )}
          </span>
          <ChevronDown
            className={cn(
              "size-4 shrink-0 text-[color:var(--scl-muted-label)] transition-transform",
              expanded && "rotate-180",
            )}
            aria-hidden
          />
        </button>
        {onRemove ? (
          <button
            type="button"
            onClick={onRemove}
            aria-label={`Remove leg ${index + 1}`}
            className="text-muted-foreground hover:text-foreground hover:bg-surface-2 flex min-h-11 min-w-11 shrink-0 items-center justify-center border-l border-[color:var(--scl-line)]"
          >
            <Trash2 className="size-4" />
          </button>
        ) : null}
      </div>
      {expanded ? (
        <div className="border-t border-[color:var(--scl-line)] p-3">
          {children}
        </div>
      ) : null}
    </div>
  );
}
