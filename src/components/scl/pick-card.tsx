import Link from "next/link";

import { Card } from "@/components/ui/card";
import type { TodayPick } from "@/lib/mock";
import { formatOdds, formatRecord, formatUnits, timeAgo } from "@/lib/format";
import { CapperAvatar } from "@/components/scl/capper-avatar";
import {
  VerificationBadge,
  SportTag,
  StatusBadge,
} from "@/components/scl/badges";
import { TeamMarkFromText } from "@/components/scl/team-mark";

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

  return (
    <Card className="gap-0 p-3.5 sm:p-4">
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <SportTag sport={pick.sport} />
          <span className="text-muted-foreground text-xs">{pick.gameTime}</span>
        </div>
        <StatusBadge status={pick.status} />
      </div>

      <div className="mt-3 flex items-center gap-3">
        <TeamMarkFromText
          text={pick.selection}
          sport={pick.sport}
          className="size-10"
        />
        <div className="min-w-0">
          <div className="text-muted-foreground text-sm">{pick.event}</div>
          <div className="mt-0.5 flex items-baseline gap-2">
            <span className="truncate text-lg font-semibold tracking-tight">
              {pick.selection}
            </span>
            <span className="nums text-muted-foreground shrink-0 text-sm font-semibold tabular-nums">
              {formatOdds(pick.oddsAmerican)}
            </span>
          </div>
        </div>
      </div>

      <div className="bg-surface-2 mt-3 flex items-center gap-2 rounded-lg px-2.5 py-1.5">
        <span className="text-muted-foreground text-xs font-medium">Stake</span>
        <span className="nums text-brand font-semibold tabular-nums">
          {formatUnits(pick.units, true, false)}
        </span>
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
          <div className="leading-tight">
            <div className="flex items-center gap-1 text-sm font-semibold">
              <span>{pick.capper.name}</span>
              {pick.capper.verified ? <VerificationBadge size="xs" /> : null}
            </div>
            <span className="nums text-muted-foreground text-xs tabular-nums">
              {formatRecord(
                pick.capperRecord.w,
                pick.capperRecord.l,
                pick.capperRecord.p,
              )}
            </span>
          </div>
        </Link>
        <span className="text-muted-foreground text-xs">
          {timeAgo(pick.postedAt)}
        </span>
      </div>
    </Card>
  );
}

function CompactPickCard({ pick }: { pick: TodayPick }) {
  return (
    <Card className="gap-0 p-3">
      <div className="flex min-w-0 items-center justify-between gap-2">
        <div className="flex min-w-0 items-center gap-2">
          <SportTag sport={pick.sport} />
          <span className="text-muted-foreground truncate text-xs">
            {pick.event}
          </span>
        </div>
        <StatusBadge status={pick.status} className="shrink-0" />
      </div>

      <div className="mt-2 flex min-w-0 items-center gap-2">
        <TeamMarkFromText
          text={pick.selection}
          sport={pick.sport}
          className="size-7"
        />
        <span className="truncate text-base font-semibold">
          {pick.selection}
        </span>
        <span className="nums text-muted-foreground shrink-0 text-sm font-semibold tabular-nums">
          {formatOdds(pick.oddsAmerican)}
        </span>
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
          <div className="min-w-0 leading-tight">
            <div className="flex min-w-0 items-center gap-1 text-sm font-semibold">
              <span className="truncate">{pick.capper.name}</span>
              {pick.capper.verified ? <VerificationBadge size="xs" /> : null}
            </div>
            <span className="text-muted-foreground text-xs">
              {timeAgo(pick.postedAt)}
            </span>
          </div>
        </Link>

        <div className="shrink-0 text-right">
          <span className="text-muted-foreground block text-[0.7rem] font-semibold uppercase">
            Stake
          </span>
          <span className="nums text-brand text-sm font-bold tabular-nums">
            {formatUnits(pick.units, true, false)}
          </span>
        </div>
      </div>
    </Card>
  );
}
