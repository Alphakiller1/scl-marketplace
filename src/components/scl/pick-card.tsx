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
import { PickTierBadge, SportTag, StatusBadge } from "@/components/scl/badges";
import { BUILDING_RECORD_LABEL, RankBadge } from "@/components/scl/rank-badge";
import { TeamMark } from "@/components/scl/team-mark";
import { isBuildingARecord } from "@/lib/leaderboard";
import { teamIdentityFromSide } from "@/lib/pick-identity";
import { cn } from "@/lib/utils";

const toneText = {
  pos: "text-pos",
  neg: "text-neg",
  muted: "text-muted-foreground",
} as const;

function CapperStandingLine({ pick }: { pick: TodayPick }) {
  // Same min-sample gate as getLeaderboardResult() default partition (minPicks: 0).
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
    <span className="nums scl-data text-muted-foreground text-xs tabular-nums">
      {formatRecord(
        pick.capperRecord.w,
        pick.capperRecord.l,
        pick.capperRecord.p,
      )}
    </span>
  );
}

/** Today's-pick card — the active, valuable surface of the product. */
export function PickCard({
  pick,
  compact = false,
}: {
  pick: TodayPick;
  compact?: boolean;
}) {
  if (compact) {
    return <CompactPickCard pick={pick} />;
  }

  const team = teamIdentityFromSide(pick.side, pick.sport);
  const hasResult = pick.profitUnits != null;

  return (
    <Card className="gap-0 overflow-hidden p-3.5 sm:p-4">
      <div className="flex items-center justify-between gap-2">
        <div className="flex min-w-0 items-center gap-2">
          <SportTag sport={pick.sport} />
          {pick.event ? (
            <span className="text-muted-foreground truncate text-xs">
              {pick.event}
            </span>
          ) : null}
        </div>
        <div className="flex shrink-0 items-center gap-1.5">
          {pick.verificationTier ? (
            <PickTierBadge tier={pick.verificationTier} />
          ) : null}
          <StatusBadge status={pick.status} />
        </div>
      </div>

      <div className="mt-3 flex min-w-0 items-start gap-2.5">
        {team ? <TeamMark team={team} size="md" className="mt-0.5" /> : null}
        <div className="min-w-0 flex-1">
          <div className="flex min-w-0 flex-wrap items-baseline gap-x-2 gap-y-0.5">
            <span className="text-lg font-semibold tracking-tight break-words">
              {pick.selection}
            </span>
            <span className="nums scl-data text-muted-foreground text-sm font-semibold tabular-nums">
              {formatOdds(pick.oddsAmerican)}
            </span>
          </div>
        </div>
      </div>

      <div className="bg-surface-2 mt-3 flex items-center justify-between gap-2 rounded-lg px-2.5 py-1.5">
        <div className="flex min-w-0 items-center gap-2">
          <span className="text-muted-foreground text-xs font-medium">
            Stake
          </span>
          <span className="nums scl-data text-brand font-semibold tabular-nums">
            {formatUnits(pick.units, true, false)}
          </span>
        </div>
        {hasResult ? (
          <span
            className={cn(
              "nums scl-data shrink-0 text-sm font-bold tabular-nums",
              toneText[signTone(pick.profitUnits ?? 0)],
            )}
          >
            {formatUnits(pick.profitUnits ?? 0)}
          </span>
        ) : null}
      </div>

      <div className="border-border mt-3 flex items-center justify-between border-t pt-3">
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
        <span className="text-muted-foreground scl-data shrink-0 text-xs">
          {timeAgo(pick.postedAt)}
        </span>
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

  return (
    <Card className="gap-0 overflow-hidden p-3">
      <div className="flex min-w-0 items-center justify-between gap-2">
        <div className="flex min-w-0 items-center gap-2">
          <SportTag sport={pick.sport} />
          {pick.event ? (
            <span className="text-muted-foreground truncate text-xs">
              {pick.event}
            </span>
          ) : null}
        </div>
        <div className="flex shrink-0 items-center gap-1.5">
          {pick.verificationTier ? (
            <PickTierBadge tier={pick.verificationTier} />
          ) : null}
          <StatusBadge status={pick.status} />
        </div>
      </div>

      <div className="mt-2 flex min-w-0 items-center gap-2">
        {team ? <TeamMark team={team} size="sm" /> : null}
        <div className="flex min-w-0 flex-1 items-baseline gap-2">
          <span className="truncate text-base font-semibold">
            {pick.selection}
          </span>
          <span className="nums scl-data text-muted-foreground shrink-0 text-sm font-semibold tabular-nums">
            {formatOdds(pick.oddsAmerican)}
          </span>
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
              <span className="text-muted-foreground scl-data text-xs">
                {timeAgo(pick.postedAt)}
              </span>
            )}
          </div>
        </Link>

        <div className="shrink-0 text-right">
          {hasResult ? (
            <>
              <span className="text-muted-foreground block text-[0.7rem] font-semibold uppercase">
                Result
              </span>
              <span
                className={cn(
                  "nums scl-data text-sm font-bold tabular-nums",
                  toneText[signTone(pick.profitUnits ?? 0)],
                )}
              >
                {formatUnits(pick.profitUnits ?? 0)}
              </span>
            </>
          ) : (
            <>
              <span className="text-muted-foreground block text-[0.7rem] font-semibold uppercase">
                Stake
              </span>
              <span className="nums scl-data text-brand text-sm font-bold tabular-nums">
                {formatUnits(pick.units, true, false)}
              </span>
            </>
          )}
        </div>
      </div>
    </Card>
  );
}
