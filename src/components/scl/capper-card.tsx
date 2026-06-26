import Link from "next/link";

import { Card } from "@/components/ui/card";
import type { CapperSummary } from "@/lib/mock";
import { CapperAvatar } from "@/components/scl/capper-avatar";
import {
  VerificationBadge,
  SportTag,
  TrophyBadge,
} from "@/components/scl/badges";
import { RecentFormStrip, StreakChip } from "@/components/scl/indicators";
import { RoiStat, UnitStat, WinRateStat } from "@/components/scl/stat";

/** Discovery card — a capper's public résumé at a glance. */
export function CapperCard({ capper }: { capper: CapperSummary }) {
  return (
    <Card className="group hover:border-border-strong relative gap-0 overflow-hidden p-4 transition-colors">
      <div className="flex items-start gap-3">
        <div className="relative">
          <CapperAvatar name={capper.name} src={capper.avatarUrl} size="lg" />
          <span className="nums bg-brand text-brand-foreground absolute -top-1.5 -left-1.5 flex size-6 items-center justify-center rounded-full text-xs font-bold tabular-nums">
            {capper.rank}
          </span>
        </div>
        <div className="min-w-0 flex-1">
          <Link
            href={`/cappers/${capper.handle}`}
            className="flex items-center gap-1.5 font-semibold hover:underline"
          >
            <span className="truncate">{capper.name}</span>
            {capper.verified ? <VerificationBadge size="sm" /> : null}
          </Link>
          <div className="mt-1 flex flex-wrap items-center gap-1.5">
            <SportTag sport={capper.topSport} />
            <StreakChip streak={capper.streak} />
          </div>
        </div>
      </div>

      <div className="bg-surface-2 mt-4 grid grid-cols-3 gap-2 rounded-lg p-3">
        <WinRateStat
          winPct={capper.winPct}
          className="items-center text-center"
        />
        <UnitStat units={capper.units} className="items-center text-center" />
        <RoiStat roi={capper.roi} className="items-center text-center" />
      </div>

      <div className="mt-3 flex items-center justify-between">
        <RecentFormStrip form={capper.recentForm} />
        {capper.trophies[0] ? <TrophyBadge label={capper.trophies[0]} /> : null}
      </div>
    </Card>
  );
}
