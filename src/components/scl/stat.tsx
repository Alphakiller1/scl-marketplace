import { cn } from "@/lib/utils";
import { formatRecord, formatRoi, formatUnits } from "@/lib/format";
import { perfScale, perfToneClass, type PerfTone } from "@/lib/perf-scale";

type Tone = "pos" | "neg" | "muted" | "pink" | "brand" | "live" | "default";

const toneText: Record<Tone, string> = {
  pos: "text-pos",
  neg: "text-neg",
  pink: "text-pink",
  brand: "text-brand",
  live: "text-live",
  muted: "text-muted-foreground",
  default: "text-foreground",
};

/**
 * StatBlock — the core stat presentation: big tabular value + small label.
 * The foundation for ROI / Units / Win% / Record across the product.
 */
export function StatBlock({
  label,
  value,
  tone = "default",
  sub,
  className,
  align = "start",
  valueClassName,
  "aria-label": ariaLabel,
}: {
  label: string;
  value: React.ReactNode;
  tone?: Tone;
  sub?: React.ReactNode;
  className?: string;
  align?: "start" | "center" | "end";
  /** Override value color (e.g. perf-scale amber). */
  valueClassName?: string;
  "aria-label"?: string;
}) {
  return (
    <div
      className={cn(
        "flex flex-col gap-0.5",
        align === "center" && "items-center text-center",
        align === "end" && "items-end text-right",
        className,
      )}
    >
      <span
        className={cn(
          "scl-data text-lg font-semibold tracking-tight tabular-nums sm:text-xl",
          valueClassName ?? toneText[tone],
        )}
        aria-label={ariaLabel}
      >
        {value}
      </span>
      <span className="text-muted-foreground text-[0.7rem] font-medium tracking-wide uppercase">
        {label}
      </span>
      {sub ? (
        <span className="text-muted-foreground text-xs">{sub}</span>
      ) : null}
    </div>
  );
}

/** Compact inline pill for a labeled stat (used in dense rows/cards). */
export function StatPill({
  label,
  value,
  tone = "default",
  className,
  valueClassName,
  "aria-label": ariaLabel,
}: {
  label?: string;
  value: React.ReactNode;
  tone?: Tone;
  className?: string;
  valueClassName?: string;
  "aria-label"?: string;
}) {
  return (
    <span
      className={cn(
        "scl-data bg-surface-2 inline-flex items-center gap-1 rounded-md px-2 py-0.5 text-sm font-semibold tabular-nums",
        valueClassName ?? toneText[tone],
        className,
      )}
      aria-label={ariaLabel}
    >
      {label ? (
        <span className="text-muted-foreground text-[0.7rem] font-medium uppercase">
          {label}
        </span>
      ) : null}
      {value}
    </span>
  );
}

function perfValueClass(tone: PerfTone): string {
  return perfToneClass(tone);
}

export function RoiStat({
  roi,
  gradedCount,
  variant = "block",
  className,
}: {
  roi: number;
  /** Graded sample size — provisional caps soft/weak at amber, never red. */
  gradedCount?: number | null;
  variant?: "block" | "pill";
  className?: string;
}) {
  const scale = perfScale("roi", roi, { gradedCount });
  const valueClass = perfValueClass(scale.tone);
  if (variant === "pill")
    return (
      <StatPill
        label="ROI"
        value={formatRoi(roi)}
        valueClassName={valueClass}
        aria-label={scale.ariaLabel}
        className={className}
      />
    );
  return (
    <StatBlock
      label="ROI"
      value={formatRoi(roi)}
      valueClassName={valueClass}
      aria-label={scale.ariaLabel}
      className={className}
    />
  );
}

export function UnitStat({
  units,
  gradedCount,
  variant = "block",
  className,
}: {
  units: number;
  gradedCount?: number | null;
  variant?: "block" | "pill";
  className?: string;
}) {
  const scale = perfScale("units", units, { gradedCount });
  const valueClass = perfValueClass(scale.tone);
  if (variant === "pill")
    return (
      <StatPill
        label="Units"
        value={formatUnits(units)}
        valueClassName={valueClass}
        aria-label={scale.ariaLabel}
        className={className}
      />
    );
  return (
    <StatBlock
      label="Units"
      value={formatUnits(units)}
      valueClassName={valueClass}
      aria-label={scale.ariaLabel}
      className={className}
    />
  );
}

export function WinRateStat({
  winPct,
  record,
  gradedCount,
  variant = "block",
  className,
}: {
  winPct: number;
  record?: { w: number; l: number; p: number };
  gradedCount?: number | null;
  variant?: "block" | "pill";
  className?: string;
}) {
  const scale = perfScale("winPct", winPct, { gradedCount });
  const valueClass = perfValueClass(scale.tone);
  const value = `${winPct.toFixed(1)}%`;
  if (variant === "pill")
    return (
      <StatPill
        label="Win"
        value={value}
        valueClassName={valueClass}
        aria-label={scale.ariaLabel}
        className={className}
      />
    );
  return (
    <StatBlock
      label="Win %"
      value={value}
      valueClassName={valueClass}
      aria-label={scale.ariaLabel}
      sub={record ? formatRecord(record.w, record.l, record.p) : undefined}
      className={className}
    />
  );
}

export function RecordStat({
  record,
  className,
}: {
  record: { w: number; l: number; p: number };
  className?: string;
}) {
  return (
    <StatBlock
      label="Record"
      value={formatRecord(record.w, record.l, record.p)}
      className={className}
    />
  );
}
