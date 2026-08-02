"use client";

import { useState } from "react";
import { ChevronDown } from "lucide-react";

import { SportTag, StatusBadge } from "@/components/scl/badges";
import { BookMark } from "@/components/scl/book-mark";
import { PlayerHeadshot } from "@/components/scl/player-headshot";
import { StatValue } from "@/components/scl/stat-value";
import { VerifiedBadge } from "@/components/scl/verified-badge";
import { TeamMark } from "@/components/scl/team-mark";
import { LeagueRef, TeamRef } from "@/components/scl/entity-marks";
import { ProofReceipt } from "@/components/scl/proof-receipt";
import { extractPlayerName, toHeadshotLeague } from "@/lib/player-headshots";
import { oddsSourceBoardLabel } from "@/lib/books";
import { UNIT_MIN } from "@/lib/constants";
import { formatOdds, formatUnits, signTone } from "@/lib/format";
import { deriveLifecycle } from "@/lib/lifecycle";
import { profitUnitsForOutcome } from "@/lib/odds";
import { pickContextLabel, teamIdentityFromSide } from "@/lib/pick-identity";
import type { ProofReceiptState } from "@/lib/proof-receipt";
import type { ParlayView, PlayView } from "@/lib/queries/plays";
import { cn } from "@/lib/utils";
import { isVerifiedTier } from "@/lib/verification";

function receiptState(
  outcome: PlayView["outcome"],
  eventStartsAt: Date | null,
  verified: boolean,
): ProofReceiptState {
  if (outcome === "WIN") return "won";
  if (outcome === "LOSS") return "loss";
  if (outcome === "PUSH") return "push";
  if (outcome === "VOID") return "void";
  const lifecycle = deriveLifecycle({ outcome, eventStartsAt });
  if (lifecycle === "live") return "live";
  if (lifecycle === "awaiting-grade") return "awaiting-grade";
  return verified ? "captured" : "pending";
}

export function PlayListItem({
  play,
  dashboard = false,
}: {
  play: PlayView;
  /** Capper dashboard — always show notes; surface invalid-stake badge. */
  dashboard?: boolean;
}) {
  const [open, setOpen] = useState(false);
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
        <div className="flex shrink-0 items-center gap-1">
          <StatusBadge
            status={deriveLifecycle({
              outcome: play.outcome,
              eventStartsAt: play.eventStartsAt,
            })}
          />
          <button
            type="button"
            className="focus-visible:ring-ring hover:bg-surface-2 inline-flex size-10 items-center justify-center rounded-lg focus-visible:ring-2 focus-visible:outline-none"
            aria-expanded={open}
            aria-controls={`owner-receipt-${play.id}`}
            aria-label={`${open ? "Close" : "View"} bet slip for ${play.selection}`}
            onClick={() => setOpen((value) => !value)}
          >
            <ChevronDown
              className={cn(
                "size-4 transition-transform",
                open && "rotate-180",
              )}
              aria-hidden
            />
          </button>
        </div>
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
      {open ? (
        <div
          id={`owner-receipt-${play.id}`}
          className="border-border mt-3 border-t pt-4"
        >
          <p className="text-muted-foreground mb-3 text-xs">
            4:5 social-ready proof receipt — screenshot or save this card to
            share your verified record.
          </p>
          <ProofReceipt
            selectionTitle={play.selection}
            leadingMark={
              <TeamRef
                name={play.side}
                sport={play.sport}
                size="md"
                knownOnly
              />
            }
            eventLine={
              <span className="inline-flex flex-wrap items-center gap-1.5 tracking-normal normal-case">
                <LeagueRef sport={play.sport} league={play.league} />
                {context ? (
                  <span className="scl-data tracking-[0.06em] uppercase">
                    {context}
                  </span>
                ) : null}
              </span>
            }
            odds={formatOdds(play.oddsAmerican)}
            stake={formatUnits(play.units, true, false)}
            toWin={(() => {
              const value =
                play.profitUnits ??
                profitUnitsForOutcome("WIN", play.oddsAmerican, play.units);
              return value == null ? "—" : formatUnits(value, true, hasResult);
            })()}
            capturedAt={play.createdAt.toISOString()}
            book={play.book}
            state={receiptState(
              play.outcome,
              play.eventStartsAt,
              isVerifiedTier(play.verificationTier),
            )}
            density="share-image"
            verificationDominant
            boardVerified={isVerifiedTier(play.verificationTier)}
            closingOddsAmerican={play.closingOddsAmerican ?? null}
            clvPts={play.clvPts ?? null}
            evidenceId={play.id}
            eventStartsAt={play.eventStartsAt}
            analysis={showNotes}
            className="mx-auto"
          />
        </div>
      ) : null}
    </div>
  );
}

/** A parlay as one record row: leg list + combined odds, stake, and settled result. */
export function ParlayListItem({ parlay }: { parlay: ParlayView }) {
  const [open, setOpen] = useState(false);
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
        <div className="flex shrink-0 items-center gap-1">
          <StatusBadge
            status={deriveLifecycle({
              outcome: parlay.outcome,
              eventStartsAt: parlay.eventStartsAt,
            })}
          />
          <button
            type="button"
            className="focus-visible:ring-ring hover:bg-surface-2 inline-flex size-10 items-center justify-center rounded-lg focus-visible:ring-2 focus-visible:outline-none"
            aria-expanded={open}
            aria-controls={`owner-receipt-${parlay.id}`}
            aria-label={`${open ? "Close" : "View"} ${parlay.legs.length}-leg parlay bet slip`}
            onClick={() => setOpen((value) => !value)}
          >
            <ChevronDown
              className={cn(
                "size-4 transition-transform",
                open && "rotate-180",
              )}
              aria-hidden
            />
          </button>
        </div>
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
      {open ? (
        <div
          id={`owner-receipt-${parlay.id}`}
          className="border-border mt-3 border-t pt-4"
        >
          <p className="text-muted-foreground mb-3 text-xs">
            4:5 social-ready proof receipt — screenshot or save this card to
            share your verified record.
          </p>
          <ProofReceipt
            selectionTitle={`${parlay.legs.length}-Leg Parlay\n${parlay.legs.map((leg) => leg.selection).join(" · ")}`}
            eventLine="All legs captured from one sportsbook"
            legs={parlay.legs.length}
            odds={
              parlay.combinedOddsAmerican == null
                ? "—"
                : formatOdds(parlay.combinedOddsAmerican)
            }
            stake={formatUnits(parlay.units, true, false)}
            toWin={
              parlay.profitUnits != null
                ? formatUnits(parlay.profitUnits, true, true)
                : parlay.combinedOddsAmerican == null
                  ? "—"
                  : (() => {
                      const value = profitUnitsForOutcome(
                        "WIN",
                        parlay.combinedOddsAmerican,
                        parlay.units,
                      );
                      return value == null
                        ? "—"
                        : formatUnits(value, true, false);
                    })()
            }
            capturedAt={parlay.createdAt.toISOString()}
            book={legBooks.length === 1 ? legBooks[0] : null}
            state={receiptState(
              parlay.outcome,
              parlay.eventStartsAt,
              isVerifiedTier(parlay.verificationTier),
            )}
            density="share-image"
            verificationDominant
            boardVerified={isVerifiedTier(parlay.verificationTier)}
            evidenceId={parlay.id}
            eventStartsAt={parlay.eventStartsAt}
            className="mx-auto"
          />
        </div>
      ) : null}
    </div>
  );
}
