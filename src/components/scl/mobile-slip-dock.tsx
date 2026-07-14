"use client";

import { useState, type ReactNode } from "react";
import { ChevronUp } from "lucide-react";

import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { cn } from "@/lib/utils";

/**
 * Mobile-only (<lg) fixed bottom slip dock: summary bar opens a bottom sheet.
 * Hidden at ≥1024px where the desktop sticky slip column already exists.
 * Parent should render this OR the desktop sticky column — not both — so form
 * fields are not double-mounted.
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
      {/* In-flow spacer — keeps the last board row above the fixed bar. */}
      <div
        className="h-[calc(4.25rem+env(safe-area-inset-bottom,0px))]"
        aria-hidden
      />

      <div
        className="border-border bg-background/95 fixed inset-x-0 bottom-0 z-40 border-t shadow-lg backdrop-blur-md"
        style={{ paddingBottom: "env(safe-area-inset-bottom, 0px)" }}
      >
        <button
          type="button"
          onClick={() => setOpen(true)}
          className="hover:bg-surface-2 flex min-h-12 w-full items-center justify-between gap-3 px-4 py-2.5 text-left transition-colors"
          aria-haspopup="dialog"
          aria-expanded={open}
        >
          <span className="min-w-0">
            <span className="text-muted-foreground block text-[0.65rem] font-semibold tracking-wide uppercase">
              {title}
            </span>
            <span className="text-foreground block truncate text-sm font-semibold">
              {countLabel}
            </span>
          </span>
          <span className="flex shrink-0 items-center gap-2">
            {oddsLabel ? (
              <span className="nums text-brand text-base font-bold tabular-nums">
                {oddsLabel}
              </span>
            ) : null}
            <ChevronUp className="text-muted-foreground size-5" aria-hidden />
          </span>
        </button>
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
