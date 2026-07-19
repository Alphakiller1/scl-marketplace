import { Crown, Medal } from "lucide-react";

import { cn } from "@/lib/utils";
import { PROVISIONAL_RECORD_HELP } from "@/lib/cold-start-copy";
import { isProvisional } from "@/lib/sample";

/** Shared vocabulary for below-sample / unranked cappers (leaderboard + feed). */
export const BUILDING_RECORD_LABEL = "Building a record";

export function RankBadge({
  rank,
  settledPicks,
  variant = "badge",
  className,
}: {
  /** Competition place. `0` / null / undefined = unranked (building a record). */
  rank: number | null | undefined;
  /** When provisional (n&lt;10), suppress rank-1 crown and mark provisional. */
  settledPicks?: number | null;
  /** Ledger rows use a typographic rank rail; cards keep the compact badge. */
  variant?: "badge" | "ledger";
  className?: string;
}) {
  const provisional = isProvisional(settledPicks);

  if (variant === "ledger") {
    const ranked = rank != null && rank > 0;
    return (
      <span
        className={cn(
          "scl-data flex w-8 shrink-0 items-center justify-center text-2xl font-bold tabular-nums",
          !provisional && rank === 1 && "text-[color:var(--scl-pink-text)]",
          !provisional && rank === 2 && "text-foreground",
          !provisional && rank === 3 && "text-[color:var(--scl-muted-data)]",
          ranked && (provisional || rank > 3) && "text-muted-foreground",
          !ranked && "text-muted-foreground",
          className,
        )}
        aria-label={
          ranked ? `Rank ${rank}` : `Unranked — ${BUILDING_RECORD_LABEL}`
        }
        title={provisional ? PROVISIONAL_RECORD_HELP : undefined}
      >
        {ranked ? rank : "—"}
      </span>
    );
  }

  if (rank == null || rank <= 0) {
    return (
      <span
        className={cn(
          "scl-data text-muted-foreground flex size-10 shrink-0 items-center justify-center rounded-lg border border-dashed text-sm font-bold tabular-nums",
          "border-border bg-surface-2",
          className,
        )}
        aria-label={`Unranked — ${BUILDING_RECORD_LABEL}`}
        title={PROVISIONAL_RECORD_HELP}
      >
        —
      </span>
    );
  }

  // Small samples: show place number without podium crown/medal.
  if (provisional) {
    return (
      <span
        className={cn(
          "scl-data border-border bg-surface-2 text-muted-foreground flex size-10 shrink-0 items-center justify-center rounded-lg border text-sm font-bold tabular-nums",
          className,
        )}
        aria-label={`Rank ${rank} (provisional)`}
        title={PROVISIONAL_RECORD_HELP}
      >
        {rank}
      </span>
    );
  }

  const podium = rank <= 3;
  const Icon = rank === 1 ? Crown : Medal;

  return (
    <span
      className={cn(
        "scl-data flex size-10 shrink-0 items-center justify-center rounded-lg border text-sm font-bold tabular-nums",
        rank === 1 && "border-pink/35 bg-pink/10 text-foreground",
        rank === 2 && "border-pink/25 bg-pink/5 text-foreground",
        rank === 3 && "border-pink/20 bg-pink/5 text-foreground",
        !podium && "border-border bg-surface-2 text-muted-foreground",
        className,
      )}
      aria-label={`Rank ${rank}`}
    >
      {podium ? (
        <Icon className="size-4 text-[color:var(--scl-pink)]" aria-hidden />
      ) : (
        rank
      )}
    </span>
  );
}
