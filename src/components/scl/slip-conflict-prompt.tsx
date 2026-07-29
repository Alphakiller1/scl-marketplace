"use client";

import { cn } from "@/lib/utils";

/**
 * Inline same-market conflict prompt — Replace swaps the conflicting leg in place;
 * Cancel dismisses without changing the slip.
 */
export function SlipConflictPrompt({
  message,
  incomingLabel,
  onReplace,
  onCancel,
  className,
}: {
  message: string;
  /** Short label for the incoming pick (selection + odds). */
  incomingLabel?: string;
  onReplace: () => void;
  onCancel: () => void;
  className?: string;
}) {
  return (
    <div
      role="alertdialog"
      aria-labelledby="slip-conflict-title"
      aria-describedby="slip-conflict-desc"
      className={cn(
        "space-y-3 rounded-lg border border-[color:var(--scl-line)] bg-[color:var(--scl-ink-700)] p-3",
        className,
      )}
    >
      <div className="space-y-1">
        <p
          id="slip-conflict-title"
          className="text-foreground text-sm font-semibold"
        >
          Replace conflicting leg?
        </p>
        <p id="slip-conflict-desc" className="text-muted-foreground text-xs">
          {message}
          {incomingLabel ? (
            <>
              {" "}
              Replace with{" "}
              <span className="text-foreground font-medium">
                {incomingLabel}
              </span>
              ?
            </>
          ) : null}
        </p>
      </div>
      <div className="flex flex-wrap gap-2">
        <button
          type="button"
          onClick={onReplace}
          className="scl-cta-brand min-h-10 px-4"
        >
          Replace
        </button>
        <button
          type="button"
          onClick={onCancel}
          className="scl-cta-nav min-h-10 px-4"
        >
          Cancel
        </button>
      </div>
    </div>
  );
}
