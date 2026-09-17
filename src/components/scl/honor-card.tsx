import Link from "next/link";

import type { HonorAward } from "@/lib/honors";
import { formatRoi, formatUnits } from "@/lib/format";
import { cn } from "@/lib/utils";
import { CapperAvatar } from "@/components/scl/capper-avatar";
import { HonorGlyph } from "@/components/scl/honor-icons";

function honorResult(award: HonorAward) {
  return award.metric === "units"
    ? formatUnits(award.winner.units)
    : formatRoi(award.winner.roi);
}

/** The award's mark from the Honors program (crown, trophy, or sport). */
export function HonorMark({
  award,
  size = "sm",
  className,
}: {
  award: Pick<HonorAward, "sport" | "sportLabel" | "metric">;
  size?: "sm" | "md" | "lg";
  className?: string;
}) {
  const text =
    size === "lg" ? "text-5xl" : size === "md" ? "text-2xl" : "text-base";
  return <HonorGlyph award={award} className={cn(text, className)} />;
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

/** Dense leaderboard chip: award mark + board abbreviation. */
export function HonorChip({ award }: { award: HonorAward }) {
  return (
    <Link
      href={`/honors/${award.id}`}
      prefetch={false}
      title={award.name}
      aria-label={award.name}
      className="focus-visible:ring-ring inline-flex min-h-7 items-center gap-1.5 rounded-md text-[0.7rem] font-bold whitespace-nowrap text-[color:var(--scl-pink-text)] tabular-nums hover:underline focus-visible:ring-2 focus-visible:outline-none"
    >
      <HonorGlyph award={award} className="text-sm" />
      {award.abbreviation}
    </Link>
  );
}

/** At most `max` chips; the rest collapse into a link to the Trophy Case. */
export function HonorChips({
  awards,
  handle,
  max = 2,
}: {
  awards: HonorAward[];
  handle: string;
  max?: number;
}) {
  const shown = awards.slice(0, max);
  const hidden = awards.length - shown.length;
  return (
    <div className="flex flex-col items-start">
      {shown.map((award) => (
        <HonorChip key={award.id} award={award} />
      ))}
      {hidden > 0 ? (
        <Link
          href={`/cappers/${handle}#trophy-case`}
          prefetch={false}
          aria-label={`${hidden} more SCL Honors awards`}
          className="text-muted-foreground hover:text-foreground inline-flex min-h-6 items-center text-[0.65rem] font-bold tabular-nums"
        >
          +{hidden} more
        </Link>
      ) : null}
    </div>
  );
}
