"use client";

import { useRef, type ReactNode } from "react";
import { ChevronLeft, ChevronRight } from "lucide-react";

import { cn } from "@/lib/utils";

/**
 * Horizontal, snap-scrolling row of Honors graphics with previous/next
 * controls. Native scrolling (touch, trackpad, keyboard) keeps working.
 */
export function HonorScroller({
  label,
  children,
  className,
}: {
  label: string;
  children: ReactNode;
  className?: string;
}) {
  const track = useRef<HTMLDivElement>(null);
  const page = (direction: 1 | -1) => {
    const el = track.current;
    if (!el) return;
    const reduce = window.matchMedia(
      "(prefers-reduced-motion: reduce)",
    ).matches;
    el.scrollBy({
      left: direction * el.clientWidth * 0.85,
      behavior: reduce ? "auto" : "smooth",
    });
  };
  const button =
    "border-border bg-card hover:bg-surface-2 focus-visible:ring-ring inline-flex size-10 items-center justify-center rounded-full border focus-visible:ring-2 focus-visible:outline-none";
  return (
    <div className={cn("min-w-0", className)}>
      <div
        ref={track}
        role="region"
        aria-label={label}
        tabIndex={0}
        className="focus-visible:ring-ring flex snap-x snap-mandatory gap-3 overflow-x-auto scroll-smooth pb-2 focus-visible:ring-2 focus-visible:outline-none"
      >
        {children}
      </div>
      <div className="mt-2 flex justify-end gap-2">
        <button
          type="button"
          className={button}
          onClick={() => page(-1)}
          aria-label="Previous honors"
        >
          <ChevronLeft className="size-4" aria-hidden />
        </button>
        <button
          type="button"
          className={button}
          onClick={() => page(1)}
          aria-label="Next honors"
        >
          <ChevronRight className="size-4" aria-hidden />
        </button>
      </div>
    </div>
  );
}
