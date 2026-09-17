import Link from "next/link";
import { Award } from "lucide-react";

import type { HonorAward } from "@/lib/honors";
import { HonorScroller } from "@/components/scl/honor-scroller";
import { HonorTrophyCard } from "@/components/scl/honor-trophy-card";

/**
 * SCL Leaderboard Honors — the award winners currently on display, as a
 * scrolling row of trophy graphics. Each links to the winner's profile.
 */
export function HonorsShowcase({ awards }: { awards: HonorAward[] }) {
  return (
    <section
      className="min-w-0 space-y-3"
      aria-labelledby="leaderboard-honors-title"
      data-honor-count={awards.length}
    >
      <div className="flex flex-wrap items-end justify-between gap-x-4 gap-y-1">
        <div className="min-w-0">
          <p className="scl-eyebrow">The winning record</p>
          <h2
            id="leaderboard-honors-title"
            className="scl-display flex items-center gap-2 text-xl font-bold"
          >
            <Award className="text-foreground size-5" aria-hidden />
            SCL Leaderboard Honors
          </h2>
        </div>
        <Link
          className="scl-link min-h-10 py-2 text-sm font-semibold"
          href="/honors"
        >
          Rules & all honors
        </Link>
      </div>
      {awards.length ? (
        <HonorScroller label="SCL Leaderboard Honors winners">
          {awards.map((award) => (
            <HonorTrophyCard
              key={award.id}
              award={award}
              href={`/cappers/${award.winner.handle}`}
            />
          ))}
        </HonorScroller>
      ) : (
        <p className="border-border text-muted-foreground rounded-xl border p-4 text-sm">
          No award winners are on display yet.
        </p>
      )}
    </section>
  );
}
