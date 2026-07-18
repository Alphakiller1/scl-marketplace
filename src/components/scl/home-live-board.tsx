import type { ReactNode } from "react";

import { cn } from "@/lib/utils";

/**
 * Homepage evidence field — asymmetric 12-col regions around/below the carousel.
 * Structural hairlines between regions (not one card wrapping the stack).
 * Scanline + cobalt rail only on true live-board panes.
 */
export function HomeEvidenceField({
  leaderboard,
  featuredProof,
  whatChanged,
  topCappers,
  verificationContext,
  className,
}: {
  leaderboard: ReactNode;
  featuredProof: ReactNode;
  whatChanged: ReactNode;
  topCappers: ReactNode;
  verificationContext: ReactNode;
  className?: string;
}) {
  return (
    <div
      data-visual-mode="live"
      className={cn("relative", className)}
      aria-label="Live evidence field"
    >
      {/* Row 1 — board snapshot + paper receipt contrast */}
      <div className="border-border grid gap-0 border-y lg:grid-cols-12">
        <LiveBoardPane className="lg:col-span-8 lg:border-r">
          {leaderboard}
        </LiveBoardPane>
        <div className="border-border min-w-0 px-4 py-5 sm:px-5 sm:py-6 lg:col-span-4 lg:border-t-0">
          {featuredProof}
        </div>
      </div>

      {/* Row 2 — full-width open strip */}
      <LiveBoardPane className="border-border border-b">
        {whatChanged}
      </LiveBoardPane>

      {/* Row 3 — inspectable cappers + verification context */}
      <div className="border-border grid gap-0 border-b lg:grid-cols-12">
        <LiveBoardPane className="lg:col-span-8 lg:border-r">
          {topCappers}
        </LiveBoardPane>
        <div className="border-border min-w-0 px-4 py-5 sm:px-5 sm:py-6 lg:col-span-4">
          {verificationContext}
        </div>
      </div>
    </div>
  );
}

/** Scanline + cobalt time rail — live board panes only. */
function LiveBoardPane({
  children,
  className,
}: {
  children: ReactNode;
  className?: string;
}) {
  return (
    <div
      className={cn(
        "scl-scanline relative min-w-0 bg-[color:var(--scl-ink-900)]",
        className,
      )}
    >
      <div
        className="pointer-events-none absolute inset-y-0 left-0 w-1 bg-[color:var(--scl-blue)]"
        aria-hidden
      />
      <div className="px-4 py-5 pl-5 sm:px-5 sm:py-6 sm:pl-6">{children}</div>
    </div>
  );
}

/** @deprecated Prefer HomeEvidenceField — kept for any residual imports. */
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
