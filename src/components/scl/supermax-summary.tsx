import type { CapperStats } from "@/lib/stats";
import { formatRecord, formatRoi, formatUnits } from "@/lib/format";

export function SupermaxSummary({ stats }: { stats: CapperStats }) {
  return (
    <section
      className="border-border mt-6 border-t pt-6"
      aria-labelledby="supermax-title"
    >
      <div>
        <p className="scl-eyebrow">20u daily straight</p>
        <h2 id="supermax-title" className="scl-display text-xl font-bold">
          Supermax Record
        </h2>
      </div>
      <div className="mt-3 grid grid-cols-2 gap-2 sm:grid-cols-4">
        {[
          ["Record", formatRecord(stats.wins, stats.losses, stats.pushes)],
          ["Units", formatUnits(stats.units)],
          ["ROI", formatRoi(stats.roi)],
          ["Win%", `${stats.winPct.toFixed(1)}%`],
        ].map(([label, value]) => (
          <div
            key={label}
            className="border-border bg-card rounded-xl border p-3"
          >
            <p className="text-muted-foreground text-xs font-semibold uppercase">
              {label}
            </p>
            <p className="scl-data mt-1 text-lg font-bold tabular-nums">
              {value}
            </p>
          </div>
        ))}
      </div>
      <p className="text-muted-foreground mt-2 text-xs">
        These plays are a filtered view of the overall record and are not added
        a second time.
      </p>
    </section>
  );
}
