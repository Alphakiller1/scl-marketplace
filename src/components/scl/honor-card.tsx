import Link from "next/link";
import type { HonorAward } from "@/lib/honors";
import { formatRoi, formatUnits } from "@/lib/format";
import { CapperAvatar } from "@/components/scl/capper-avatar";

export function HonorCard({
  award,
  compact = false,
}: {
  award: HonorAward;
  compact?: boolean;
}) {
  const result =
    award.metric === "units"
      ? formatUnits(award.winner.units)
      : formatRoi(award.winner.roi);
  return (
    <Link
      href={`/honors/${award.id}`}
      title={award.name}
      className="border-border bg-card hover:bg-surface-2 focus-visible:ring-ring flex min-w-[17rem] items-center gap-3 rounded-xl border p-3 transition-colors focus-visible:ring-2 focus-visible:outline-none"
    >
      <span className="text-2xl" aria-hidden>
        {award.icon}
      </span>
      <CapperAvatar
        name={award.winner.name}
        src={award.winner.avatarUrl}
        size="sm"
      />
      <span className="min-w-0 flex-1">
        <span className="block truncate text-sm font-bold">{award.name}</span>
        <span className="text-muted-foreground block truncate text-xs">
          @{award.winner.handle} · {award.sport}
        </span>
      </span>
      {!compact ? (
        <span className="scl-data text-pos text-sm font-bold tabular-nums">
          {result}
        </span>
      ) : null}
    </Link>
  );
}
