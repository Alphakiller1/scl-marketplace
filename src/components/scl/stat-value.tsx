import { cn } from "@/lib/utils";

/**
 * Ledger data face — odds, lines, units, ROI, win%, records, timestamps.
 * Spec: IBM Plex Mono + tabular-nums. No exceptions.
 */
export function StatValue({
  children,
  className,
  tone = "data",
}: {
  children: React.ReactNode;
  className?: string;
  /** data = muted-data; text = foreground; gold = scarce accent; win/loss = graded only */
  tone?: "data" | "text" | "gold" | "win" | "loss" | "label";
}) {
  return (
    <span
      className={cn(
        "scl-data tabular-nums",
        tone === "data" && "text-[color:var(--scl-muted-data)]",
        tone === "text" && "text-[color:var(--scl-text)]",
        tone === "gold" && "text-[color:var(--scl-gold)]",
        tone === "win" && "text-[color:var(--scl-win)]",
        tone === "loss" && "text-[color:var(--scl-loss)]",
        tone === "label" && "text-[color:var(--scl-muted-label)]",
        className,
      )}
    >
      {children}
    </span>
  );
}
