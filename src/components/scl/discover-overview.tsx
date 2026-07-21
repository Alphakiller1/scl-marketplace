import { Compass } from "lucide-react";

export function DiscoverOverview({
  matchedLaneCount,
  totalLaneCount,
  publicRecordCount,
  failed = false,
}: {
  matchedLaneCount: number;
  totalLaneCount: number;
  publicRecordCount: number;
  failed?: boolean;
}) {
  return (
    <header className="scl-section-mark pt-3 sm:pt-4">
      <div className="flex flex-wrap items-end justify-between gap-x-6 gap-y-3">
        <div>
          <div className="scl-eyebrow flex items-center gap-2 text-[color:var(--scl-muted-data)]">
            <Compass
              className="size-3.5 text-[color:var(--scl-blue)]"
              aria-hidden
            />
            Public Evidence Directory
          </div>
          <h1 className="scl-display mt-1.5 text-4xl font-bold tracking-[0.02em] sm:text-[2.65rem] sm:leading-none">
            Discover
          </h1>
          <p className="text-muted-foreground mt-2 max-w-3xl text-sm leading-snug sm:text-[0.95rem]">
            Explore cappers through evidence-based views of record,
            verification, specialization, and pricing.
          </p>
        </div>

        <dl className="hidden shrink-0 grid-cols-2 gap-2 sm:grid">
          <CompactMetric
            label={matchedLaneCount === 1 ? "Matched Lane" : "Matched Lanes"}
            value={
              failed
                ? "—"
                : `${matchedLaneCount.toLocaleString()} / ${totalLaneCount.toLocaleString()}`
            }
          />
          <CompactMetric
            label={
              publicRecordCount === 1 ? "Record In Scope" : "Records In Scope"
            }
            value={failed ? "—" : publicRecordCount.toLocaleString()}
          />
        </dl>
      </div>
    </header>
  );
}

function CompactMetric({ label, value }: { label: string; value: string }) {
  return (
    <div className="border-border min-w-28 overflow-hidden rounded-[12px] border bg-[linear-gradient(165deg,color-mix(in_srgb,var(--scl-ink-700)_88%,#fff_4%)_0%,var(--scl-ink-800)_100%)] px-4 py-2.5 shadow-[inset_0_1px_0_rgba(255,255,255,0.05)]">
      <dt className="scl-eyebrow text-[color:var(--scl-muted-data)]">
        {label}
      </dt>
      <dd className="scl-data text-lg font-bold tabular-nums">{value}</dd>
    </div>
  );
}
