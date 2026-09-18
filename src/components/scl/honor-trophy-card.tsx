import Link from "next/link";

import { ALL_SPORTS, SUPERMAX, type HonorAward } from "@/lib/honors";
import { formatRoi, formatUnits } from "@/lib/format";
import { CROSS_SPORTS } from "@/lib/parlay-sport";
import { perfScale, perfToneClass } from "@/lib/perf-scale";
import { cn } from "@/lib/utils";
import { CapperAvatar } from "@/components/scl/capper-avatar";
import { HonorGlyph } from "@/components/scl/honor-icons";

function headerLines(award: HonorAward): [string, string] {
  if (award.sport === SUPERMAX) {
    return ["Supermax", award.period === "annual" ? "Champion" : "All-Star"];
  }
  if (award.sport === ALL_SPORTS) {
    return award.metric === "units"
      ? ["Capper", "of the Year"]
      : ["Annual", "Performance"];
  }
  if (award.sport === CROSS_SPORTS) return ["Cross Sport", "Parlay Allstar"];
  return [
    award.sportLabel,
    award.period === "season" ? "Season Champion" : "Monthly Champion",
  ];
}

/** Plaque under the medal: `2025 COTY`, `NFL25 Units`, `AUG26 ROI`. */
function plaque(award: HonorAward): string {
  if (award.sport === SUPERMAX) return award.abbreviation;
  if (award.period === "annual") {
    return `${award.periodKey} ${award.metric === "units" ? "COTY" : "ROI"}`;
  }
  return `${award.abbreviation.split(" ")[0]} ${award.metric === "units" ? "Units" : "ROI"}`;
}

function footerLabel(award: HonorAward): string {
  if (award.period === "annual") return `${award.periodKey} annual`;
  if (award.period === "season") return `${award.periodKey} season`;
  return award.periodLabel;
}

/**
 * Award graphic: title, a pink conviction medal carrying the award mark (the
 * spec's rank-medal treatment — never gold), the winner, the winning figure
 * on the performance ramp, and the period.
 */
export function HonorTrophyCard({
  award,
  href,
  size = "md",
}: {
  award: HonorAward;
  href: string;
  size?: "sm" | "md";
}) {
  const [top, bottom] = headerLines(award);
  const units = award.metric === "units";
  const result = units
    ? formatUnits(award.winner.units)
    : formatRoi(award.winner.roi);
  const tone = perfScale(
    units ? "units" : "roi",
    units ? award.winner.units : award.winner.roi,
    { gradedCount: award.winner.settled },
  ).tone;
  const small = size === "sm";
  return (
    <Link
      href={href}
      prefetch={false}
      aria-label={`${award.name}: @${award.winner.handle}, ${result}`}
      className={cn(
        "group border-border bg-card hover:border-foreground/30 focus-visible:ring-ring flex shrink-0 snap-start flex-col overflow-hidden rounded-[var(--scl-radius-card)] border text-center transition-colors focus-visible:ring-2 focus-visible:outline-none",
        small ? "w-36" : "w-40 sm:w-44",
      )}
    >
      <span className="block h-0.5 bg-[color:var(--scl-pink)]" aria-hidden />
      <span className="block px-2 pt-2.5">
        <span className="scl-display text-foreground block text-sm leading-none font-bold">
          {top}
        </span>
        <span className="text-muted-foreground mt-0.5 block text-[0.7rem] leading-tight font-semibold">
          {bottom}
        </span>
      </span>

      <span
        className={cn(
          "mx-auto flex flex-col items-center",
          small ? "mt-2" : "mt-3",
        )}
        aria-hidden
      >
        <span
          className={cn(
            "bg-surface-2 flex items-center justify-center rounded-full border-2 border-[color:var(--scl-pink)]",
            small ? "size-14" : "size-16 sm:size-[4.5rem]",
          )}
        >
          <HonorGlyph
            award={award}
            className={small ? "text-[1.7rem]" : "text-[2rem] sm:text-[2.2rem]"}
          />
        </span>
        <span className="scl-fill-brand -mt-2 rounded-[var(--scl-radius-receipt)] px-2 py-0.5 text-[0.6rem] leading-tight font-bold tracking-wide whitespace-nowrap uppercase">
          {plaque(award)}
        </span>
      </span>

      <span className="mt-2 flex min-w-0 items-center justify-center gap-1.5 px-2">
        <CapperAvatar
          name={award.winner.name}
          src={award.winner.avatarUrl}
          size="sm"
        />
        <span className="text-foreground min-w-0 truncate text-xs font-bold group-hover:underline">
          @{award.winner.handle}
        </span>
      </span>

      <span className="border-border bg-surface-2 mx-2 mt-2 rounded-lg border px-1 py-1">
        <span
          className={cn(
            "scl-data block text-lg leading-none font-bold tabular-nums",
            perfToneClass(tone),
          )}
        >
          {result}
        </span>
        <span className="text-muted-foreground block text-[0.6rem] font-semibold tracking-wide uppercase">
          {units ? "Net units" : "ROI"}
        </span>
      </span>

      <span className="border-border text-muted-foreground mt-2.5 block border-t py-1.5 text-[0.7rem] font-semibold">
        {footerLabel(award)}
      </span>
    </Link>
  );
}
