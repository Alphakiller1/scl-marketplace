"use client";

import { useState, type ReactNode } from "react";

import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { cn } from "@/lib/utils";

/**
 * Mobile sticky slip bar — SCL-DESIGN-SPEC STICKY SLIP BAR recipe.
 * Fixed bottom, 56px, pink-deep border, the one permitted gradient, open-slip CTA.
 */
export function MobileSlipDock({
  title,
  countLabel,
  oddsLabel,
  children,
  className,
}: {
  title: string;
  /** e.g. "1 pick" / "3 legs" */
  countLabel: string;
  /** Combined or single-leg American odds, or null when not yet combinable. */
  oddsLabel?: string | null;
  children: ReactNode;
  className?: string;
}) {
  const [open, setOpen] = useState(false);

  return (
    <div className={cn("lg:hidden", className)}>
      <div
        className="h-[calc(56px+env(safe-area-inset-bottom,0px)+0.75rem)]"
        aria-hidden
      />

      <div
        className="fixed inset-x-0 bottom-0 z-40 px-3"
        style={{ paddingBottom: "env(safe-area-inset-bottom, 0px)" }}
      >
        <div
          className="mb-3 flex h-14 items-center gap-3 rounded-[14px] border px-4"
          style={{
            background: "linear-gradient(180deg,#1E2940,#141C2C)",
            borderColor: "var(--scl-pink-deep)",
            boxShadow: "var(--scl-shadow-slip)",
          }}
        >
          <span className="scl-display min-w-0 flex-1 truncate text-base font-bold tracking-[0.04em] text-[color:var(--scl-hero-text)]">
            {countLabel}
          </span>
          {oddsLabel ? (
            <span className="scl-data shrink-0 text-[15px] font-semibold text-[color:var(--scl-hero-text)]">
              {oddsLabel}
            </span>
          ) : null}
          <button
            type="button"
            onClick={() => setOpen(true)}
            className="h-11 shrink-0 rounded-[10px] bg-[color:var(--scl-pink)] px-4 text-[15px] font-semibold text-[color:var(--scl-pink-ink)]"
            aria-haspopup="dialog"
            aria-expanded={open}
          >
            Open pick slip
          </button>
        </div>
      </div>

      <Sheet open={open} onOpenChange={setOpen}>
        <SheetContent
          side="bottom"
          showCloseButton
          className="max-h-[85vh] gap-0 overflow-y-auto rounded-t-2xl p-0 pb-[env(safe-area-inset-bottom,0px)]"
        >
          <SheetHeader className="border-border border-b px-4 py-3">
            <SheetTitle>{title}</SheetTitle>
          </SheetHeader>
          <div className="p-4">{children}</div>
        </SheetContent>
      </Sheet>
    </div>
  );
}
