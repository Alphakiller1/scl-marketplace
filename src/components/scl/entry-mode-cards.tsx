"use client";

import Link from "next/link";

import { cn } from "@/lib/utils";

/**
 * Straight / Parlay mode selector — SCL_M4_PICK_REDESIGN §4.1.
 * Cards route to existing entry URLs; active mode uses pink conviction fill.
 */
/**
 * #113 EntryModeCards — retired from routing by M5 unified slip (PR-3/PR-4).
 * Kept as a dead module for reference; /new and /new/parlay are thin wrappers
 * around UnifiedPickEntry. Do not re-wire this into the pick flow.
 */
export function EntryModeCards({
  mode,
  className,
}: {
  mode: "straight" | "parlay";
  className?: string;
}) {
  return (
    <div
      className={cn("grid grid-cols-2 gap-2 sm:gap-3", className)}
      role="navigation"
      aria-label="Bet mode"
    >
      <ModeCard
        href="/dashboard/picks/new"
        title="Straight bet"
        subtitle="One pick, one bet."
        active={mode === "straight"}
      />
      <ModeCard
        href="/dashboard/picks/new/parlay"
        title="Parlay"
        subtitle="Multiple legs, all must hit."
        active={mode === "parlay"}
      />
    </div>
  );
}

function ModeCard({
  href,
  title,
  subtitle,
  active,
}: {
  href: string;
  title: string;
  subtitle: string;
  active: boolean;
}) {
  return (
    <Link
      href={href}
      aria-current={active ? "page" : undefined}
      className={cn(
        "flex min-h-11 flex-col justify-center rounded-[14px] border px-3 py-3 transition-colors sm:min-h-[4.5rem] sm:px-4",
        active
          ? "scl-fill-brand"
          : "border-[color:var(--scl-line)] bg-[color:var(--scl-ink-800)] text-[color:var(--scl-muted-data)] hover:bg-[color:var(--scl-ink-700)]",
      )}
    >
      <span
        className={cn(
          "scl-display text-sm font-semibold tracking-[0.06em] uppercase sm:text-[15px]",
          active
            ? "text-[color:var(--scl-pink-ink)]"
            : "text-[color:var(--scl-text)]",
        )}
      >
        {title}
      </span>
      <span
        className={cn(
          "mt-0.5 text-xs leading-snug",
          active
            ? "text-[color:var(--scl-pink-ink)]/80"
            : "text-[color:var(--scl-muted-label)]",
        )}
      >
        {subtitle}
      </span>
    </Link>
  );
}
