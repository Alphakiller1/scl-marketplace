import { cn } from "@/lib/utils";
import { formatRecord, formatRoi, formatUnits, signTone } from "@/lib/format";

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
}: {
  label: string;
  value: React.ReactNode;
  tone?: Tone;
  sub?: React.ReactNode;
  className?: string;
  align?: "start" | "center" | "end";
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
          toneText[tone],
        )}
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
}: {
  label?: string;
  value: React.ReactNode;
  tone?: Tone;
  className?: string;
}) {
  return (
    <span
      className={cn(
        "scl-data bg-surface-2 inline-flex items-center gap-1 rounded-md px-2 py-0.5 text-sm font-semibold tabular-nums",
        toneText[tone],
        className,
      )}
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

export function RoiStat({
  roi,
  variant = "block",
  className,
}: {
  roi: number;
  variant?: "block" | "pill";
  className?: string;
}) {
  const tone = signTone(roi);
  if (variant === "pill")
    return (
      <StatPill
        label="ROI"
        value={formatRoi(roi)}
        tone={tone}
        className={className}
      />
    );
  return (
    <StatBlock
      label="ROI"
      value={formatRoi(roi)}
      tone={tone}
      className={className}
    />
  );
}

export function UnitStat({
  units,
  variant = "block",
  className,
}: {
  units: number;
  variant?: "block" | "pill";
  className?: string;
}) {
  const tone = signTone(units);
  if (variant === "pill")
    return (
      <StatPill
        label="Units"
        value={formatUnits(units)}
        tone={tone}
        className={className}
      />
    );
  return (
    <StatBlock
      label="Units"
      value={formatUnits(units)}
      tone={tone}
      className={className}
    />
  );
}

export function WinRateStat({
  winPct,
  record,
  variant = "block",
  className,
}: {
  winPct: number;
  record?: { w: number; l: number; p: number };
  variant?: "block" | "pill";
  className?: string;
}) {
  const value = `${winPct.toFixed(1)}%`;
  if (variant === "pill")
    return <StatPill label="Win" value={value} className={className} />;
  return (
    <StatBlock
      label="Win %"
      value={value}
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
