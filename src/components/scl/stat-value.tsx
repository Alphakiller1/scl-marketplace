import { cn } from "@/lib/utils";

/**
 * Ledger data face — odds, lines, units, ROI, win%, records, timestamps.
 * Spec: Inter + tabular-nums (tnum). No exceptions.
 */
export function StatValue({
  children,
  className,
  tone = "data",
}: {
  children: React.ReactNode;
  className?: string;
  /** data = muted-data; text = foreground; pink = conviction accent; win/loss = graded only */
  tone?: "data" | "text" | "pink" | "win" | "loss" | "label";
}) {
  return (
    <span
      className={cn(
        "scl-data tabular-nums",
        tone === "data" && "text-[color:var(--scl-muted-data)]",
        tone === "text" && "text-[color:var(--scl-text)]",
        /* Conviction numerals use the text tier — pink is for marks/fills only. */
        tone === "pink" && "text-[color:var(--scl-text)]",
        tone === "win" && "text-[color:var(--scl-win-text)]",
        tone === "loss" && "text-[color:var(--scl-loss-text)]",
        tone === "label" && "text-[color:var(--scl-muted-data)]",
        className,
      )}
    >
      {children}
    </span>
  );
}
