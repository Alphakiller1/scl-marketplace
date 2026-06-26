import type { Outcome } from "@prisma/client";

import { cn } from "@/lib/utils";
import { formatOdds, formatUnits, signTone } from "@/lib/format";
import { SportTag, StatusBadge } from "@/components/scl/badges";
import type { PlayView } from "@/lib/queries/plays";

const OUTCOME_TO_STATUS = {
  PENDING: "pending",
  WIN: "win",
  LOSS: "loss",
  PUSH: "push",
  VOID: "void",
} as const satisfies Record<
  Outcome,
  "pending" | "win" | "loss" | "push" | "void"
>;

const toneText = { pos: "text-pos", neg: "text-neg", muted: "text-foreground" };

export function PlayListItem({ play }: { play: PlayView }) {
  const hasResult = play.profitUnits != null;
  return (
    <div className="border-border bg-card flex items-center gap-3 rounded-xl border p-3">
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-2">
          <SportTag sport={play.sport} />
          <span className="truncate font-semibold">{play.selection}</span>
        </div>
        <div className="text-muted-foreground mt-0.5 flex items-center gap-2 text-xs">
          <span>{play.market}</span>
          <span className="nums tabular-nums">
            {formatOdds(play.oddsAmerican)}
          </span>
          <span className="nums tabular-nums">
            {formatUnits(play.units, true, false)}u
          </span>
        </div>
      </div>

      <div className="flex flex-col items-end gap-1">
        <StatusBadge status={OUTCOME_TO_STATUS[play.outcome]} />
        {hasResult ? (
          <span
            className={cn(
              "nums text-sm font-semibold tabular-nums",
              toneText[signTone(play.profitUnits ?? 0)],
            )}
          >
            {formatUnits(play.profitUnits ?? 0)}
          </span>
        ) : null}
      </div>
    </div>
  );
}
