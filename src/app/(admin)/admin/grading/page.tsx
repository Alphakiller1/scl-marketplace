import { ClipboardCheck, History, Layers } from "lucide-react";

import { AutoGradeButton } from "@/components/scl/auto-grade-button";
import { SportTag } from "@/components/scl/badges";
import { GradingAuditList } from "@/components/scl/grading-audit-list";
import { ParlayGradeControl } from "@/components/scl/parlay-grade-control";
import { PlayGradeControl } from "@/components/scl/play-grade-control";
import { SectionHeader } from "@/components/scl/section";
import { EmptyState } from "@/components/scl/states";
import { formatOdds, formatUnits } from "@/lib/format";
import {
  getGradingQueue,
  getParlayGradingQueue,
  getRecentGradingAudits,
} from "@/lib/queries/grading";

export const metadata = { title: "Grading" };

export default async function AdminGradingPage() {
  const [queue, parlays, audits] = await Promise.all([
    getGradingQueue(),
    getParlayGradingQueue(),
    getRecentGradingAudits(),
  ]);
  const pendingPositions = queue.length + parlays.length;

  return (
    <div className="space-y-8">
      <section className="space-y-5">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <SectionHeader
            icon={ClipboardCheck}
            title="Grading Queue"
            subtitle={`${pendingPositions} pending ${pendingPositions === 1 ? "position" : "positions"} awaiting a result`}
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
            title={parlays.length ? "No straight plays to grade" : "Nothing to grade"}
            description={
              parlays.length
                ? "Pending parlays are listed below."
                : "Pending positions appear here as cappers submit them."
            }
          />
        )}
      </section>

      {parlays.length ? (
        <section className="space-y-5">
          <SectionHeader
            icon={Layers}
            title="Pending Parlays"
            subtitle={`${parlays.length} awaiting a result — grade each leg`}
          />
          <div className="space-y-3">
            {parlays.map((parlay) => (
              <div
                key={parlay.id}
                className="border-border bg-card rounded-xl border p-4"
              >
                <div className="text-muted-foreground mb-1 flex flex-wrap items-center gap-x-2 text-xs">
                  <span className="text-foreground font-semibold">
                    {parlay.legs.length}-leg parlay
                  </span>
                  <span>{parlay.capperName}</span>
                  {parlay.combinedOddsAmerican != null ? (
                    <span className="nums tabular-nums">
                      {formatOdds(parlay.combinedOddsAmerican)}
                    </span>
                  ) : null}
                  <span className="nums tabular-nums">
                    {formatUnits(parlay.units, true, false)}
                  </span>
                </div>
                <ParlayGradeControl parlay={parlay} />
              </div>
            ))}
          </div>
        </section>
      ) : null}

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
