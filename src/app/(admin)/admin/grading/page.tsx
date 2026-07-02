import { ClipboardCheck, History } from "lucide-react";

import { AutoGradeButton } from "@/components/scl/auto-grade-button";
import { SportTag } from "@/components/scl/badges";
import { GradingAuditList } from "@/components/scl/grading-audit-list";
import { PlayGradeControl } from "@/components/scl/play-grade-control";
import { SectionHeader } from "@/components/scl/section";
import { EmptyState } from "@/components/scl/states";
import { formatOdds, formatUnits } from "@/lib/format";
import { getGradingQueue, getRecentGradingAudits } from "@/lib/queries/grading";

export const metadata = { title: "Grading" };

export default async function AdminGradingPage() {
  const [queue, audits] = await Promise.all([
    getGradingQueue(),
    getRecentGradingAudits(),
  ]);

  return (
    <div className="space-y-8">
      <section className="space-y-5">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <SectionHeader
            icon={ClipboardCheck}
            title="Grading Queue"
            subtitle={`${queue.length} pending ${queue.length === 1 ? "play" : "plays"} awaiting a result`}
          />
          <AutoGradeButton />
        </div>
        {queue.length ? (
          <ul className="divide-border border-border divide-y overflow-hidden rounded-xl border">
            {queue.map((p) => (
              <li
                key={p.id}
                className="bg-card flex flex-col gap-3 p-4 lg:flex-row lg:items-center lg:justify-between"
              >
                <div className="min-w-0">
                  <div className="flex items-center gap-2">
                    <SportTag sport={p.sport} />
                    <span className="text-muted-foreground truncate text-xs">
                      {p.capperName}
                    </span>
                  </div>
                  <p className="mt-1.5 font-semibold break-words">
                    {p.selection}
                  </p>
                  <p className="text-muted-foreground mt-0.5 flex flex-wrap items-center gap-x-2 gap-y-0.5 text-xs">
                    <span>{p.market}</span>
                    <span className="nums tabular-nums">
                      {formatOdds(p.oddsAmerican)}
                    </span>
                    <span className="nums tabular-nums">
                      {formatUnits(p.units, true, false)}
                    </span>
                  </p>
                </div>
                <PlayGradeControl playId={p.id} />
              </li>
            ))}
          </ul>
        ) : (
          <EmptyState
            icon={ClipboardCheck}
            title="Nothing to grade"
            description="Pending plays appear here as cappers submit them."
          />
        )}
      </section>

      <section className="space-y-4">
        <SectionHeader
          icon={History}
          title="Recent Grading Activity"
          subtitle="Append-only audit trail of every grade and override"
        />
        <GradingAuditList items={audits} />
      </section>
    </div>
  );
}
