"use client";

import { useState } from "react";

import { bookLabel, bookShort, isBookKey } from "@/lib/books";
import { cn } from "@/lib/utils";

/** Bump when replacing files under public/marks/books/ so caches refresh. */
const BOOK_MARK_ASSET_VERSION = "2";

/**
 * Sportsbook mark — self-hosted SVG under public/marks/books/{key}.svg.
 * Nominative source attribution only — not a sponsorship claim.
 * Fixed box (zero CLS); short-letter fallback if the asset fails to load.
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
  const [failed, setFailed] = useState(false);
  const box = cn("inline-flex shrink-0 items-center justify-center", className);

  if (!bookKey || !isBookKey(bookKey) || failed) {
    const short =
      bookKey && isBookKey(bookKey)
        ? bookShort(bookKey)
        : bookKey
          ? "BK"
          : "LB";
    const label =
      bookKey && isBookKey(bookKey)
        ? bookLabel(bookKey)
        : bookKey
          ? bookKey
          : "LIVE BOARD";
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
        aria-label={label}
        title={label}
      >
        {short}
      </span>
    );
  }

  const label = bookLabel(bookKey);
  const short = bookShort(bookKey);

  return (
    // eslint-disable-next-line @next/next/no-img-element -- local SVG; fixed size, onError fallback
    <img
      src={`/marks/books/${bookKey}.svg?v=${BOOK_MARK_ASSET_VERSION}`}
      alt={label}
      width={size}
      height={size}
      className={cn(box, "rounded object-contain")}
      title={label}
      data-short={short}
      onError={() => setFailed(true)}
    />
  );
}
