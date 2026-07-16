import type { ElementType } from "react";

import { splitBettingTitle } from "@/lib/betting-title";
import { cn } from "@/lib/utils";

/**
 * Pick/selection title with tabular Inter on numeric betting tokens
 * (lines, totals, odds, unit counts) while keeping display type for
 * team/market words — preserves Ticket receipt feel per SCL-DESIGN-SPEC.
 */
export function BettingTitle({
  text,
  className,
  as: Comp = "span",
}: {
  text: string;
  className?: string;
  as?: ElementType;
}) {
  const parts = splitBettingTitle(text);

  return (
    <Comp className={cn(className)}>
      {parts.map((part, i) =>
        part.kind === "num" ? (
          <span
            key={`${i}-${part.value}`}
            className="scl-data font-semibold tracking-normal normal-case"
          >
            {part.value}
          </span>
        ) : (
          <span key={`${i}-${part.value}`}>{part.value}</span>
        ),
      )}
    </Comp>
  );
}
