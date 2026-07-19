import { formatRecord, formatRoi, formatUnits } from "@/lib/format";

export type PublicRecordDisplay = {
  hasGradedRecord: boolean;
  record: string;
  roi: string;
  units: string;
  winPct: string;
};

/** Zero graded positions are absence of performance, not a 0% performance claim. */
export function publicRecordDisplay(input: {
  settledPicks?: number | null;
  record: { w: number; l: number; p: number };
  roi: number;
  units: number;
  winPct: number;
}): PublicRecordDisplay {
  const hasGradedRecord = (input.settledPicks ?? 0) > 0;
  if (!hasGradedRecord) {
    return {
      hasGradedRecord: false,
      record: "—",
      roi: "—",
      units: "—",
      winPct: "—",
    };
  }

  return {
    hasGradedRecord: true,
    record: formatRecord(input.record.w, input.record.l, input.record.p),
    roi: formatRoi(input.roi),
    units: formatUnits(input.units),
    winPct: `${input.winPct.toFixed(1)}%`,
  };
}
