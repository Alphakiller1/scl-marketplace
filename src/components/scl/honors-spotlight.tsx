import Link from "next/link";
import { Award } from "lucide-react";
import type { HonorAward } from "@/lib/honors";
import { HonorCard } from "@/components/scl/honor-card";

export function HonorsSpotlight({ awards }: { awards: HonorAward[] }) {
  return (
    <section className="space-y-4" aria-labelledby="honors-spotlight-title">
      <div className="flex items-end justify-between gap-4">
        <div>
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
      {awards.length ? (
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
