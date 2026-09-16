import Link from "next/link";
import { Award, Info, Link2 } from "lucide-react";

import {
  HOW_RANKING_WORKS_BULLETS,
  HOW_RANKING_WORKS_TITLE,
} from "@/lib/cold-start-copy";
import { cn } from "@/lib/utils";

/** Rank-mode right rail — how ranking works, sample colors, Honors legend. */
export function LeaderboardRankingRail({ className }: { className?: string }) {
  return (
    <aside
      className={cn(
        "border-border scl-elevated relative space-y-3 overflow-hidden rounded-[14px] border p-3 pl-4",
        className,
      )}
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

      <div className="border-border space-y-1.5 border-t pt-3">
        <p className="scl-eyebrow text-[color:var(--scl-muted-label)]">
          SCL Honors legend
        </p>
        <ul className="text-muted-foreground space-y-1 text-xs leading-snug">
          <li className="flex items-start gap-1.5">
            <Award
              className="text-foreground mt-px size-3.5 shrink-0"
              aria-hidden
            />
            <span>
              <span className="text-foreground font-semibold">2025</span> Annual
              award, all sports
            </span>
          </li>
          <li>
            <span className="text-foreground font-semibold">
              Sport mark + year
            </span>{" "}
            Season award for that sport
          </li>
          <li>
            <span className="text-foreground font-semibold">
              Sport mark + AUG26
            </span>{" "}
            Monthly award for that sport
          </li>
          <li className="flex items-start gap-1.5">
            <Link2
              className="text-foreground mt-px size-3.5 shrink-0"
              aria-hidden
            />
            <span>Cross Sport Parlay Allstar</span>
          </li>
          <li>
            <span className="text-foreground font-semibold">($)</span> most net
            units · <span className="text-foreground font-semibold">(%)</span>{" "}
            highest ROI
          </li>
        </ul>
        <Link href="/honors" className="scl-link text-xs font-semibold">
          Rules & all honors
        </Link>
      </div>
    </aside>
  );
}
