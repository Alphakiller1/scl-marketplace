"use client";

import { useId, useMemo, useRef, useState } from "react";

import { MIN_GRADED_FOR_SIGNAL, hasSignal } from "@/lib/sample";
import { cn } from "@/lib/utils";

const CHART_WIDTH = 1000;
const CHART_HEIGHT = 160;
const CHART_TOP = 14;
const CHART_BOTTOM = 16;
/**
 * Horizontal breathing room, in viewBox units.
 *
 * Without it the series runs into the rounded border and the end-of-book
 * marker is sliced in half by `overflow-hidden`.
 */
const CHART_SIDE = 12;
const GRID_STEPS = [0, 0.25, 0.5, 0.75, 1] as const;

export type CumulativePoint = {
  /** 1-based graded pick index (oldest → newest). */
  n: number;
  units: number;
};

/**
 * Polarity of the closing balance.
 *
 * The design contract puts units magnitude on the shared `perf-*` helpers, so a
 * book that ends down must not read in the same colour as one that ends up.
 * Only one tone is ever on screen, so this is a polarity signal rather than a
 * categorical palette — and the balance is printed as text beside it, so the
 * reading never rests on colour alone.
 */
function balanceTone(units: number): "strong" | "mid" | "weak" {
  if (units > 0.005) return "strong";
  if (units < -0.005) return "weak";
  return "mid";
}

/**
 * Stroke uses the AA-safe `-text` step, not the bright mark step.
 *
 * `--scl-perf-strong` is 2.31:1 on the light card — fine for a filled area, too
 * faint for a 2px line. The `-text` steps clear 3:1 in both themes.
 */
const TONE = {
  strong: {
    line: "var(--scl-perf-strong-text)",
    wash: "var(--scl-perf-strong)",
    text: "text-[color:var(--scl-perf-strong-text)]",
  },
  mid: {
    line: "var(--scl-perf-mid-text)",
    wash: "var(--scl-perf-mid)",
    text: "text-[color:var(--scl-perf-mid-text)]",
  },
  weak: {
    line: "var(--scl-perf-weak-text)",
    wash: "var(--scl-perf-weak)",
    text: "text-[color:var(--scl-perf-weak-text)]",
  },
} as const;

function signed(units: number): string {
  return `${units >= 0 ? "+" : ""}${units.toFixed(2)}`;
}

/**
 * Cumulative units chart — zero baseline, stable domain, accessible summary.
 * Honest empty when graded &lt; MIN_GRADED_FOR_SIGNAL.
 */
