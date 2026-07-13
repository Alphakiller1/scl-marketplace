import {
  Flame,
  Minus,
  Snowflake,
  TrendingDown,
  TrendingUp,
} from "lucide-react";

import { cn } from "@/lib/utils";
import type { FormResult } from "@/lib/mock";

/** Rank movement vs previous period. Motion-free, scan-fast. */
export function RankMovementIndicator({
  delta,
  className,
}: {
  delta: number;
  className?: string;
}) {
  if (delta === 0)
    return (
      <span
        className={cn(
          "text-muted-foreground inline-flex items-center gap-0.5 text-xs",
          className,
        )}
        aria-label="No rank change"
      >
        <Minus className="size-3" />
      </span>
    );
  const up = delta > 0;
  return (
    <span
      className={cn(
        "nums inline-flex items-center gap-0.5 text-xs font-semibold tabular-nums",
        up ? "text-pos" : "text-neg",
        className,
      )}
      aria-label={`${up ? "Up" : "Down"} ${Math.abs(delta)} ${Math.abs(delta) === 1 ? "place" : "places"}`}
    >
      {up ? (
        <TrendingUp className="size-3" />
      ) : (
        <TrendingDown className="size-3" />
      )}
      {Math.abs(delta)}
    </span>
  );
}

/** Recent form as compact W/L/P pills — most recent on the right. */
export function RecentFormStrip({
  form,
  className,
}: {
  form: FormResult[];
  className?: string;
}) {
  if (!form.length) return null;

  const tone: Record<FormResult, string> = {
    W: "bg-pos/20 text-pos",
    L: "bg-neg/20 text-neg",
    P: "bg-surface-3 text-muted-foreground",
  };
  const label: Record<FormResult, string> = {
    W: "Win",
    L: "Loss",
    P: "Push",
  };

  return (
    <div
      className={cn("flex items-center gap-1", className)}
      role="list"
      aria-label={`Recent form, ${form.length} results, oldest to newest`}
    >
      {form.map((r, i) => (
        <span
          key={i}
          role="listitem"
          aria-label={`${label[r]}${i === form.length - 1 ? ", most recent" : ""}`}
          className={cn(
            "flex size-5 items-center justify-center rounded-full text-[0.65rem] font-bold",
            tone[r],
          )}
        >
          <span aria-hidden>{r}</span>
        </span>
      ))}
    </div>
  );
}

/** Win/loss streak chip. */
export function StreakChip({
  streak,
  className,
}: {
  streak: number;
  className?: string;
}) {
  if (streak === 0) return null;
  const hot = streak > 0;
  return (
    <span
      className={cn(
        "nums inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-semibold tabular-nums",
        hot ? "bg-pos/15 text-pos" : "bg-neg/15 text-neg",
        className,
      )}
    >
      {hot ? (
        <Flame className="size-3" aria-hidden />
      ) : (
        <Snowflake className="size-3" aria-hidden />
      )}
      {Math.abs(streak)}
      {hot ? "W" : "L"}
    </span>
  );
}
