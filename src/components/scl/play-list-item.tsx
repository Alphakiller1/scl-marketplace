import { SportTag, StatusBadge } from "@/components/scl/badges";
import { BookMark } from "@/components/scl/book-mark";
import { PlayerHeadshot } from "@/components/scl/player-headshot";
import { StatValue } from "@/components/scl/stat-value";
import { VerifiedBadge } from "@/components/scl/verified-badge";
import { TeamMark } from "@/components/scl/team-mark";
import { extractPlayerName, toHeadshotLeague } from "@/lib/player-headshots";
import { oddsSourceBoardLabel } from "@/lib/books";
import { UNIT_MIN } from "@/lib/constants";
import { formatOdds, formatUnits, signTone } from "@/lib/format";
import { deriveLifecycle } from "@/lib/lifecycle";
import { pickContextLabel, teamIdentityFromSide } from "@/lib/pick-identity";
import type { ParlayView, PlayView } from "@/lib/queries/plays";

export function PlayListItem({
  play,
  dashboard = false,
}: {
  play: PlayView;
  /** Capper dashboard — always show notes; surface invalid-stake badge. */
  dashboard?: boolean;
}) {
  const hasResult = play.profitUnits != null;
  const team = teamIdentityFromSide(play.side, play.sport);
  const context = pickContextLabel({
    sport: play.sport,
    league: play.league,
    market: play.market,
  });
  const source = oddsSourceBoardLabel(play.book);
  const invalidStake = dashboard && play.units < UNIT_MIN;
  const showNotes = dashboard || play.notesPublic !== false ? play.notes : null;

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
          {invalidStake ? (
            <span className="text-muted-foreground border-border rounded-md border px-1.5 py-0.5 text-[0.65rem] font-medium tracking-wide uppercase">
              Invalid stake
            </span>
          ) : null}
        </div>
        <StatusBadge
          status={deriveLifecycle({
            outcome: play.outcome,
            eventStartsAt: play.eventStartsAt,
          })}
        />
      </div>
      <div className="mt-2 flex min-w-0 items-start gap-2.5">
        {play.market === "Player Prop" ? (
          <PlayerHeadshot
            selection={play.selection}
            league={toHeadshotLeague(play.sport)}
            size={30}
            className="mt-0.5"
          />
        ) : team ? (
          <TeamMark team={team} size="sm" className="mt-0.5" />
        ) : null}
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
          <span className="scl-data text-muted-foreground inline-flex items-center gap-1 tracking-[0.06em] uppercase">
            {play.book ? <BookMark bookKey={play.book} size={16} /> : null}
            {source}
          </span>
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
      {showNotes ? (
        <p className="text-muted-foreground mt-2 line-clamp-3 text-xs leading-relaxed">
          {showNotes}
        </p>
      ) : null}
    </div>
  );
}

/** A parlay as one record row: leg list + combined odds, stake, and settled result. */
export function ParlayListItem({ parlay }: { parlay: ParlayView }) {
  const hasResult = parlay.profitUnits != null;
  const legBooks = [
    ...new Set(
      parlay.legs.map((l) => l.book).filter((b): b is string => Boolean(b)),
    ),
  ];
  const source =
    legBooks.length === 1
      ? oddsSourceBoardLabel(legBooks[0]!)
      : oddsSourceBoardLabel(null);

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
          const propPlayer =
            leg.market === "Player Prop"
              ? extractPlayerName(leg.selection)
              : null;
          return (
            <li key={leg.id} className="flex min-w-0 items-start gap-2.5">
              <SportTag sport={leg.sport} markOnly className="mt-0.5" />
              {propPlayer ? (
                <PlayerHeadshot
                  selection={leg.selection}
                  league={toHeadshotLeague(leg.sport)}
                  size={24}
                  className="mt-0.5"
                />
              ) : team ? (
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
          <span className="scl-data text-muted-foreground inline-flex items-center gap-1 tracking-[0.06em] uppercase">
            {legBooks.length === 1 ? (
              <BookMark bookKey={legBooks[0]!} size={16} />
            ) : null}
            {source}
          </span>
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
