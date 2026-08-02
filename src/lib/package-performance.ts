import type { PackageEvidence } from "@/lib/package-register";
import { isProvisional } from "@/lib/sample";

export type PackagePosition = {
  outcome: "PENDING" | "WIN" | "LOSS" | "PUSH" | "VOID";
  units: number;
  profitUnits: number | null;
};

/** Summarize only positions explicitly attributed to a package. */
export function summarizePackagePositions(
  positions: readonly PackagePosition[],
): PackageEvidence | null {
  const settled = positions.filter(
    (position) =>
      position.outcome === "WIN" ||
      position.outcome === "LOSS" ||
      position.outcome === "PUSH",
  );
  if (settled.length === 0) return null;

  const record = { w: 0, l: 0, p: 0 };
  let netUnits = 0;
  let stakedUnits = 0;
  for (const position of settled) {
    if (position.outcome === "WIN") record.w += 1;
    else if (position.outcome === "LOSS") record.l += 1;
    else record.p += 1;
    netUnits += position.profitUnits ?? 0;
    stakedUnits += position.units;
  }

  return {
    settledPicks: settled.length,
    record,
    roi: stakedUnits > 0 ? (netUnits / stakedUnits) * 100 : null,
    units: netUnits,
    verifiedShare: null,
    provisional: isProvisional(settled.length),
  };
}
