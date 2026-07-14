"use client";

import Link from "next/link";

import { Card } from "@/components/ui/card";
import type { TodayPick } from "@/lib/mock";
import {
  formatOdds,
  formatRecord,
  formatUnits,
  signTone,
  timeAgo,
} from "@/lib/format";
import { CapperAvatar } from "@/components/scl/capper-avatar";
import { CapperIdentityLabel } from "@/components/scl/capper-identity-label";
import { SportTag, StatusBadge } from "@/components/scl/badges";
import { StatValue } from "@/components/scl/stat-value";
import { VerifiedBadge } from "@/components/scl/verified-badge";
import { BUILDING_RECORD_LABEL, RankBadge } from "@/components/scl/rank-badge";
import { TeamMark } from "@/components/scl/team-mark";
import { Ticket, type TicketStatus } from "@/components/scl/ticket";
import { isBuildingARecord } from "@/lib/leaderboard";
import { americanToDecimal } from "@/lib/odds";
import { pickContextLabel, teamIdentityFromSide } from "@/lib/pick-identity";
import { isVerifiedTier } from "@/lib/verification";
import { cn } from "@/lib/utils";

const toneText = {
  pos: "text-pos",
  neg: "text-neg",
  muted: "text-muted-foreground",
} as const;

/** Market/event label — omit when missing or same as the league/sport (no double "MLB"). */
function pickMarketLabel(pick: TodayPick): string | null {
  const market = pick.market?.trim() || pick.event?.trim() || "";
  if (!market) return null;
  const label = pickContextLabel({
    sport: pick.sport,
    league: pick.sport,
    market,
  });
  return label || null;
}

function CapperStandingLine({ pick }: { pick: TodayPick }) {
  const building = isBuildingARecord({
    rank: pick.capperRank,
    settledPicks: pick.capperSettledPicks,
  });

  if (building) {
    return (
      <span className="text-muted-foreground inline-flex min-h-10 items-center gap-1.5 text-xs font-medium">
        <RankBadge rank={0} className="size-8" />
        <span className="min-w-0 leading-snug">{BUILDING_RECORD_LABEL}</span>
      </span>
    );
  }

  return (
    <StatValue tone="label" className="text-xs">
      {formatRecord(
        pick.capperRecord.w,
        pick.capperRecord.l,
        pick.capperRecord.p,
      )}
    </StatValue>
  );
}

function ticketStatusFor(pick: TodayPick): TicketStatus {
  if (pick.status === "win") return "win";
  if (pick.status === "loss") return "loss";
  if (pick.verificationTier && isVerifiedTier(pick.verificationTier)) {
    return "verified";
  }
  if (pick.status === "pending" || pick.status === "live") return "pending";
  return "muted";
}

function CapperTicketFooter({ pick }: { pick: TodayPick }) {
  return (
    <div className="flex items-center justify-between gap-2">
      <Link
        href={`/cappers/${pick.capper.handle}`}
        className="focus-visible:ring-ring flex min-h-11 min-w-0 items-center gap-2 rounded-lg outline-none hover:underline focus-visible:ring-2"
      >
        <CapperAvatar
          name={pick.capper.name}
          src={pick.capper.avatarUrl}
          size="sm"
        />
        <div className="min-w-0">
          <CapperIdentityLabel
            capper={pick.capper}
            compact
            primaryClassName="text-sm"
          />
          <CapperStandingLine pick={pick} />
        </div>
      </Link>
      <StatValue tone="label" className="shrink-0 text-xs">
        {timeAgo(pick.postedAt)}
      </StatValue>
    </div>
  );
}

function VerifiedPickTicket({
  pick,
  compact,
}: {
  pick: TodayPick;
  compact?: boolean;
}) {
  const projected = pick.units * (americanToDecimal(pick.oddsAmerican) - 1);
  const toWin =
    pick.profitUnits != null
      ? formatUnits(pick.profitUnits)
      : formatUnits(projected, true, false);
  const eventLine = [pickMarketLabel(pick), pick.gameTime]
    .filter(Boolean)
    .join(" · ");

  return (
    <Ticket
      selectionTitle={pick.selection}
      eventLine={eventLine || pick.sport}
      legs={1}
      odds={formatOdds(pick.oddsAmerican)}
      stake={formatUnits(pick.units, true, false)}
      toWin={toWin}
      capturedAt={pick.postedAt.toISOString()}
      status={ticketStatusFor(pick)}
      className={compact ? "rounded-[14px]" : undefined}
      footerAction={<CapperTicketFooter pick={pick} />}
    />
  );
}

