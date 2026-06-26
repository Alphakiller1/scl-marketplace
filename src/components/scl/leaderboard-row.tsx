import Link from "next/link";

import { cn } from "@/lib/utils";
import type { CapperSummary } from "@/lib/mock";
import { formatRecord, formatRoi, formatUnits, signTone } from "@/lib/format";
import { CapperAvatar } from "@/components/scl/capper-avatar";
import { VerificationBadge, SportTag } from "@/components/scl/badges";
import {
  RankMovementIndicator,
  RecentFormStrip,
} from "@/components/scl/indicators";

const toneText = { pos: "text-pos", neg: "text-neg", muted: "text-foreground" };

/** Desktop leaderboard row — competitive, not administrative. */
export function LeaderboardRow({ capper }: { capper: CapperSummary }) {
  return (
    <Link
      href={`/cappers/${capper.handle}`}
      className="group hover:border-border hover:bg-surface-2 grid grid-cols-[2.5rem_1fr_5rem_5rem_5rem_8rem] items-center gap-3 rounded-xl border border-transparent px-3 py-2.5 transition-colors"
    >
      <div className="flex items-center gap-1">
        <span className="nums w-5 text-right text-base font-bold tabular-nums">
          {capper.rank}
        </span>
        <RankMovementIndicator delta={capper.rankDelta} />
      </div>

      <div className="flex min-w-0 items-center gap-3">
        <CapperAvatar name={capper.name} src={capper.avatarUrl} size="sm" />
        <div className="min-w-0">
          <div className="flex items-center gap-1">
            <span className="truncate font-semibold">{capper.name}</span>
            {capper.verified ? <VerificationBadge size="xs" /> : null}
          </div>
          <div className="flex items-center gap-1.5">
            <SportTag sport={capper.topSport} />
            <span className="nums text-muted-foreground text-xs tabular-nums">
              {formatRecord(capper.record.w, capper.record.l, capper.record.p)}
            </span>
          </div>
        </div>
      </div>

      <span className="nums text-right font-semibold tabular-nums">
        {capper.winPct.toFixed(1)}%
      </span>
      <span
        className={cn(
          "nums text-right font-semibold tabular-nums",
          toneText[signTone(capper.units)],
        )}
      >
        {formatUnits(capper.units)}
      </span>
      <span
        className={cn(
          "nums text-right font-semibold tabular-nums",
          toneText[signTone(capper.roi)],
        )}
      >
        {formatRoi(capper.roi)}
      </span>
      <div className="flex justify-end">
        <RecentFormStrip form={capper.recentForm} />
      </div>
    </Link>
  );
}

/** Mobile leaderboard card — never a compressed table. */
export function LeaderboardMobileCard({ capper }: { capper: CapperSummary }) {
  return (
    <Link
      href={`/cappers/${capper.handle}`}
      className="border-border bg-card active:bg-surface-2 flex flex-col gap-3 rounded-xl border p-3"
    >
      <div className="flex items-center gap-3">
        <div className="flex items-center gap-1">
          <span className="nums w-6 text-center text-lg font-bold tabular-nums">
            {capper.rank}
          </span>
          <RankMovementIndicator delta={capper.rankDelta} />
        </div>
        <CapperAvatar name={capper.name} src={capper.avatarUrl} size="md" />
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-1">
            <span className="truncate font-semibold">{capper.name}</span>
            {capper.verified ? <VerificationBadge size="xs" /> : null}
          </div>
          <SportTag sport={capper.topSport} />
        </div>
      </div>
      <div className="border-border grid grid-cols-4 gap-2 border-t pt-3">
        <MobileStat label="Win" value={`${capper.winPct.toFixed(1)}%`} />
        <MobileStat
          label="Units"
          value={formatUnits(capper.units)}
          tone={signTone(capper.units)}
        />
        <MobileStat
          label="ROI"
          value={formatRoi(capper.roi)}
          tone={signTone(capper.roi)}
        />
        <div className="flex flex-col items-center gap-1">
          <RecentFormStrip form={capper.recentForm.slice(-4)} />
          <span className="text-muted-foreground text-[0.7rem] font-medium tracking-wide uppercase">
            Form
          </span>
        </div>
      </div>
    </Link>
  );
}

function MobileStat({
  label,
  value,
  tone = "muted",
}: {
  label: string;
  value: string;
  tone?: "pos" | "neg" | "muted";
}) {
  return (
    <div className="flex flex-col items-center">
      <span className={cn("nums font-semibold tabular-nums", toneText[tone])}>
        {value}
      </span>
      <span className="text-muted-foreground text-[0.7rem] font-medium tracking-wide uppercase">
        {label}
      </span>
    </div>
  );
}
