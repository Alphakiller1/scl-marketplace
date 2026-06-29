import { Crown, Medal } from "lucide-react";

import { cn } from "@/lib/utils";

export function RankBadge({
  rank,
  className,
}: {
  rank: number;
  className?: string;
}) {
  const podium = rank <= 3;
  const Icon = rank === 1 ? Crown : Medal;

  return (
    <span
      className={cn(
        "nums flex size-10 shrink-0 items-center justify-center rounded-lg border text-sm font-bold tabular-nums",
        rank === 1 && "border-gold/35 bg-gold/10 text-gold",
        rank === 2 && "border-border-strong bg-surface-3 text-foreground",
        rank === 3 && "border-brand/30 bg-brand/10 text-brand",
        !podium && "border-border bg-surface-2 text-muted-foreground",
        className,
      )}
      aria-label={`Rank ${rank}`}
    >
      {podium ? <Icon className="size-4" aria-hidden /> : rank}
    </span>
  );
}
