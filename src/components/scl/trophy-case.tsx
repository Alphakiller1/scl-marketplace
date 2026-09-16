import type { HonorAward } from "@/lib/honors";
import { HonorCard } from "@/components/scl/honor-card";

/** Every award the capper has won, newest period first. Sits under the header. */
export function TrophyCase({ awards }: { awards: HonorAward[] }) {
  if (!awards.length) return null;
  return (
    <section
      className="border-border bg-card mb-4 rounded-[14px] border p-3 sm:mb-5 sm:p-4"
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
      <ul className="flex flex-wrap gap-2">
        {awards.map((award) => (
          <li key={award.id} className="w-full min-w-0 sm:w-auto">
            <HonorCard award={award} compact />
          </li>
        ))}
      </ul>
    </section>
  );
}
