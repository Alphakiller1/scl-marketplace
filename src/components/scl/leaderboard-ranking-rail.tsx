import Link from "next/link";
import { Info } from "lucide-react";

import {
  HOW_RANKING_WORKS_BULLETS,
  HOW_RANKING_WORKS_TITLE,
} from "@/lib/cold-start-copy";
import { etYmd } from "@/lib/et-day";
import { cn } from "@/lib/utils";
import { HonorGlyph } from "@/components/scl/honor-icons";

/** Rank-mode right rail — how ranking works, sample colors, Honors legend. */
function RankingExplainer() {
  return (
    <aside
      className="border-border scl-elevated relative space-y-3 overflow-hidden rounded-[14px] border p-3 pl-4"
      aria-label={HOW_RANKING_WORKS_TITLE}
    >
      <div className="scl-live-rail" aria-hidden />
      <div className="space-y-1.5">
        <div className="flex items-center gap-1.5">
          <Info
            className="size-3.5 shrink-0 text-[color:var(--scl-blue)]"
            aria-hidden
          />
          <h2 className="scl-display text-sm font-bold tracking-[0.04em]">
            {HOW_RANKING_WORKS_TITLE}
          </h2>
        </div>
        <ul className="text-muted-foreground list-disc space-y-1.5 pl-3.5 text-xs leading-snug">
          {HOW_RANKING_WORKS_BULLETS.map((bullet) => (
            <li key={bullet}>{bullet}</li>
          ))}
        </ul>
      </div>

      <div className="border-border space-y-1 border-t pt-3">
        <p className="scl-eyebrow text-[color:var(--scl-muted-label)]">
          Sample
        </p>
        <ul className="space-y-0.5 text-xs leading-snug">
          <li className="text-[color:var(--scl-perf-strong-text)]">
            Established 50+
          </li>
          <li className="text-[color:var(--scl-perf-mid-text)]">
            Developing 10–49
          </li>
          <li className="text-muted-foreground">Early 0–9</li>
        </ul>
      </div>
    </aside>
  );
}

const LEGEND_SAMPLE = {
  season: { sport: "NFL", sportLabel: "NFL", metric: "units" },
  supermax: { sport: "SUPERMAX", sportLabel: "Supermax", metric: "units" },
  annualUnits: { sport: "ALL", sportLabel: "All Sports", metric: "units" },
  annualRoi: { sport: "ALL", sportLabel: "All Sports", metric: "roi" },
} as const;

/** Honors legend, as a separate rail card under How ranking works. */
function HonorsLegend({ className }: { className?: string }) {
  const year = Number(etYmd(new Date()).slice(0, 4)) - 1;
  const rows = [
    {
      glyph: LEGEND_SAMPLE.annualUnits,
      chip: `${year} COTY`,
      meaning: "SCL Capper of the Year",
    },
    {
      glyph: LEGEND_SAMPLE.annualRoi,
      chip: `${year} ROI`,
      meaning: "SCL Annual Performance Award",
    },
    {
      glyph: LEGEND_SAMPLE.season,
      chip: "AUG26 ($/%)",
      meaning: "Monthly Winner (Units or ROI)",
    },
    {
      glyph: LEGEND_SAMPLE.season,
      chip: "NFL26 ($/%)",
      meaning: "Season Champion (Units or ROI)",
    },
    {
      glyph: LEGEND_SAMPLE.supermax,
      chip: `SEP26 / MAX${String(year).slice(-2)}`,
      meaning: "Supermax All-Star (month) / Champion (year)",
    },
  ];
  return (
    <aside
      className={cn(
        "border-border scl-elevated relative space-y-2 overflow-hidden rounded-[14px] border p-3 pl-4",
        className,
      )}
      aria-labelledby="honors-legend-title"
    >
      <div className="scl-live-rail" aria-hidden />
      <h2
        id="honors-legend-title"
        className="scl-eyebrow text-[color:var(--scl-muted-label)]"
      >
        Honors legend
      </h2>
      <ul className="space-y-1.5 text-xs leading-snug">
        {rows.map((row) => (
          <li key={row.chip} className="flex items-start gap-1.5">
            <HonorGlyph award={row.glyph} className="mt-px text-sm" />
            <span>
              <span className="block font-bold text-[color:var(--scl-pink-text)]">
                {row.chip}
              </span>
              <span className="text-muted-foreground block">{row.meaning}</span>
            </span>
          </li>
        ))}
      </ul>
      <p className="text-muted-foreground text-xs leading-snug">
        The award mark shows the sport: a helmet is NCAAF, a hoop is NCAAB.
      </p>
      <Link href="/honors" className="scl-link text-xs font-semibold">
        Rules & all honors
      </Link>
    </aside>
  );
}

/** Rank-mode right rail: how ranking works, then the Honors legend. */
export function LeaderboardRankingRail({ className }: { className?: string }) {
  return (
    <div className={cn("space-y-3", className)}>
      <RankingExplainer />
      <HonorsLegend />
    </div>
  );
}
