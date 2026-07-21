import { Info, ShieldCheck } from "lucide-react";

import {
  HOW_RANKING_VERIFIED_NOTE,
  HOW_RANKING_WORKS_BULLETS,
  HOW_RANKING_WORKS_TITLE,
} from "@/lib/cold-start-copy";
import { MATURITY_LEGEND } from "@/lib/sample";
import { cn } from "@/lib/utils";

/** Rank-mode right rail — how ranking works + maturity + verified note. */
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
          Sample maturity
        </p>
        <p className="text-muted-foreground text-xs leading-snug">
          {MATURITY_LEGEND}
        </p>
      </div>

      <div className="border-border space-y-1 border-t pt-3">
        <p className="scl-eyebrow flex items-center gap-1 text-[color:var(--scl-muted-label)]">
          <ShieldCheck
            className="size-3 text-[color:var(--scl-pink)]"
            aria-hidden
          />
          Verified share
        </p>
        <p className="text-muted-foreground text-xs leading-snug">
          {HOW_RANKING_VERIFIED_NOTE}
        </p>
      </div>
    </aside>
  );
}