/** Today's-pick card — verified picks use the Ticket signature face. */
export function PickCard({
  pick,
  compact = false,
}: {
  pick: TodayPick;
  compact?: boolean;
}) {
  const verified =
    pick.verificationTier != null && isVerifiedTier(pick.verificationTier);

  if (verified || pick.status === "win" || pick.status === "loss") {
    return <VerifiedPickTicket pick={pick} compact={compact} />;
  }

  if (compact) {
    return <CompactPickCard pick={pick} />;
  }

  const team = teamIdentityFromSide(pick.side, pick.sport);
  const hasResult = pick.profitUnits != null;
  const marketLabel = pickMarketLabel(pick);

  return (
    <Card className="gap-0 overflow-hidden p-3.5 sm:p-4">
      <div className="flex items-center justify-between gap-2">
        <div className="flex min-w-0 items-center gap-2">
          <SportTag sport={pick.sport} />
          {marketLabel ? (
            <span className="text-muted-foreground truncate text-xs">
              {marketLabel}
            </span>
          ) : null}
        </div>
        <div className="flex shrink-0 items-center gap-1.5">
          <VerifiedBadge tier={pick.verificationTier} />
          <StatusBadge status={pick.status} />
        </div>
      </div>

      <div className="mt-3 flex min-w-0 items-start gap-2.5">
        {team ? <TeamMark team={team} size="md" className="mt-0.5" /> : null}
        <div className="min-w-0 flex-1">
          <div className="flex min-w-0 flex-wrap items-baseline gap-x-2 gap-y-0.5">
            <span className="scl-display text-lg font-semibold tracking-tight break-words">
              {pick.selection}
            </span>
            <StatValue tone="data" className="text-sm font-semibold">
              {formatOdds(pick.oddsAmerican)}
            </StatValue>
          </div>
        </div>
      </div>

      <div className="bg-surface-2 mt-3 flex items-center justify-between gap-2 rounded-lg px-2.5 py-1.5">
        <div className="flex min-w-0 items-center gap-2">
          <span className="text-muted-foreground text-xs font-medium">
            Stake
          </span>
          <StatValue tone="text" className="font-semibold">
            {formatUnits(pick.units, true, false)}
          </StatValue>
        </div>
        {hasResult ? (
          <StatValue
            tone={signTone(pick.profitUnits ?? 0) === "pos" ? "win" : "loss"}
            className="shrink-0 text-sm font-bold"
          >
            {formatUnits(pick.profitUnits ?? 0)}
          </StatValue>
        ) : null}
      </div>

      <div className="border-border mt-3 border-t pt-3">
        <CapperTicketFooter pick={pick} />
      </div>
    </Card>
  );
}

function CompactPickCard({ pick }: { pick: TodayPick }) {
  const team = teamIdentityFromSide(pick.side, pick.sport);
  const hasResult = pick.profitUnits != null;
  const building = isBuildingARecord({
    rank: pick.capperRank,
    settledPicks: pick.capperSettledPicks,
  });
  const marketLabel = pickMarketLabel(pick);

  return (
    <Card className="gap-0 overflow-hidden p-3">
      <div className="flex min-w-0 items-center justify-between gap-2">
        <div className="flex min-w-0 items-center gap-2">
          <SportTag sport={pick.sport} />
          {marketLabel ? (
            <span className="text-muted-foreground truncate text-xs">
              {marketLabel}
            </span>
          ) : null}
        </div>
        <div className="flex shrink-0 items-center gap-1.5">
          <VerifiedBadge tier={pick.verificationTier} />
          <StatusBadge status={pick.status} />
        </div>
      </div>

      <div className="mt-2 flex min-w-0 items-center gap-2">
        {team ? <TeamMark team={team} size="sm" /> : null}
        <div className="flex min-w-0 flex-1 items-baseline gap-2">
          <span className="scl-display truncate text-base font-semibold">
            {pick.selection}
          </span>
          <StatValue tone="data" className="shrink-0 text-sm font-semibold">
            {formatOdds(pick.oddsAmerican)}
          </StatValue>
        </div>
      </div>

      <div className="border-border mt-2 flex min-h-11 items-center justify-between gap-3 border-t pt-2">
        <Link
          href={`/cappers/${pick.capper.handle}`}
          className="focus-visible:ring-ring flex min-h-11 min-w-0 items-center gap-2 rounded-lg outline-none hover:underline focus-visible:ring-2"
        >
          <CapperAvatar
            name={pick.capper.name}
            src={pick.capper.avatarUrl}
            size="sm"
          />
          <div className="min-w-0">
            <CapperIdentityLabel
              capper={pick.capper}
              compact
              primaryClassName="text-sm"
            />
            {building ? (
              <span className="text-muted-foreground inline-flex min-h-10 items-center gap-1.5 text-xs font-medium">
                <RankBadge rank={0} className="size-7" />
                <span className="min-w-0 truncate leading-snug">
                  {BUILDING_RECORD_LABEL}
                </span>
              </span>
            ) : (
              <StatValue tone="label" className="text-xs">
                {timeAgo(pick.postedAt)}
              </StatValue>
            )}
          </div>
        </Link>

        <div className="shrink-0 text-right">
          {hasResult ? (
            <>
              <span className="text-muted-foreground block text-[0.7rem] font-semibold uppercase">
                Result
              </span>
              <StatValue
                tone={
                  signTone(pick.profitUnits ?? 0) === "pos" ? "win" : "loss"
                }
                className="text-sm font-bold"
              >
                {formatUnits(pick.profitUnits ?? 0)}
              </StatValue>
            </>
          ) : (
            <>
              <span className="text-muted-foreground block text-[0.7rem] font-semibold uppercase">
                Stake
              </span>
              <StatValue tone="text" className="text-sm font-bold">
                {formatUnits(pick.units, true, false)}
              </StatValue>
            </>
          )}
        </div>
      </div>
    </Card>
  );
}
