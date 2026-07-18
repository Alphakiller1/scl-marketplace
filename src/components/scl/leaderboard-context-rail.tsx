import { Info, ShieldCheck } from "lucide-react";

import { LEADERBOARD_SORTS } from "@/lib/constants";
import type { LeaderboardFilters } from "@/lib/leaderboard";

export function LeaderboardContextRail({
  filters,
}: {
  filters: LeaderboardFilters;
}) {
  const rankLabel =
    LEADERBOARD_SORTS.find((sort) => sort.key === filters.sort)?.label ?? "ROI";

  return (
    <aside className="space-y-3" aria-label="Leaderboard guidance">
      <RailCard title="How ranking works" icon={Info}>
        <p>
          This view is ranked by {rankLabel} within the selected time, sport,
          verification, and sample scope. Ties are broken by Units, then Win
          Rate.
        </p>
        <p className="mt-3">
          Past performance is not a guarantee of future results.
        </p>
      </RailCard>

      <RailCard title="Sample maturity">
        <dl className="space-y-3">
          <MaturityDefinition
            color="var(--scl-perf-strong)"
            term="Established"
            count="50+ graded picks"
            meaning="A longer tracked record."
          />
          <MaturityDefinition
            color="var(--scl-perf-mid)"
            term="Developing"
            count="10–49 graded picks"
            meaning="A growing tracked record."
          />
          <MaturityDefinition
            color="var(--scl-perf-mid)"
            term="Early"
            count="0–9 graded picks"
            meaning="A new, provisional record."
          />
        </dl>
      </RailCard>

      <RailCard title="Verified records" icon={ShieldCheck} pink>
        <p>
          Verified means the submission was board-checked when logged. It does
          not mean the pick won.
        </p>
        {filters.verifiedOnly ? (
          <p className="text-foreground mt-3 font-semibold">
            Verified only — unverified records are not shown.
          </p>
        ) : (
          <p className="mt-3">
            The pink meter shows each capper’s board-verified share in this
            scope.
          </p>
        )}
      </RailCard>
    </aside>
  );
}

function RailCard({
  title,
  icon: Icon,
  pink = false,
  children,
}: {
  title: string;
  icon?: React.ComponentType<{ className?: string; "aria-hidden"?: boolean }>;
  pink?: boolean;
  children: React.ReactNode;
}) {
  return (
    <section className="border-border bg-card rounded-[var(--scl-radius-card)] border p-4">
      <h2 className="flex items-center gap-2 text-sm font-semibold">
        {Icon ? (
          <Icon
            className={
              pink
                ? "size-4 text-[color:var(--scl-pink)]"
                : "text-muted-foreground size-4"
            }
            aria-hidden
          />
        ) : null}
        {title}
      </h2>
      <div className="text-muted-foreground mt-2 text-sm leading-relaxed">
        {children}
      </div>
    </section>
  );
}

function MaturityDefinition({
  color,
  term,
  count,
  meaning,
}: {
  color: string;
  term: string;
  count: string;
  meaning: string;
}) {
  return (
    <div className="grid grid-cols-[0.5rem_1fr] gap-2">
      <span
        className="mt-1.5 size-2 rounded-full"
        style={{ backgroundColor: color }}
        aria-hidden
      />
      <div>
        <dt className="text-foreground font-semibold">{term}</dt>
        <dd>
          <span className="scl-data tabular-nums">{count}</span> · {meaning}
        </dd>
      </div>
    </div>
  );
}
