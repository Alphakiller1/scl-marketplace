import { CLV_EXPLAINER_LONG, CLV_TOOLTIP_SHORT } from "@/lib/clv";

/** Short CLV footnote for capper profile Performance. */
export function ClvExplainer({ className }: { className?: string }) {
  return (
    <p
      className={
        className ?? "text-muted-foreground mt-2 text-xs leading-relaxed"
      }
    >
      <span className="font-semibold tracking-wide uppercase">
        Closing Line
      </span>
      {" — "}
      <span title={CLV_TOOLTIP_SHORT}>{CLV_EXPLAINER_LONG}</span>
    </p>
  );
}
