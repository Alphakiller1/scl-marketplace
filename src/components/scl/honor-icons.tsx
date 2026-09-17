import { ALL_SPORTS, type HonorAward } from "@/lib/honors";
import { CROSS_SPORTS } from "@/lib/parlay-sport";
import { cn } from "@/lib/utils";

/** Board marks from the Honors program. NCAAF and NCAAB are drawn below. */
const SPORT_EMOJI: Record<string, string> = {
  NFL: "🏈",
  NBA: "🏀",
  WNBA: "⛹🏽‍♀️",
  MLB: "⚾",
  MMA: "🥊",
  SOCCER: "⚽",
  TENNIS: "🎾",
  CFL: "🍁",
  NHL: "🏒",
  PGA: "⛳",
  [CROSS_SPORTS]: "🔗",
};

/** Football helmet — NCAAF, kept distinct from the NFL ball. */
export function HelmetIcon({
  className,
  size,
}: {
  className?: string;
  /** Pixel size, for image rendering where classes do not apply. */
  size?: number;
}) {
  return (
    <svg
      viewBox="0 0 24 24"
      width={size}
      height={size}
      className={className}
      aria-hidden
      fill="none"
    >
      <path
        d="M3.5 13.5C3.5 8.3 7.4 4 12.6 4c4.4 0 7.9 3.3 7.9 7.6V15h-6.2l-1.1 3.5H7.4C5.2 18.5 3.5 16.3 3.5 13.5Z"
        fill="#c9ccd6"
        stroke="#4a4f5c"
        strokeWidth="1.2"
      />
      <path
        d="M14.3 15h7.2M16.5 15v3.8M19.5 15v3.8M15.2 18.8h6"
        stroke="#4a4f5c"
        strokeWidth="1.4"
        strokeLinecap="round"
      />
      <path d="M9 5.2c-.6 2.7-.6 6 .3 9.8" stroke="#b3261e" strokeWidth="1.6" />
      <circle cx="10.8" cy="12.2" r="1.5" fill="#4a4f5c" />
    </svg>
  );
}

/** Basketball hoop — NCAAB, kept distinct from the NBA ball. */
export function HoopIcon({
  className,
  size,
}: {
  className?: string;
  /** Pixel size, for image rendering where classes do not apply. */
  size?: number;
}) {
  return (
    <svg
      viewBox="0 0 24 24"
      width={size}
      height={size}
      className={className}
      aria-hidden
      fill="none"
    >
      <rect
        x="4"
        y="2.5"
        width="16"
        height="10"
        rx="1.2"
        fill="#f4f5f8"
        stroke="#4a4f5c"
        strokeWidth="1.2"
      />
      <rect
        x="9"
        y="6"
        width="6"
        height="4.5"
        stroke="#d94a1e"
        strokeWidth="1.2"
      />
      <ellipse
        cx="12"
        cy="12.6"
        rx="4.6"
        ry="1.3"
        stroke="#d94a1e"
        strokeWidth="1.6"
      />
      <path
        d="M7.6 13l1.6 8M16.4 13l-1.6 8M10 13.6l.6 7.4M14 13.6l-.6 7.4M8.4 17h7.2M9.2 20.6h5.6"
        stroke="#9aa0ad"
        strokeWidth="1"
        strokeLinecap="round"
      />
    </svg>
  );
}

/** Sport emoji; `null` for marks that are drawn (annual awards, NCAAF, NCAAB). */
export function honorEmoji(award: Pick<HonorAward, "sport">): string | null {
  return SPORT_EMOJI[award.sport] ?? null;
}

/** Lucide Crown / Trophy geometry, inlined so next/og can render it too. */
const ANNUAL_PATHS = {
  units: [
    "M11.562 3.266a.5.5 0 0 1 .876 0L15.39 8.87a1 1 0 0 0 1.516.294L21.183 5.5a.5.5 0 0 1 .798.519l-2.834 10.246a1 1 0 0 1-.956.734H5.81a1 1 0 0 1-.957-.734L2.02 6.02a.5.5 0 0 1 .798-.519l4.276 3.664a1 1 0 0 0 1.516-.294z",
    "M5 21h14",
  ],
  roi: [
    "M10 14.66v1.626a2 2 0 0 1-.976 1.696A5 5 0 0 0 7 21.978",
    "M14 14.66v1.626a2 2 0 0 0 .976 1.696A5 5 0 0 1 17 21.978",
    "M18 9h1.5a1 1 0 0 0 0-5H18",
    "M4 22h16",
    "M6 9a6 6 0 0 0 12 0V3a1 1 0 0 0-1-1H7a1 1 0 0 0-1 1z",
    "M6 9H4.5a1 1 0 0 1 0-5H6",
  ],
} as const;

/**
 * Annual awards use the rank crown and a trophy, pink per the design spec
 * (conviction marks; never gold).
 */
export function AnnualMark({
  metric,
  className,
  size,
  color = "currentColor",
}: {
  metric: HonorAward["metric"];
  className?: string;
  /** Pixel size and color, for image rendering where classes do not apply. */
  size?: number;
  color?: string;
}) {
  return (
    <svg
      viewBox="0 0 24 24"
      width={size}
      height={size}
      className={className}
      aria-hidden
      fill="none"
      stroke={color}
      strokeWidth={2.25}
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      {ANNUAL_PATHS[metric].map((d) => (
        <path key={d} d={d} />
      ))}
    </svg>
  );
}

/**
 * The award's mark: pink crown (Capper of the Year), pink trophy (Annual
 * Performance),
 * or the sport — football vs helmet, basketball vs hoop.
 */
export function HonorGlyph({
  award,
  className,
}: {
  award: Pick<HonorAward, "sport" | "metric" | "sportLabel">;
  /** Size via font-size (`text-*`); the drawn marks scale to 1em. */
  className?: string;
}) {
  const label = award.sport === ALL_SPORTS ? undefined : award.sportLabel;
  return (
    <span
      className={cn(
        "inline-flex shrink-0 items-center leading-none",
        className,
      )}
      title={label}
    >
      {award.sport === ALL_SPORTS ? (
        <AnnualMark
          metric={award.metric}
          className="size-[1.1em] text-[color:var(--scl-pink)]"
        />
      ) : award.sport === "NCAAF" ? (
        <HelmetIcon className="size-[1.15em]" />
      ) : award.sport === "NCAAB" ? (
        <HoopIcon className="size-[1.15em]" />
      ) : (
        <span aria-hidden>{honorEmoji(award) ?? "•"}</span>
      )}
      {label ? <span className="sr-only">{label}</span> : null}
    </span>
  );
}
