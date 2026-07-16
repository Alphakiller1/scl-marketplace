import { bookLabel, bookShort, isBookKey } from "@/lib/books";
import { cn } from "@/lib/utils";

/**
 * Sportsbook mark — self-hosted monogram SVG with fixed box (zero CLS).
 * Nominative source attribution only — not a sponsorship claim.
 */
export function BookMark({
  bookKey,
  size = 20,
  className,
}: {
  bookKey?: string | null;
  size?: 16 | 20 | 24;
  className?: string;
}) {
  const box = cn("inline-flex shrink-0 items-center justify-center", className);

  if (!bookKey || !isBookKey(bookKey)) {
    return (
      <span
        className={cn(
          box,
          "bg-surface-3 text-muted-foreground rounded font-semibold tracking-wide uppercase",
        )}
        style={{
          width: size,
          height: size,
          fontSize: Math.max(8, size * 0.35),
        }}
        aria-label="Live board"
        title="LIVE BOARD"
      >
        LB
      </span>
    );
  }

  const label = bookLabel(bookKey);
  const short = bookShort(bookKey);

  return (
    // eslint-disable-next-line @next/next/no-img-element -- local SVG monograms; fixed size, no remote loader
    <img
      src={`/marks/books/${bookKey}.svg`}
      alt={label}
      width={size}
      height={size}
      className={cn(box, "rounded object-contain")}
      title={label}
      data-short={short}
    />
  );
}
