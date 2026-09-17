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

export function honorEmoji(award: Pick<HonorAward, "sport" | "metric">) {
  if (award.sport === ALL_SPORTS) return award.metric === "units" ? "👑" : "🏆";
  return SPORT_EMOJI[award.sport] ?? "🏆";
}

/**
 * The award's mark: crown (Capper of the Year), trophy (Annual Performance),
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
      {award.sport === "NCAAF" ? (
        <HelmetIcon className="size-[1.15em]" />
      ) : award.sport === "NCAAB" ? (
        <HoopIcon className="size-[1.15em]" />
      ) : (
        <span aria-hidden>{honorEmoji(award)}</span>
      )}
      {label ? <span className="sr-only">{label}</span> : null}
    </span>
  );
}
