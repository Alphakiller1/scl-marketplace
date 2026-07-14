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
 * Mobile-only (<lg) fixed bottom slip dock — concept slipbar: gold border,
 * display legs count, mono combined odds, gold CTA to open the sheet.
 */
export function MobileSlipDock({
  title,
  countLabel,
  oddsLabel,
  children,
  className,
}: {
  title: string;
  /** e.g. "1 selection" / "3 legs" */
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
        className="h-[calc(4.5rem+env(safe-area-inset-bottom,0px))]"
        aria-hidden
      />

      <div
        className="fixed inset-x-0 bottom-0 z-40 px-3"
        style={{ paddingBottom: "env(safe-area-inset-bottom, 0px)" }}
      >
        <div
          className="mb-3 flex min-h-14 items-center gap-3 rounded-[14px] border px-4 py-2 shadow-[var(--scl-shadow-slip)]"
          style={{
            background:
              "linear-gradient(180deg, color-mix(in srgb, var(--scl-ink-600) 80%, var(--scl-ink-800)), var(--scl-ink-800))",
            borderColor: "var(--scl-gold-deep)",
          }}
        >
          <span className="min-w-0 flex-1">
            <span className="scl-eyebrow text-muted-foreground block">
              {title}
            </span>
            <span className="scl-display text-foreground block truncate text-base font-bold tracking-[0.05em] uppercase">
              {countLabel}
            </span>
          </span>
          {oddsLabel ? (
            <span className="scl-data text-gold shrink-0 text-[0.95rem] font-semibold">
              {oddsLabel}
            </span>
          ) : null}
          <button
            type="button"
            onClick={() => setOpen(true)}
            className="bg-gold text-gold-foreground scl-display hover:bg-gold/90 min-h-10 shrink-0 rounded-[10px] px-4 text-sm font-bold tracking-[0.08em] uppercase transition-colors"
            aria-haspopup="dialog"
            aria-expanded={open}
          >
            View Slip
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
