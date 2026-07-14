import type { Outcome } from "@prisma/client";

import { cn } from "@/lib/utils";
import { formatOdds, formatUnits, signTone } from "@/lib/format";
import { PickTierBadge, SportTag, StatusBadge } from "@/components/scl/badges";
import { TeamMark } from "@/components/scl/team-mark";
import { pickContextLabel, teamIdentityFromSide } from "@/lib/pick-identity";
import type { ParlayView, PlayView } from "@/lib/queries/plays";

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
          <span className="nums scl-data font-semibold tabular-nums">
            {formatOdds(play.oddsAmerican)}
          </span>
          <span className="nums scl-data tabular-nums">
            {formatUnits(play.units, true, false)}
          </span>
        </div>
        {hasResult ? (
          <span
            className={cn(
              "nums scl-data text-sm font-bold tabular-nums",
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

/** A parlay as one record row: leg list + combined odds, stake, and settled result. */
export function ParlayListItem({ parlay }: { parlay: ParlayView }) {
  const hasResult = parlay.profitUnits != null;

  return (
    <div className="border-border bg-card overflow-hidden rounded-xl border p-3.5">
      <div className="flex items-start justify-between gap-3">
        <div className="flex min-w-0 flex-wrap items-center gap-2">
          <span className="bg-surface-2 text-muted-foreground rounded-md px-1.5 py-0.5 text-[0.7rem] font-semibold tracking-wide uppercase">
            {parlay.legs.length}-Leg Parlay
          </span>
          <PickTierBadge tier={parlay.verificationTier} />
        </div>
        <StatusBadge status={OUTCOME_TO_STATUS[parlay.outcome]} />
      </div>
      <ul className="mt-2 space-y-1.5">
        {parlay.legs.map((leg) => {
          const team = teamIdentityFromSide(leg.side, leg.sport);
          return (
            <li key={leg.id} className="flex min-w-0 items-start gap-2.5">
              {team ? (
                <TeamMark team={team} size="sm" className="mt-0.5" />
              ) : null}
              <p className="min-w-0 flex-1 text-sm font-medium break-words">
                {leg.selection}
                <span className="text-muted-foreground nums scl-data ml-1.5 tabular-nums">
                  {formatOdds(leg.oddsAmerican)}
                </span>
              </p>
            </li>
          );
        })}
      </ul>
      <div className="border-border mt-2 flex flex-wrap items-center justify-between gap-2 border-t pt-2">
        <div className="text-muted-foreground flex flex-wrap items-center gap-x-2 gap-y-1 text-xs">
          {parlay.combinedOddsAmerican != null ? (
            <span className="nums scl-data font-semibold tabular-nums">
              {formatOdds(parlay.combinedOddsAmerican)}
            </span>
          ) : null}
          <span className="nums scl-data tabular-nums">
            {formatUnits(parlay.units, true, false)}
          </span>
        </div>
        {hasResult ? (
          <span
            className={cn(
              "nums scl-data text-sm font-bold tabular-nums",
              toneText[signTone(parlay.profitUnits ?? 0)],
            )}
          >
            {formatUnits(parlay.profitUnits ?? 0)}
          </span>
        ) : null}
      </div>
    </div>
  );
}
