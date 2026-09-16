import Link from "next/link";
import { Award, Link2 } from "lucide-react";

import { ALL_SPORTS, type HonorAward } from "@/lib/honors";
import { formatRoi, formatUnits } from "@/lib/format";
import { CROSS_SPORTS } from "@/lib/parlay-sport";
import { cn } from "@/lib/utils";
import { CapperAvatar } from "@/components/scl/capper-avatar";
import { LeagueMark } from "@/components/scl/league-mark";

function honorResult(award: HonorAward) {
  return award.metric === "units"
    ? formatUnits(award.winner.units)
    : formatRoi(award.winner.roi);
}

/**
 * The award's sport, so a Season or Monthly award says which league it
 * belongs to. All-sports awards use the Honors mark; Cross-Sports uses a link.
 */
export function HonorMark({
  award,
  size = "sm",
  className,
}: {
  award: Pick<HonorAward, "sport" | "sportLabel">;
  size?: "sm" | "md" | "lg";
  className?: string;
}) {
  const icon = size === "lg" ? "size-10" : size === "md" ? "size-6" : "size-4";
  return (
    <span
      className={cn(
        "inline-flex shrink-0 items-center justify-center",
        className,
      )}
      title={award.sportLabel}
    >
      {award.sport === ALL_SPORTS ? (
        <Award className={cn(icon, "text-foreground")} aria-hidden />
      ) : award.sport === CROSS_SPORTS ? (
        <Link2 className={cn(icon, "text-foreground")} aria-hidden />
      ) : (
        <LeagueMark leagueKey={award.sport} size={size} />
      )}
      <span className="sr-only">{award.sportLabel}</span>
    </span>
  );
}

function profileHref(award: HonorAward) {
  return `/cappers/${award.winner.handle}`;
}

/** Full-width list row: award name gets its own line so it never truncates. */
export function HonorRow({ award }: { award: HonorAward }) {
  return (
    <Link
      href={profileHref(award)}
      prefetch={false}
      className="hover:bg-surface-2 focus-visible:ring-ring flex min-w-0 items-center gap-2.5 px-3 py-2.5 transition-colors focus-visible:ring-2 focus-visible:outline-none focus-visible:ring-inset"
    >
      <HonorMark award={award} className="w-6" />
      <CapperAvatar
        name={award.winner.name}
        src={award.winner.avatarUrl}
        size="sm"
      />
      <span className="min-w-0 flex-1">
        <span className="block truncate text-xs font-semibold">
          {award.name}
        </span>
        <span className="text-muted-foreground block truncate text-xs">
          @{award.winner.handle}
        </span>
      </span>
      <span className="scl-data text-pos shrink-0 text-sm font-bold tabular-nums">
        {honorResult(award)}
      </span>
    </Link>
  );
}

export function HonorCard({
  award,
  compact = false,
}: {
  award: HonorAward;
  compact?: boolean;
}) {
  return (
    <Link
      href={`/honors/${award.id}`}
      prefetch={false}
      title={award.name}
      className="border-border bg-card hover:bg-surface-2 focus-visible:ring-ring flex w-full min-w-0 items-center gap-3 rounded-xl border p-3 transition-colors focus-visible:ring-2 focus-visible:outline-none sm:w-auto sm:min-w-[16rem]"
    >
      <HonorMark award={award} size="md" />
      <span className="min-w-0 flex-1">
        <span className="block text-sm leading-snug font-bold">
          {award.name}
        </span>
        <span className="text-muted-foreground scl-data block text-xs tabular-nums">
          {honorResult(award)}
          {compact ? null : ` · ${award.winner.settled} picks`}
        </span>
      </span>
    </Link>
  );
}

/** Dense leaderboard chip: sport mark + period abbreviation. */
export function HonorChip({ award }: { award: HonorAward }) {
  return (
    <Link
      href={`/honors/${award.id}`}
      prefetch={false}
      title={award.name}
      aria-label={award.name}
      className="border-border bg-surface-2 hover:bg-surface-3 focus-visible:ring-ring inline-flex min-h-8 items-center gap-1 rounded-full border px-2 text-[0.65rem] font-bold whitespace-nowrap tabular-nums focus-visible:ring-2 focus-visible:outline-none"
    >
      <HonorMark award={award} />
      {award.abbreviation.replace(`${award.sport} `, "")}
    </Link>
  );
}

/** At most `max` chips; the rest collapse into a link to the Trophy Case. */
export function HonorChips({
  awards,
  handle,
  max = 3,
}: {
  awards: HonorAward[];
  handle: string;
  max?: number;
}) {
  const shown = awards.slice(0, max);
  const hidden = awards.length - shown.length;
  return (
    <div className="flex max-w-[15rem] flex-wrap items-center gap-1">
      {shown.map((award) => (
        <HonorChip key={award.id} award={award} />
      ))}
      {hidden > 0 ? (
        <Link
          href={`/cappers/${handle}#trophy-case-title`}
          prefetch={false}
          aria-label={`${hidden} more SCL Honors awards`}
          className="text-muted-foreground hover:text-foreground inline-flex min-h-8 items-center px-1 text-[0.65rem] font-bold tabular-nums"
        >
          +{hidden}
        </Link>
      ) : null}
    </div>
  );
}
