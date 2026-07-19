import { Compass } from "lucide-react";

export function DiscoverOverview({
  laneCount,
  publicRecordCount,
}: {
  laneCount: number;
  publicRecordCount: number;
}) {
  return (
    <header className="border-t border-[color:var(--scl-pink-deep)] pt-3 sm:pt-4">
      <div className="flex flex-wrap items-end justify-between gap-x-6 gap-y-3">
        <div>
          <div className="scl-eyebrow flex items-center gap-2 text-[color:var(--scl-muted-data)]">
            <Compass
              className="size-3.5 text-[color:var(--scl-blue)]"
              aria-hidden
            />
            Public evidence directory
          </div>
          <h1 className="scl-display mt-1.5 text-4xl font-bold tracking-[0.02em] sm:text-[2.65rem] sm:leading-none">
            Discover
          </h1>
          <p className="text-muted-foreground mt-2 max-w-3xl text-sm leading-snug sm:text-[0.95rem]">
            Explore cappers through evidence-based views of record,
            verification, specialization, and pricing.
          </p>
        </div>

        <dl className="border-border hidden shrink-0 grid-cols-2 overflow-hidden rounded-[10px] border sm:grid">
          <CompactMetric
            label={laneCount === 1 ? "Evidence lane" : "Evidence lanes"}
            value={laneCount.toLocaleString()}
          />
          <CompactMetric
            label={
              publicRecordCount === 1 ? "Record in scope" : "Records in scope"
            }
            value={publicRecordCount.toLocaleString()}
          />
        </dl>
      </div>
    </header>
  );
}

function CompactMetric({ label, value }: { label: string; value: string }) {
  return (
    <div className="border-border min-w-28 border-r px-4 py-2.5 last:border-r-0">
      <dt className="scl-eyebrow text-[color:var(--scl-muted-label)]">
        {label}
      </dt>
      <dd className="scl-data text-lg font-bold tabular-nums">{value}</dd>
    </div>
  );
}
