"use client";

import { useState, useSyncExternalStore, type ReactNode } from "react";
import { createPortal } from "react-dom";

/** Never changes, so the store never notifies. Hoisted to keep it referentially stable. */
const subscribeToNothing = () => () => {};

import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { cn } from "@/lib/utils";

/**
 * Mobile sticky slip bar — SCL-DESIGN-SPEC STICKY SLIP BAR recipe.
 * Fixed bottom, 56px, pink-deep border, the one permitted gradient, VIEW SLIP CTA.
 *
 * The bar is rendered into `document.body` rather than left where the component
 * sits. `position: fixed` resolves against the nearest ancestor carrying a
 * transform, filter, backdrop-filter, perspective or `contain`, NOT against the
 * viewport — and any one of those anywhere above this component silently turns
 * "pinned to the bottom of the screen" into "pinned to the bottom of that
 * ancestor". On a phone that landed the slip bar in the middle of the board,
 * floating over the prop rows. A portal to the body has no such ancestor, so
 * the bar cannot be captured again by a transform added somewhere up the tree
 * later — which is the part worth having, since the failure is invisible until
 * someone opens the page on a phone.
 *
 * The spacer stays in flow, where the component actually sits, so the last rows
 * of the board still clear the bar.
 */
export function MobileSlipDock({
  title,
  countLabel,
  oddsLabel,
  children,
  className,
}: {
  title: string;
  /** e.g. "1 LEG" / "3 LEGS" */
  countLabel: string;
  /** Combined or single-leg American odds, or null when not yet combinable. */
  oddsLabel?: string | null;
  children: ReactNode;
  className?: string;
}) {
  const [open, setOpen] = useState(false);
  // The portal target only exists in the browser, so the bar mounts after
  // hydration. The spacer renders on the server either way, so nothing shifts.
  // `useSyncExternalStore` rather than set-state-in-an-effect: it reports
  // server and client directly, which is what this actually needs, and the
  // effect form is a lint error under react-hooks/set-state-in-effect.
  const mounted = useSyncExternalStore(
    subscribeToNothing,
    () => true,
    () => false,
  );

  const bar = (
    <div
      // `lg:hidden` is repeated here because the portal lifts this out of the
      // wrapper below that carries it.
      className="fixed inset-x-0 bottom-0 z-40 px-3 lg:hidden"
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
        <span className="scl-display min-w-0 flex-1 truncate text-base font-bold tracking-[0.05em] text-[color:var(--scl-text)] uppercase">
          {countLabel}
        </span>
        {oddsLabel ? (
          <span className="scl-data text-foreground shrink-0 text-[15px] font-semibold">
            {oddsLabel}
          </span>
        ) : null}
        <button
          type="button"
          onClick={() => setOpen(true)}
          className="scl-cta-brand h-11 shrink-0 px-4 text-[15px]"
          aria-haspopup="dialog"
          aria-expanded={open}
        >
          View Slip
        </button>
      </div>
    </div>
  );

  return (
    <div className={cn("lg:hidden", className)}>
      <div
        className="h-[calc(56px+env(safe-area-inset-bottom,0px)+0.75rem)]"
        aria-hidden
      />

      {mounted ? createPortal(bar, document.body) : null}

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
