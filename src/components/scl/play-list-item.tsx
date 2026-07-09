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
    <div className="border-border bg-card rounded-xl border p-3.5">
      <div className="flex items-start justify-between gap-3">
        <SportTag sport={play.sport} />
        <StatusBadge status={OUTCOME_TO_STATUS[play.outcome]} />
      </div>
      <p className="mt-2 font-semibold break-words">{play.selection}</p>
      {play.kind === "parlay" && play.legs?.length ? (
        <div className="border-border mt-2 space-y-1.5 border-l pl-3">
          {play.legs.map((leg, index) => (
            <div
              key={leg.id}
              className="text-muted-foreground flex min-w-0 items-center gap-2 text-xs"
            >
              <span className="nums text-foreground/70 tabular-nums">
                {index + 1}.
              </span>
              <span className="truncate">{leg.selection}</span>
              <span className="nums shrink-0 tabular-nums">
                {formatOdds(leg.oddsAmerican)}
              </span>
            </div>
          ))}
        </div>
      ) : null}
      <div className="mt-1 flex flex-wrap items-center justify-between gap-2">
        <div className="text-muted-foreground flex flex-wrap items-center gap-x-2 gap-y-1 text-xs">
          <span>{play.market}</span>
          <span className="nums tabular-nums">
            {formatOdds(play.oddsAmerican)}
          </span>
          <span className="nums tabular-nums">
            {formatUnits(play.units, true, false)}
          </span>
        </div>
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
