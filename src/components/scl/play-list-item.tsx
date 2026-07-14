import { formatOdds, formatUnits, signTone } from "@/lib/format";
import { SportTag, StatusBadge } from "@/components/scl/badges";
import { StatValue } from "@/components/scl/stat-value";
import { VerifiedBadge } from "@/components/scl/verified-badge";
import { TeamMark } from "@/components/scl/team-mark";
import { deriveLifecycle } from "@/lib/lifecycle";
import { pickContextLabel, teamIdentityFromSide } from "@/lib/pick-identity";
import type { ParlayView, PlayView } from "@/lib/queries/plays";

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
          <VerifiedBadge tier={play.verificationTier} />
        </div>
        <StatusBadge
          status={deriveLifecycle({
            outcome: play.outcome,
            eventStartsAt: play.eventStartsAt,
          })}
        />
      </div>
      <div className="mt-2 flex min-w-0 items-start gap-2.5">
        {team ? <TeamMark team={team} size="sm" className="mt-0.5" /> : null}
        <p className="min-w-0 flex-1 font-semibold break-words">
          {play.selection}
        </p>
      </div>
      <div className="mt-1.5 flex flex-wrap items-center justify-between gap-2">
        <div className="flex flex-wrap items-center gap-x-2 gap-y-1 text-xs">
          <StatValue tone="text" className="font-semibold">
            {formatOdds(play.oddsAmerican)}
          </StatValue>
          <StatValue tone="data">
            {formatUnits(play.units, true, false)}
          </StatValue>
        </div>
        {hasResult ? (
          <StatValue
            tone={signTone(play.profitUnits ?? 0) === "pos" ? "win" : "loss"}
            className="text-sm font-bold"
          >
            {formatUnits(play.profitUnits ?? 0)}
          </StatValue>
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
          <VerifiedBadge tier={parlay.verificationTier} />
        </div>
        <StatusBadge
          status={deriveLifecycle({
            outcome: parlay.outcome,
            eventStartsAt: parlay.eventStartsAt,
          })}
        />
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
                <StatValue tone="data" className="ml-1.5">
                  {formatOdds(leg.oddsAmerican)}
                </StatValue>
              </p>
            </li>
          );
        })}
      </ul>
      <div className="border-border mt-2 flex flex-wrap items-center justify-between gap-2 border-t pt-2">
        <div className="flex flex-wrap items-center gap-x-2 gap-y-1 text-xs">
          {parlay.combinedOddsAmerican != null ? (
            <StatValue tone="pink" className="font-semibold">
              {formatOdds(parlay.combinedOddsAmerican)}
            </StatValue>
          ) : null}
          <StatValue tone="data">
            {formatUnits(parlay.units, true, false)}
          </StatValue>
        </div>
        {hasResult ? (
          <StatValue
            tone={signTone(parlay.profitUnits ?? 0) === "pos" ? "win" : "loss"}
            className="text-sm font-bold"
          >
            {formatUnits(parlay.profitUnits ?? 0)}
          </StatValue>
        ) : null}
      </div>
    </div>
  );
}
