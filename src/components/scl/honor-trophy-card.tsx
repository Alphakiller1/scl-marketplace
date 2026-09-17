import Link from "next/link";

import { ALL_SPORTS, type HonorAward } from "@/lib/honors";
import { formatRoi, formatUnits } from "@/lib/format";
import { CROSS_SPORTS } from "@/lib/parlay-sport";
import { cn } from "@/lib/utils";
import { CapperAvatar } from "@/components/scl/capper-avatar";
import { HonorGlyph } from "@/components/scl/honor-icons";

function headerLines(award: HonorAward): [string, string] {
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

/** Plaque on the trophy base: `2025 / COTY`, `NFL25 / UNITS`, `AUG26 / ROI`. */
function plaqueLines(award: HonorAward): [string, string] {
  if (award.period === "annual") {
    return [award.periodKey, award.metric === "units" ? "COTY" : "ROI"];
  }
  return [
    award.abbreviation.split(" ")[0]!,
    award.metric === "units" ? "Units" : "ROI",
  ];
}

function footerLabel(award: HonorAward): string {
  if (award.period === "annual") return `${award.periodKey} Annual`;
  if (award.period === "season") return `${award.periodKey} Season`;
  return award.periodLabel;
}

/**
 * Trophy graphic for one award: title, sport trophy on a plaque, the winner,
 * the winning figure, and the period. Always links somewhere useful — the
 * capper's profile on boards, the shareable graphic in a Trophy Case.
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
  const [plaqueTop, plaqueBottom] = plaqueLines(award);
  const units = award.metric === "units";
  const value = units
    ? formatUnits(award.winner.units).replace(/U$/, "")
    : formatRoi(award.winner.roi);
  const small = size === "sm";
  return (
    <Link
      href={href}
      prefetch={false}
      aria-label={`${award.name}: @${award.winner.handle}, ${units ? formatUnits(award.winner.units) : formatRoi(award.winner.roi)}`}
      className={cn(
        "group focus-visible:ring-ring flex shrink-0 snap-start flex-col overflow-hidden rounded-xl border border-[color:var(--scl-honor-gold-deep)] bg-[color:var(--scl-honor-ink)] text-center text-[color:var(--scl-honor-text)] shadow-lg transition-transform focus-visible:ring-2 focus-visible:outline-none motion-safe:hover:-translate-y-0.5",
        small ? "w-36" : "w-40 sm:w-44",
      )}
    >
      <span className="block bg-gradient-to-b from-[color:var(--scl-honor-ink-raised)] to-transparent px-2 pt-2.5">
        <span className="scl-display block text-sm leading-none font-bold tracking-wide text-[color:var(--scl-honor-gold-bright)] uppercase">
          {top}
        </span>
        <span className="scl-display mt-0.5 block text-[0.7rem] leading-tight font-semibold tracking-wide uppercase">
          {bottom}
        </span>
      </span>

      <span
        className={cn(
          "relative mx-auto flex flex-col items-center",
          small ? "mt-2" : "mt-3",
        )}
        aria-hidden
      >
        <span
          className={cn(
            "flex items-center justify-center rounded-full bg-[radial-gradient(circle_at_35%_30%,var(--scl-honor-gold-bright),var(--scl-honor-gold)_45%,var(--scl-honor-gold-deep))] shadow-[0_0_24px_-4px_var(--scl-honor-gold)]",
            small ? "size-14" : "size-16 sm:size-[4.5rem]",
          )}
        >
          <HonorGlyph
            award={award}
            className={cn(
              "drop-shadow",
              small ? "text-[1.7rem]" : "text-[2rem] sm:text-[2.2rem]",
            )}
          />
        </span>
        <span className="h-2 w-3 bg-[color:var(--scl-honor-gold-deep)]" />
        <span className="rounded-sm bg-gradient-to-b from-[color:var(--scl-honor-gold-bright)] to-[color:var(--scl-honor-gold)] px-2 py-0.5 text-[0.6rem] leading-tight font-extrabold tracking-wide text-[color:var(--scl-honor-plaque-text)] uppercase">
          <span className="block">{plaqueTop}</span>
          <span className="block">{plaqueBottom}</span>
        </span>
        <span className="h-1.5 w-16 rounded-b-sm bg-[color:var(--scl-honor-gold-deep)]" />
      </span>

      <span className="mt-2 flex min-w-0 items-center justify-center gap-1.5 px-2">
        <CapperAvatar
          name={award.winner.name}
          src={award.winner.avatarUrl}
          size="sm"
        />
        <span className="min-w-0 truncate text-xs font-bold group-hover:underline">
          {award.winner.handle}
        </span>
      </span>

      <span className="mx-2 mt-2 rounded-md border border-[color:var(--scl-honor-gold-deep)] px-1 py-1">
        <span className="scl-data block text-lg leading-none font-extrabold text-[color:var(--scl-honor-gold-bright)] tabular-nums">
          {value}
        </span>
        <span className="block text-[0.55rem] font-bold tracking-widest uppercase">
          {units ? "Net units" : "ROI"}
        </span>
      </span>

      <span className="mt-2.5 block bg-gradient-to-b from-[color:var(--scl-honor-gold)] to-[color:var(--scl-honor-gold-deep)] py-1 text-[0.6rem] font-extrabold tracking-wide text-[color:var(--scl-honor-plaque-text)] uppercase">
        {footerLabel(award)}
      </span>
    </Link>
  );
}
