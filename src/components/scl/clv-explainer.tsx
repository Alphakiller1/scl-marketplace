import { CLV_EXPLAINER_LONG, CLV_TOOLTIP_SHORT } from "@/lib/clv";
import { cn } from "@/lib/utils";

/**
 * CLV footnote — short definition always visible; full explainer
 * collapsed behind disclosure on mobile (<lg). Desktop shows full copy.
 */
export function ClvExplainer({ className }: { className?: string }) {
  const base = cn("text-muted-foreground text-xs leading-relaxed", className);

  return (
    <div className={base}>
      <p className="hidden lg:block">
        <span className="font-semibold tracking-wide uppercase">
          Closing Line
        </span>
        {" — "}
        <span title={CLV_TOOLTIP_SHORT}>{CLV_EXPLAINER_LONG}</span>
      </p>

      <details className="group lg:hidden">
        <summary className="cursor-pointer list-none rounded-md py-1.5 outline-none focus-visible:ring-2 focus-visible:ring-[color:var(--scl-blue)] [&::-webkit-details-marker]:hidden">
          <span className="font-semibold tracking-wide uppercase">
            Closing Line
          </span>
          {" — "}
          <span>{CLV_TOOLTIP_SHORT}</span>
          <span className="text-muted-foreground ml-1.5 underline decoration-dotted underline-offset-2 group-open:hidden">
            More
          </span>
          <span className="text-muted-foreground ml-1.5 hidden underline decoration-dotted underline-offset-2 group-open:inline">
            Less
          </span>
        </summary>
        <p className="mt-2 border-t border-[color:var(--scl-line)] pt-2">
          {CLV_EXPLAINER_LONG}
        </p>
      </details>
    </div>
  );
}
