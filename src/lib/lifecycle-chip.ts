/**
 * Lifecycle / result chip presentation (M5 §5.2).
 * Pure — StatusBadge and unit tests share this mapping.
 */

import type { PickStatus } from "@/lib/mock";

export type LifecycleChipStyle = {
  label: string;
  className: string;
  /** Pulsing dot — Live only. */
  live?: boolean;
  /** Screen-reader prefix: Status for lifecycle, Result for graded outcomes. */
  ariaPrefix: "Status" | "Result";
};

/**
 * Spec tokens (docs/SCL_M5_UNIFIED_BET_SLIP.md §5.2):
 * Pre-Game → blue informational; Live → live/blue (distinct pulse);
 * Awaiting Grade → muted; Won/Lost → win-green / loss-red; Push/Void → push-neutral / muted.
 */
export const LIFECYCLE_CHIP_STYLES: Record<PickStatus, LifecycleChipStyle> = {
  "pre-game": {
    label: "Pre-Game",
    className: "bg-blue/10 text-blue ring-1 ring-blue/25",
    ariaPrefix: "Status",
  },
  pending: {
    label: "Pending",
    className: "bg-muted/60 text-muted-foreground",
    ariaPrefix: "Status",
  },
  live: {
    label: "Live",
    className: "bg-live/15 text-live ring-1 ring-live/30",
    live: true,
    ariaPrefix: "Status",
  },
  "awaiting-grade": {
    label: "Awaiting Grade",
    className: "bg-muted/50 text-muted-foreground",
    ariaPrefix: "Status",
  },
  win: {
    label: "Won",
    className: "bg-pos/15 text-pos ring-1 ring-pos/30",
    ariaPrefix: "Result",
  },
  loss: {
    label: "Lost",
    className: "bg-neg/15 text-neg ring-1 ring-neg/30",
    ariaPrefix: "Result",
  },
  push: {
    label: "Push",
    className: "bg-push/15 text-push ring-1 ring-push/30",
    ariaPrefix: "Result",
  },
  void: {
    label: "Void",
    className: "bg-muted/40 text-muted-foreground",
    ariaPrefix: "Result",
  },
};

export function lifecycleChipAriaLabel(status: PickStatus): string {
  const s = LIFECYCLE_CHIP_STYLES[status];
  return `${s.ariaPrefix}: ${s.label}`;
}
