import { cn } from "@/lib/utils";

export function PerformanceSparkline({
  points,
  className,
  label = "Cumulative unit trend",
}: {
  points?: number[];
  className?: string;
  label?: string;
}) {
  const values = points?.length ? points : [0, 0];
  const min = Math.min(...values);
  const max = Math.max(...values);
  const range = max - min || 1;
  const width = 120;
  const height = 36;
  const padding = 3;
  const plotWidth = width - padding * 2;
  const plotHeight = height - padding * 2;
  const coordinates = values
    .map((value, index) => {
      const x =
        values.length === 1
          ? width / 2
          : padding + (index / (values.length - 1)) * plotWidth;
      const y = padding + ((max - value) / range) * plotHeight;
      return `${x.toFixed(1)},${y.toFixed(1)}`;
    })
    .join(" ");
  const delta = values.at(-1)! - values[0];
  const tone =
    delta > 0 ? "text-pos" : delta < 0 ? "text-neg" : "text-muted-foreground";

  return (
    <svg
      viewBox={`0 0 ${width} ${height}`}
      role="img"
      aria-label={label}
      className={cn("h-9 w-[7.5rem]", tone, className)}
      preserveAspectRatio="none"
    >
      <path
        d={`M${padding} ${height - padding}H${width - padding}`}
        className="stroke-border"
        strokeWidth="1"
        vectorEffect="non-scaling-stroke"
      />
      <polyline
        points={coordinates}
        fill="none"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
        vectorEffect="non-scaling-stroke"
      />
      <circle
        cx={coordinates.split(" ").at(-1)?.split(",")[0]}
        cy={coordinates.split(" ").at(-1)?.split(",")[1]}
        r="2.25"
        fill="currentColor"
      />
    </svg>
  );
}
