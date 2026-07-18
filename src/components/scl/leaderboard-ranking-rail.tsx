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
        "border-border bg-card space-y-5 rounded-[14px] border p-4",
        className,
      )}
      aria-label={HOW_RANKING_WORKS_TITLE}
    >
      <div className="space-y-2">
        <div className="flex items-center gap-2">
          <Info
            className="size-4 text-[color:var(--scl-muted-label)]"
            aria-hidden
          />
          <h2 className="scl-display text-base font-bold tracking-[0.04em]">
            {HOW_RANKING_WORKS_TITLE}
          </h2>
        </div>
        <ul className="text-muted-foreground list-disc space-y-2 pl-4 text-sm leading-relaxed">
          {HOW_RANKING_WORKS_BULLETS.map((bullet) => (
            <li key={bullet}>{bullet}</li>
          ))}
        </ul>
      </div>

      <div className="border-border space-y-1.5 border-t pt-4">
        <p className="scl-eyebrow text-muted-foreground">Sample maturity</p>
        <p className="text-muted-foreground text-sm leading-relaxed">
          {MATURITY_LEGEND}
        </p>
      </div>

      <div className="border-border space-y-1.5 border-t pt-4">
        <p className="scl-eyebrow flex items-center gap-1.5 text-[color:var(--scl-pink)]">
          <ShieldCheck className="size-3.5" aria-hidden />
          Verified share
        </p>
        <p className="text-muted-foreground text-sm leading-relaxed">
          {HOW_RANKING_VERIFIED_NOTE}
        </p>
      </div>
    </aside>
  );
}
