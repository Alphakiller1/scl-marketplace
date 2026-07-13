import type { Outcome } from "@prisma/client";

import { cn } from "@/lib/utils";
import { formatOdds, formatUnits, signTone } from "@/lib/format";
import { PickTierBadge, SportTag, StatusBadge } from "@/components/scl/badges";
import { TeamMark } from "@/components/scl/team-mark";
import { pickContextLabel, teamIdentityFromSide } from "@/lib/pick-identity";
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

const toneText = {
  pos: "text-pos",
  neg: "text-neg",
  muted: "text-muted-foreground",
} as const;

export function PlayListItem({ play }: { play: PlayView }) {
  const hasResult = play.profitUnits != null;
  const team = teamIdentityFromSide(play.side, play.sport);
  const context = pickContextLabel({
    sport: play.sport,
    league: play.league,
    market: play.market,
  });

  return (
    <div className="border-border bg-card overflow-hidden rounded-xl border p-3.5">
      <div className="flex items-start justify-between gap-3">
        <div className="flex min-w-0 flex-wrap items-center gap-2">
          <SportTag sport={play.sport} />
          {context ? (
            <span className="text-muted-foreground truncate text-xs">
              {context}
            </span>
          ) : null}
          <PickTierBadge tier={play.verificationTier} />
        </div>
        <StatusBadge status={OUTCOME_TO_STATUS[play.outcome]} />
      </div>
      <div className="mt-2 flex min-w-0 items-start gap-2.5">
        {team ? <TeamMark team={team} size="sm" className="mt-0.5" /> : null}
        <p className="min-w-0 flex-1 font-semibold break-words">
          {play.selection}
        </p>
      </div>
      <div className="mt-1.5 flex flex-wrap items-center justify-between gap-2">
        <div className="text-muted-foreground flex flex-wrap items-center gap-x-2 gap-y-1 text-xs">
          <span className="nums font-semibold tabular-nums">
            {formatOdds(play.oddsAmerican)}
          </span>
          <span className="nums tabular-nums">
            {formatUnits(play.units, true, false)}
          </span>
        </div>
        {hasResult ? (
          <span
            className={cn(
              "nums text-sm font-bold tabular-nums",
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
