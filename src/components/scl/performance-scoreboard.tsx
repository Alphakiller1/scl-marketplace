import { ChartNoAxesCombined } from "lucide-react";

import { Card } from "@/components/ui/card";
import { PerformanceSparkline } from "@/components/scl/performance-sparkline";
import { StatBlock } from "@/components/scl/stat";
import { formatRecord, formatRoi, formatUnits, signTone } from "@/lib/format";

export function PerformanceScoreboard({
  record,
  winPct,
  units,
  roi,
  settled,
  pending,
  performanceTrend,
}: {
  record: { w: number; l: number; p: number };
  winPct: number;
  units: number;
  roi: number;
  settled: number;
  pending: number;
  performanceTrend?: number[];
}) {
  const hasDecisions = record.w + record.l > 0;

  return (
    <Card className="scl-card-gradient gap-0 overflow-hidden p-0">
      <div className="border-border flex min-h-12 items-center justify-between gap-4 border-b px-4">
        <div className="flex items-center gap-2">
          <ChartNoAxesCombined className="text-brand size-4" aria-hidden />
          <h2 className="text-sm font-semibold">Tracked performance</h2>
        </div>
        <span className="text-muted-foreground text-xs">
          <span className="nums text-foreground font-semibold tabular-nums">
            {settled.toLocaleString()}
          </span>{" "}
          graded ·{" "}
          <span className="nums text-foreground font-semibold tabular-nums">
            {pending.toLocaleString()}
          </span>{" "}
          pending
        </span>
      </div>
      <div className="grid gap-5 p-4 sm:grid-cols-[1fr_auto] sm:items-center">
        <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
          <StatBlock
            label="Record"
            value={formatRecord(record.w, record.l, record.p)}
          />
          <StatBlock
            label="Win %"
            value={hasDecisions ? `${winPct.toFixed(1)}%` : "—"}
          />
          <StatBlock
            label="Units"
            value={settled ? formatUnits(units) : "0"}
            tone={signTone(units)}
          />
          <StatBlock
            label="ROI"
            value={settled ? formatRoi(roi) : "—"}
            tone={signTone(roi)}
          />
        </div>
        <PerformanceSparkline
          points={performanceTrend}
          className="h-12 w-full sm:w-36"
          label="Your cumulative unit trend"
        />
      </div>
    </Card>
  );
}
