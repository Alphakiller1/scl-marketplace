import Link from "next/link";
import { Award } from "lucide-react";
import type { HonorAward } from "@/lib/honors";
import { HonorCard, HonorRow } from "@/components/scl/honor-card";

export function HonorsSpotlight({
  awards,
  variant = "grid",
}: {
  awards: HonorAward[];
  /** "rail" = one row per award, for narrow columns such as the home hero. */
  variant?: "grid" | "rail";
}) {
  const rail = variant === "rail";
  return (
    <section
      className={rail ? "min-w-0 space-y-3" : "space-y-4"}
      aria-labelledby="honors-spotlight-title"
    >
      <div className="flex flex-wrap items-end justify-between gap-x-4 gap-y-1">
        <div className="min-w-0">
          <p className="scl-eyebrow">The winning record</p>
          <h2
            id="honors-spotlight-title"
            className="scl-display flex items-center gap-2 text-2xl font-bold"
          >
            <Award className="text-foreground size-6" aria-hidden />
            SCL Honors
          </h2>
          <p className="text-muted-foreground mt-1 text-sm">
            Current monthly, seasonal, and annual award leaders.
          </p>
        </div>
        <Link
          className="scl-link min-h-10 py-2 text-sm font-semibold"
          href="/honors"
        >
          Rules & all honors
        </Link>
      </div>
      {awards.length && rail ? (
        <ul className="divide-border border-border divide-y overflow-hidden rounded-xl border">
          {awards.map((award) => (
            <li key={award.id}>
              <HonorRow award={award} />
            </li>
          ))}
        </ul>
      ) : awards.length ? (
        <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
          {awards.map((award) => (
            <HonorCard key={award.id} award={award} />
          ))}
        </div>
      ) : (
        <div className="border-border bg-card text-muted-foreground rounded-xl border p-5 text-sm">
          No capper has met the current award minimums yet.
        </div>
      )}
    </section>
  );
}
