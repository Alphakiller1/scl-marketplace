"use client";

import Link from "next/link";
import { GitCompareArrows, X } from "lucide-react";

import { useCompareTray } from "@/lib/compare-store";
import { cn } from "@/lib/utils";

/**
 * Compare tray — pin ≤3 cappers. Subordinate to MobileSlipDock (z-30 &lt; z-40).
 * No pink conviction border; shorter bar.
 */
export function CompareTray({ className }: { className?: string }) {
  const { handles, remove, clear } = useCompareTray();

  if (!handles.length) return null;

  return (
    <div
      className={cn(
        "pointer-events-none fixed inset-x-0 bottom-0 z-30 px-3",
        className,
      )}
      style={{ paddingBottom: "env(safe-area-inset-bottom, 0px)" }}
    >
      {/* Clear space above sticky slip when both present */}
      <div className="pointer-events-auto mx-auto mb-[calc(3.5rem+0.75rem)] max-w-3xl lg:mb-3">
        <div
          className="border-border bg-card flex min-h-11 items-center gap-2 rounded-[10px] border px-3 py-2 shadow-[var(--scl-shadow-card)]"
          role="region"
          aria-label="Compare tray"
        >
          <GitCompareArrows
            className="size-4 shrink-0 text-[color:var(--scl-muted-label)]"
            aria-hidden
          />
          <p className="scl-eyebrow text-muted-foreground shrink-0">Compare</p>
          <ul className="flex min-w-0 flex-1 flex-wrap items-center gap-1.5">
            {handles.map((handle) => (
              <li key={handle}>
                <span className="border-border bg-surface-2 inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-xs font-semibold">
                  <Link
                    href={`/cappers/${handle}`}
                    className="text-foreground hover:text-[color:var(--scl-blue)]"
                  >
                    @{handle}
                  </Link>
                  <button
                    type="button"
                    className="text-muted-foreground hover:text-foreground rounded-full p-0.5"
                    aria-label={`Remove @${handle} from compare`}
                    onClick={() => remove(handle)}
                  >
                    <X className="size-3" aria-hidden />
                  </button>
                </span>
              </li>
            ))}
          </ul>
          <button
            type="button"
            className="text-muted-foreground hover:text-foreground shrink-0 text-xs font-semibold"
            onClick={clear}
          >
            Clear
          </button>
        </div>
      </div>
    </div>
  );
}
