import { cn } from "@/lib/utils";

/**
 * The SCL trophy mark — a single-color glyph that inherits `currentColor`.
 * Drawn on a 24×24 grid so it sits flush with lucide icons. Used inside the
 * brand chip (white on the purple→blue gradient) and anywhere a bare mark
 * is needed. The dual-tone identity lives on the chip, not the glyph, so it
 * stays legible down to favicon sizes.
 */
export function SclTrophy({ className }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      aria-hidden="true"
      className={className}
    >
      {/* handles */}
      <path
        d="M7 5C4 5 3.4 8 6 9.6"
        stroke="currentColor"
        strokeWidth="1.6"
        strokeLinecap="round"
      />
      <path
        d="M17 5c3 0 3.6 3 1 4.6"
        stroke="currentColor"
        strokeWidth="1.6"
        strokeLinecap="round"
      />
      {/* cup */}
      <path d="M7 4h10v2c0 4-2.5 7-5 7s-5-3-5-7V4Z" fill="currentColor" />
      {/* stem */}
      <path
        d="M12 13v3"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinecap="round"
      />
      {/* base */}
      <path d="M9.2 16h5.6l.9 2.6H8.3L9.2 16Z" fill="currentColor" />
      <rect
        x="7"
        y="18.4"
        width="10"
        height="2.2"
        rx="1.1"
        fill="currentColor"
      />
    </svg>
  );
}

/**
 * The brand chip — the trophy on its purple→blue gradient tile. Reusable on
 * its own (e.g. empty states, marketing hero) when the wordmark isn't wanted.
 */
export function SclMark({
  className,
  glyphClassName,
}: {
  className?: string;
  glyphClassName?: string;
}) {
  return (
    <span
      className={cn(
        "scl-brand-gradient flex size-8 items-center justify-center rounded-lg text-white shadow-sm",
        className,
      )}
    >
      <SclTrophy className={cn("size-5", glyphClassName)} />
    </span>
  );
}

/**
 * Full SCL lockup: brand chip + wordmark, with an optional area badge
 * (e.g. "Dashboard", "Admin"). The wordmark inherits font size from the
 * parent, so callers control scale via `className` on the wrapping link.
 */
export function SclLogo({
  area,
  className,
}: {
  area?: string;
  className?: string;
}) {
  return (
    <span className={cn("flex items-center gap-2 font-semibold", className)}>
      <SclMark />
      <span className="tracking-tight">SCL</span>
      {area ? (
        <span className="bg-surface-3 text-muted-foreground rounded-md px-1.5 py-0.5 text-[0.7rem] font-semibold tracking-wide uppercase">
          {area}
        </span>
      ) : null}
    </span>
  );
}
