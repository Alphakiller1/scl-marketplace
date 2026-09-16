import type { HonorAward } from "@/lib/honors";
import { HonorScroller } from "@/components/scl/honor-scroller";
import { HonorTrophyCard } from "@/components/scl/honor-trophy-card";

/**
 * Every award the capper has won, left to right by date earned. Each opens the
 * award's 4:5 social graphic.
 */
export function TrophyCase({ awards }: { awards: HonorAward[] }) {
  if (!awards.length) return null;
  const ordered = [...awards].sort(
    (a, b) =>
      a.periodEnd.localeCompare(b.periodEnd) || a.name.localeCompare(b.name),
  );
  return (
    <section
      id="trophy-case"
      className="border-border bg-card mb-4 scroll-mt-24 rounded-[14px] border p-3 sm:mb-5 sm:p-4"
      aria-labelledby="trophy-case-title"
    >
      <div className="mb-3 flex items-end justify-between gap-3">
        <div>
          <p className="scl-eyebrow">SCL Honors</p>
          <h2 id="trophy-case-title" className="scl-display text-xl font-bold">
            Trophy Case
          </h2>
        </div>
        <span className="text-muted-foreground text-xs tabular-nums">
          {awards.length} earned
        </span>
      </div>
      <HonorScroller label={`Trophy Case, ${awards.length} awards`}>
        {ordered.map((award) => (
          <HonorTrophyCard
            key={award.id}
            award={award}
            size="sm"
            href={`/honors/${award.id}`}
          />
        ))}
      </HonorScroller>
    </section>
  );
}
