import type { ReactNode } from "react";

import { cn } from "@/lib/utils";

/**
 * Live-mode board shell — scanline texture + cobalt time rail.
 * Apply only around homepage evidence modules (not the hero carousel).
 */
export function HomeLiveBoard({
  children,
  className,
}: {
  children: ReactNode;
  className?: string;
}) {
  return (
    <div
      data-visual-mode="live"
      className={cn(
        "scl-scanline border-border relative overflow-hidden rounded-[14px] border",
        "bg-[color:var(--scl-ink-900)]",
        className,
      )}
    >
      <div
        className="pointer-events-none absolute inset-y-0 left-0 w-1 bg-[color:var(--scl-blue)]"
        aria-hidden
      />
      <div className="space-y-8 px-4 py-6 pl-5 sm:space-y-10 sm:px-6 sm:py-8 sm:pl-7">
        {children}
      </div>
    </div>
  );
}
