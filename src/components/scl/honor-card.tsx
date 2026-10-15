import Link from "next/link";

import type { HonorAward } from "@/lib/honors";
import { HonorGlyph } from "@/components/scl/honor-icons";

/** Dense leaderboard chip: award mark + board abbreviation. */
export function HonorChip({ award }: { award: HonorAward }) {
  return (
    <Link
      href={`/honors/${award.id}`}
      prefetch={false}
      title={award.name}
      aria-label={award.name}
      className="focus-visible:ring-ring inline-flex min-h-7 items-center gap-1.5 rounded-md text-[0.7rem] font-bold whitespace-nowrap text-[color:var(--scl-pink-text)] tabular-nums hover:underline focus-visible:ring-2 focus-visible:outline-none"
    >
      <HonorGlyph award={award} className="text-sm" />
      {award.abbreviation}
    </Link>
  );
}

/** At most `max` chips; the rest collapse into a link to the Trophy Case. */
export function HonorChips({
  awards,
  handle,
  max = 2,
}: {
  awards: HonorAward[];
  handle: string;
  max?: number;
}) {
  const shown = awards.slice(0, max);
  const hidden = awards.length - shown.length;
  return (
    <div className="flex flex-col items-start">
      {shown.map((award) => (
        <HonorChip key={award.id} award={award} />
      ))}
      {hidden > 0 ? (
        <Link
          href={`/cappers/${handle}#trophy-case`}
          prefetch={false}
          aria-label={`${hidden} more SCL Honors awards`}
          className="text-muted-foreground hover:text-foreground inline-flex min-h-6 items-center text-[0.65rem] font-bold tabular-nums"
        >
          +{hidden} more
        </Link>
      ) : null}
    </div>
  );
}
