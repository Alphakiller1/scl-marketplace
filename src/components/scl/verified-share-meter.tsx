import { ShieldCheck } from "lucide-react";

import { cn } from "@/lib/utils";

/**
 * Rank-mode Verified column — pink shield + % meter (never blue).
 * Keeps the percent visible per design v2.0 Leaderboard recipe.
 */
export function VerifiedShareMeter({
  pct,
  className,
  showZero = false,
  compact = false,
}: {
  pct: number | null | undefined;
  className?: string;
  /** A measured 0% is meaningful when the caller knows at least one pick exists. */
  showZero?: boolean;
  /** Dense board cell — drop the bar so Sample / Verified never collide. */
  compact?: boolean;
}) {
  if (pct == null || !Number.isFinite(pct) || (!showZero && pct <= 0)) {
    return (
      <span
        className={cn(
          "scl-data text-muted-foreground text-sm tabular-nums",
          className,
        )}
        title="Not Available"
      >
        —
      </span>
    );
  }

  const rounded = Math.round(pct);
  const fill = Math.min(100, Math.max(0, rounded));

  return (
    <div
      className={cn(
        "flex items-center justify-end gap-1.5",
        compact ? "w-full min-w-0" : "min-w-[4.5rem]",
        className,
      )}
      title={`${rounded}% of this capper's picks were board-verified.`}
    >
      <div className="flex min-w-0 items-center gap-0.5">
        <ShieldCheck
          className="size-3.5 shrink-0 text-[color:var(--scl-pink)]"
          aria-hidden
        />
        <span
          className="scl-data text-foreground text-sm font-semibold tabular-nums"
          aria-label={`${rounded} percent board-verified`}
        >
          {rounded}%
        </span>
      </div>
      {compact ? null : (
        <div
          className="bg-surface-2 border-border h-1 w-10 shrink-0 overflow-hidden rounded-full border"
          role="meter"
          aria-valuemin={0}
          aria-valuemax={100}
          aria-valuenow={fill}
          aria-label={`Verified share ${rounded} percent`}
        >
          <div
            className="h-full rounded-full bg-[color:var(--scl-pink)]"
            style={{ width: `${fill}%` }}
          />
        </div>
      )}
    </div>
  );
}
