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

/** Today's-pick card — the active, valuable surface of the product. */
export function PickCard({ pick }: { pick: TodayPick }) {
  return (
    <Card className="gap-0 p-4">
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <SportTag sport={pick.sport} />
          <span className="text-muted-foreground text-xs">{pick.gameTime}</span>
        </div>
        <StatusBadge status={pick.status} />
      </div>

      <div className="mt-3">
        <div className="text-muted-foreground text-sm">{pick.event}</div>
        <div className="mt-0.5 flex items-baseline gap-2">
          <span className="text-lg font-semibold tracking-tight">
            {pick.selection}
          </span>
          <span className="nums text-muted-foreground text-sm font-semibold tabular-nums">
            {formatOdds(pick.oddsAmerican)}
          </span>
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
          className="flex items-center gap-2 hover:underline"
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
