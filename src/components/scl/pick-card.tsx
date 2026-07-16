"use client";

import Link from "next/link";

import type { TodayPick } from "@/lib/mock";
import { formatOdds, formatRecord, formatUnits, timeAgo } from "@/lib/format";
import { CapperAvatar } from "@/components/scl/capper-avatar";
import { CapperIdentityLabel } from "@/components/scl/capper-identity-label";
import { StatValue } from "@/components/scl/stat-value";
import { BUILDING_RECORD_LABEL, RankBadge } from "@/components/scl/rank-badge";
import { Ticket, type TicketStatus } from "@/components/scl/ticket";
import { isBuildingARecord } from "@/lib/leaderboard";
import { americanToDecimal } from "@/lib/odds";
import { pickContextLabel } from "@/lib/pick-identity";
import { isVerifiedTier } from "@/lib/verification";

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

/** Today's-pick card — Ticket signature for every pick (verified + self-reported). */
export function PickCard({
  pick,
  compact = false,
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
      book={pick.book}
      status={ticketStatusFor(pick)}
      className={compact ? "rounded-[14px]" : undefined}
      footerAction={<CapperTicketFooter pick={pick} />}
      analysis={pick.notes}
    />
  );
}
