"use client";

import { useState } from "react";

import { bookLabel, bookShort, isBookKey } from "@/lib/books";
import { bookMarkMonogramSrc, bookMarkSrc } from "@/lib/mark-manifest";
import { cn } from "@/lib/utils";

/**
 * Sportsbook mark — self-hosted logo PNG with monogram/text fallback (zero CLS).
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
  const pngSrc = bookMarkSrc(bookKey);
  const svgSrc = bookMarkMonogramSrc(bookKey);

  return (
    <BookMarkImage
      bookKey={bookKey}
      label={label}
      short={short}
      pngSrc={pngSrc}
      svgSrc={svgSrc}
      size={size}
      box={box}
    />
  );
}

function BookMarkImage({
  bookKey,
  label,
  short,
  pngSrc,
  svgSrc,
  size,
  box,
}: {
  bookKey: string;
  label: string;
  short: string;
  pngSrc?: string;
  svgSrc?: string;
  size: 16 | 20 | 24;
  box: string;
}) {
  const [failed, setFailed] = useState<"none" | "png" | "all">("none");

  if (failed === "all" || (!pngSrc && !svgSrc)) {
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
        data-book={bookKey}
      >
        {short}
      </span>
    );
  }

  const src = failed === "png" && svgSrc ? svgSrc : (pngSrc ?? svgSrc ?? "");

  return (
    // eslint-disable-next-line @next/next/no-img-element -- local marks; fixed box, no remote loader
    <img
      src={src}
      alt={label}
      width={size}
      height={size}
      className={cn(box, "rounded bg-white/95 object-contain")}
      title={label}
      data-short={short}
      data-book={bookKey}
      onError={() => {
        if (failed === "none" && pngSrc && svgSrc) {
          setFailed("png");
          return;
        }
        setFailed("all");
      }}
    />
  );
}