export function CumulativeUnitsChart({
  points,
  gradedCount,
  startsFromLegacyBalance = false,
  className,
}: {
  points: CumulativePoint[];
  gradedCount: number;
  /** All-window series that starts at the carried-over legacy net. */
  startsFromLegacyBalance?: boolean;
  className?: string;
}) {
  const gradientId = useId();
  const plotRef = useRef<HTMLDivElement>(null);
  const [activeIndex, setActiveIndex] = useState<number | null>(null);

  const geometry = useMemo(() => {
    if (points.length < 2) return null;
    const values = points.map((point) => point.units);
    const endValue = values[values.length - 1]!;
    const min = Math.min(0, ...values);
    const max = Math.max(0, ...values);
    const pad = Math.max(0.5, (max - min) * 0.08);
    const low = min - pad;
    const high = max + pad;
    const range = high - low;
    const plotHeight = CHART_HEIGHT - CHART_TOP - CHART_BOTTOM;

    const span = CHART_WIDTH - CHART_SIDE * 2;
    const xFor = (index: number) =>
      CHART_SIDE + (index / Math.max(1, points.length - 1)) * span;
    const yFor = (units: number) =>
      CHART_TOP + ((high - units) / range) * plotHeight;

    return {
      low,
      high,
      xFor,
      yFor,
      zeroY: yFor(0),
      plotHeight,
      // Percentages so the HTML overlay lands on the stretched SVG exactly.
      leftPct: (index: number) => (xFor(index) / CHART_WIDTH) * 100,
      topPct: (units: number) => (yFor(units) / CHART_HEIGHT) * 100,
      peak: max,
      trough: min,
      /**
       * Anchor for the area wash: the furthest excursion on the side the book
       * actually closes on.
       *
       * Anchoring to the deepest excursion instead would fill a recovered
       * book's drawdown and leave its recovery blank — the opposite of what
       * the headline balance says.
       */
      extremeY: yFor(
        endValue > 0
          ? max
          : endValue < 0
            ? min
            : Math.abs(max) >= Math.abs(min)
              ? max
              : min,
      ),
    };
  }, [points]);

  if (!hasSignal(gradedCount) || points.length < 2 || !geometry) {
    return (
      <div
        className={cn(
          "border-border bg-surface-2 flex min-h-[11rem] flex-col justify-center rounded-xl border px-4 py-6",
          className,
        )}
        role="status"
      >
        <p className="scl-eyebrow text-muted-foreground">Cumulative units</p>
        <p className="text-muted-foreground mt-2 text-sm leading-relaxed">
          Chart unlocks after {MIN_GRADED_FOR_SIGNAL} graded plays. Current
          sample: {gradedCount.toLocaleString()} — showing an honest empty, not
          a fabricated trend.
        </p>
      </div>
    );
  }

  const last = points[points.length - 1]!.units;
  const tone = TONE[balanceTone(last)];
  const summary = startsFromLegacyBalance
    ? `Cumulative units from ${gradedCount} graded receipts, starting from the carried-over legacy balance. Ending balance ${signed(last)} units.`
    : `Cumulative units across ${gradedCount} graded plays. Ending balance ${signed(last)} units.`;

  const linePath = points
    .map(
      (point, index) =>
        `${index === 0 ? "M" : "L"}${geometry.xFor(index).toFixed(2)},${geometry
          .yFor(point.units)
          .toFixed(2)}`,
    )
    .join(" ");
  const areaPath = `${linePath} L${(CHART_WIDTH - CHART_SIDE).toFixed(2)},${geometry.zeroY.toFixed(2)} L${CHART_SIDE},${geometry.zeroY.toFixed(2)} Z`;

  const active = activeIndex == null ? null : points[activeIndex];

  const indexFromClientX = (clientX: number) => {
    const box = plotRef.current?.getBoundingClientRect();
    if (!box || box.width === 0) return null;
    const ratio = Math.min(1, Math.max(0, (clientX - box.left) / box.width));
    return Math.round(ratio * (points.length - 1));
  };

  return (
    <figure className={cn("space-y-2", className)}>
      <figcaption className="flex flex-wrap items-end justify-between gap-2">
        <span className="scl-eyebrow text-muted-foreground">
          Cumulative units
        </span>
        <span className="scl-data text-xs tabular-nums">
          <span className="text-muted-foreground">End </span>
          <span className={cn("font-semibold", tone.text)}>
            {signed(last)}U
          </span>
        </span>
      </figcaption>

      <div
        ref={plotRef}
        className="border-border bg-card relative h-52 w-full min-w-0 overflow-hidden rounded-xl border"
        role="img"
        aria-label={summary}
        onPointerMove={(event) =>
          setActiveIndex(indexFromClientX(event.clientX))
        }
        onPointerLeave={() => setActiveIndex(null)}
      >
        <svg
          className="absolute inset-0 block size-full"
          viewBox={`0 0 ${CHART_WIDTH} ${CHART_HEIGHT}`}
          preserveAspectRatio="none"
          aria-hidden="true"
        >
          <defs>
            {/*
              Anchored in user space from the furthest excursion to the zero
              line, so the wash is heaviest at the line and fades out at the
              baseline in BOTH directions. Object-bounding-box units would
              invert this on a book that spends its life under water.
            */}
            <linearGradient
              id={gradientId}
              gradientUnits="userSpaceOnUse"
              x1="0"
              y1={geometry.extremeY}
              x2="0"
              y2={geometry.zeroY}
            >
              <stop offset="0%" stopColor={tone.wash} stopOpacity="0.3" />
              <stop offset="100%" stopColor={tone.wash} stopOpacity="0.02" />
            </linearGradient>
          </defs>

          {GRID_STEPS.map((step) => (
            <line
              key={step}
              x1="0"
              x2={CHART_WIDTH}
              y1={CHART_TOP + step * geometry.plotHeight}
              y2={CHART_TOP + step * geometry.plotHeight}
              stroke="var(--scl-line)"
              strokeDasharray="2 7"
              vectorEffect="non-scaling-stroke"
            />
          ))}

          <path d={areaPath} fill={`url(#${gradientId})`} />

          <line
            x1="0"
            x2={CHART_WIDTH}
            y1={geometry.zeroY}
            y2={geometry.zeroY}
            stroke="var(--scl-muted-label)"
            strokeOpacity="0.55"
            vectorEffect="non-scaling-stroke"
          />

          <path
            d={linePath}
            fill="none"
            stroke={tone.line}
            strokeWidth={2}
            strokeLinecap="round"
            strokeLinejoin="round"
            vectorEffect="non-scaling-stroke"
          />
        </svg>

        {/*
          Markers live in HTML, not SVG. The viewBox is stretched to the
          container, so an SVG circle renders as an ellipse and a crosshair
          would inherit the same distortion.
        */}
        <div className="pointer-events-none absolute inset-0">
          {active ? (
            <>
              <span
                className="bg-border absolute top-0 bottom-0 w-px"
                style={{ left: `${geometry.leftPct(activeIndex!)}%` }}
              />
              <span
                className="border-card absolute size-2.5 -translate-x-1/2 -translate-y-1/2 rounded-full border-2"
                style={{
                  left: `${geometry.leftPct(activeIndex!)}%`,
                  top: `${geometry.topPct(active.units)}%`,
                  backgroundColor: tone.line,
                }}
              />
              <span
                className="border-border bg-card text-foreground absolute top-1.5 rounded-md border px-2 py-1 text-[0.68rem] leading-tight font-semibold whitespace-nowrap tabular-nums shadow-sm"
                style={{
                  left: `${geometry.leftPct(activeIndex!)}%`,
                  transform: `translateX(${
                    geometry.leftPct(activeIndex!) > 70
                      ? "calc(-100% - 8px)"
                      : "8px"
                  })`,
                }}
              >
                <span className="text-muted-foreground font-medium">
                  Pick {active.n.toLocaleString()}
                </span>
                <span aria-hidden> · </span>
                <span className={tone.text}>{signed(active.units)}U</span>
              </span>
            </>
          ) : (
            <span
              className="border-card absolute size-2.5 -translate-x-1/2 -translate-y-1/2 rounded-full border-2"
              style={{
                left: `${geometry.leftPct(points.length - 1)}%`,
                top: `${geometry.topPct(last)}%`,
                backgroundColor: tone.line,
              }}
            />
          )}

          {/* The one axis reference that is exactly where it says it is. */}
          <span
            className="scl-data text-muted-foreground absolute left-2 -translate-y-1/2 text-[0.6rem] tabular-nums opacity-70"
            style={{ top: `${geometry.topPct(0)}%` }}
          >
            0
          </span>
        </div>
      </div>

      <p className="sr-only">{summary}</p>
    </figure>
  );
}

/** Build cumulative series from oldest→newest graded profit units. */
export function buildCumulativeUnits(
  profitUnitsChronological: number[],
): CumulativePoint[] {
  let run = 0;
  return profitUnitsChronological.map((p, i) => {
    run += p;
    return { n: i + 1, units: Math.round((run + Number.EPSILON) * 100) / 100 };
  });
}
