"use client";

import Image from "next/image";
import { useState } from "react";

import { cn } from "@/lib/utils";

type CapperBannerProps = {
  src?: string | null;
  /** Set on the public profile hero for LCP. */
  priority?: boolean;
  className?: string;
  heightClass?: string;
  /**
   * When true, render nothing if the cover is missing or fails to load —
   * avoids an empty reserved band (trust regression on Proof profiles).
   */
  collapseWhenEmpty?: boolean;
};

/**
 * Capper cover band. Never leaves a broken/empty reserved strip when
 * `collapseWhenEmpty` is set — load failures collapse to null.
 */
export function CapperBanner({
  src,
  priority = false,
  className,
  heightClass = "h-28 w-full sm:h-36 lg:h-40",
  collapseWhenEmpty = false,
}: CapperBannerProps) {
  const [failedSrc, setFailedSrc] = useState<string | null>(null);
  const usable = Boolean(src?.trim()) && failedSrc !== src;

  if (!usable) {
    if (collapseWhenEmpty) return null;
    return (
      <div
        className={cn(
          "bg-surface-2 relative overflow-hidden",
          heightClass,
          className,
        )}
        aria-hidden
      >
        <div className="absolute inset-0 bg-[color:var(--scl-ink-900)]" />
        <div
          className="pointer-events-none absolute inset-0 opacity-[0.35]"
          style={{
            backgroundImage:
              "radial-gradient(ellipse at 20% 40%, color-mix(in oklab, var(--scl-pink) 18%, transparent), transparent 55%), radial-gradient(ellipse at 80% 60%, color-mix(in oklab, var(--scl-blue) 14%, transparent), transparent 50%)",
          }}
        />
      </div>
    );
  }

  return (
    <div
      className={cn(
        "bg-surface-2 relative overflow-hidden",
        heightClass,
        className,
      )}
    >
      <Image
        src={src!}
        alt=""
        fill
        sizes="100vw"
        priority={priority}
        className="object-cover"
        onError={() => setFailedSrc(src ?? null)}
      />
    </div>
  );
}
