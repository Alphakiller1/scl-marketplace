import { SportTag } from "@/components/scl/badges";
import { formatUnits, signTone } from "@/lib/format";
import type { SportStats } from "@/lib/stats";
import { cn } from "@/lib/utils";

const toneText = { pos: "text-pos", neg: "text-neg", muted: "text-foreground" };

/** Per-sport record / units / ROI breakdown for the capper dashboard. */
export function PerformanceBySport({ items }: { items: SportStats[] }) {
  if (!items.length) return null;

  return (
    <div className="border-border overflow-hidden rounded-xl border">
      <div className="border-border bg-surface-2 text-muted-foreground grid grid-cols-[minmax(0,1fr)_5rem_5rem_5rem] gap-3 border-b px-4 py-2 text-xs font-semibold uppercase">
        <span>Sport</span>
        <span className="text-right">Record</span>
        <span className="text-right">Units</span>
        <span className="text-right">ROI</span>
      </div>
      <div className="divide-border divide-y">
        {items.map((s) => (
          <div
            key={s.sport}
            className="bg-card grid grid-cols-[minmax(0,1fr)_5rem_5rem_5rem] items-center gap-3 px-4 py-2.5 text-sm"
          >
            <SportTag sport={s.sport} forceLabel />
            <span className="nums text-right tabular-nums">
              {s.wins}-{s.losses}
              {s.pushes ? `-${s.pushes}` : ""}
            </span>
            <span
              className={cn(
                "nums text-right font-semibold tabular-nums",
                toneText[signTone(s.units)],
              )}
            >
              {formatUnits(s.units)}
            </span>
            <span
              className={cn(
                "nums text-right tabular-nums",
                toneText[signTone(s.roi)],
              )}
            >
              {s.roi >= 0 ? "+" : ""}
              {s.roi.toFixed(1)}%
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}
