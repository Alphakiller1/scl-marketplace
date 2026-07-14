import { Crown, Medal } from "lucide-react";

import { cn } from "@/lib/utils";

/** Shared vocabulary for below-sample / unranked cappers (leaderboard + feed). */
export const BUILDING_RECORD_LABEL = "Building a record";

export function RankBadge({
  rank,
  className,
}: {
  /** Competition place. `0` / null / undefined = unranked (building a record). */
  rank: number | null | undefined;
  className?: string;
}) {
  if (rank == null || rank <= 0) {
    return (
      <span
        className={cn(
          "scl-data text-muted-foreground flex size-10 shrink-0 items-center justify-center rounded-lg border border-dashed text-sm font-bold tabular-nums",
          "border-border bg-surface-2",
          className,
        )}
        aria-label="Unranked"
        title={BUILDING_RECORD_LABEL}
      >
        —
      </span>
    );
  }

  const podium = rank <= 3;
  const Icon = rank === 1 ? Crown : Medal;

  return (
    <span
      className={cn(
        "scl-data flex size-10 shrink-0 items-center justify-center rounded-lg border text-sm font-bold tabular-nums",
        rank === 1 && "border-gold/35 bg-gold/10 text-gold",
        rank === 2 && "border-gold/25 bg-gold/5 text-gold",
        rank === 3 && "border-gold/20 bg-gold/5 text-gold",
        !podium && "border-border bg-surface-2 text-muted-foreground",
        className,
      )}
      aria-label={`Rank ${rank}`}
    >
      {podium ? <Icon className="size-4" aria-hidden /> : rank}
    </span>
  );
}
