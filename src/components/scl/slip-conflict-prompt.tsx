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
          className="min-h-11 rounded-full border border-[color:var(--scl-gold)] bg-[color:var(--scl-gold)] px-4 text-sm font-semibold text-[color:var(--scl-gold-ink)] transition-colors hover:bg-[color:var(--scl-gold-deep)]"
        >
          Replace
        </button>
        <button
          type="button"
          onClick={onCancel}
          className="border-border text-muted-foreground hover:text-foreground hover:border-foreground/30 min-h-11 rounded-full border px-4 text-sm font-semibold transition-colors"
        >
          Cancel
        </button>
      </div>
    </div>
  );
}
