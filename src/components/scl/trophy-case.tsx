import type { HonorAward } from "@/lib/honors";
import { HonorCard } from "@/components/scl/honor-card";

export function TrophyCase({ awards }: { awards: HonorAward[] }) {
  if (!awards.length) return null;
  return (
    <section
      className="border-border mt-6 border-t pt-6"
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
      <div className="flex snap-x gap-3 overflow-x-auto pb-3" role="list">
        {awards.map((award) => (
          <div key={award.id} role="listitem" className="snap-start">
            <HonorCard award={award} compact />
          </div>
        ))}
      </div>
    </section>
  );
}
