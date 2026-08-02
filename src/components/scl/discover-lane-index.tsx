import type { DiscoverLaneResult } from "@/lib/discover-lanes";

export function DiscoverLaneIndex({
  lanes,
  failed = false,
}: {
  lanes: DiscoverLaneResult[];
  failed?: boolean;
}) {
  return (
    <nav className="mt-4" aria-label="Discover evidence lanes">
      <p className="scl-eyebrow mb-2 text-[color:var(--scl-muted-data)]">
        Choose an evidence lens
      </p>
      <ol className="grid grid-cols-2 border-y border-[color:var(--scl-line)] md:grid-cols-3 lg:grid-cols-5">
        {lanes.map((lane, index) => (
          <li
            key={lane.id}
            className="border-r border-b border-[color:var(--scl-line)] last:col-span-2 last:border-r-0 last:border-b-0 lg:border-b-0 lg:last:col-span-1 md:[&:nth-last-child(-n+2)]:border-b-0"
          >
            <a
              href={`#discover-lane-${lane.id}`}
              className="hover:bg-surface-2/60 focus-visible:ring-ring group flex min-h-[72px] items-center gap-2.5 px-2.5 py-2 outline-none focus-visible:ring-2 focus-visible:ring-inset sm:px-3"
            >
              <span className="scl-data text-xs font-bold text-[color:var(--scl-muted-data)] tabular-nums">
                {String(index + 1).padStart(2, "0")}
              </span>
              <span className="min-w-0 flex-1">
                <span className="scl-display text-foreground block text-xs leading-tight font-bold sm:text-sm">
                  {lane.title}
                </span>
                <span className="text-muted-foreground mt-1 block text-[0.65rem] font-semibold tracking-wide uppercase">
                  {failed ? "Unavailable" : lane.primaryLabel}
                </span>
              </span>
              <span
                className="scl-data text-xs text-[color:var(--scl-muted-data)] tabular-nums transition-transform group-hover:translate-y-0.5"
                aria-hidden
              >
                ↓
              </span>
            </a>
          </li>
        ))}
      </ol>
    </nav>
  );
}
