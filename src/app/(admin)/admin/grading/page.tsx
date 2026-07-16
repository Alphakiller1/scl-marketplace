import { ClipboardCheck, History, Layers } from "lucide-react";

import { AutoGradeButton } from "@/components/scl/auto-grade-button";
import { SportTag } from "@/components/scl/badges";
import { GradingAuditList } from "@/components/scl/grading-audit-list";
import { ParlayGradeControl } from "@/components/scl/parlay-grade-control";
import { PlayGradeControl } from "@/components/scl/play-grade-control";
import { SectionHeader } from "@/components/scl/section";
import { EmptyState } from "@/components/scl/states";
import { formatOdds, formatUnits } from "@/lib/format";
import { getGradingHealthReport } from "@/lib/grading-health";
import {
  getGradingQueue,
  getParlayGradingQueue,
  getRecentGradingAudits,
} from "@/lib/queries/grading";
import { getSchemaStatusReport } from "@/lib/results/schema-status";
import { listAgedOutPendingPlays } from "@/lib/results/stuck-plays";

export const metadata = { title: "Grading" };

export default async function AdminGradingPage() {
  const [queue, parlays, audits, health, schema, stuck] = await Promise.all([
    getGradingQueue(),
    getParlayGradingQueue(),
    getRecentGradingAudits(),
    getGradingHealthReport(),
    getSchemaStatusReport(),
    listAgedOutPendingPlays(),
  ]);

  return (
    <div className="space-y-8">
      <section className="border-border bg-card space-y-3 rounded-xl border p-4">
        <SectionHeader
          icon={History}
          title="Pipeline diagnostics"
          subtitle="Cron health, lookback cliff, and Supabase patch status"
        />
        <dl className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <div>
            <dt className="text-muted-foreground text-xs tracking-wide uppercase">
              Health
            </dt>
            <dd className="scl-data mt-1 text-sm font-semibold tabular-nums">
              {health.status}
              <span className="text-muted-foreground ml-2 font-normal">
                ({health.pendingPast24h} pending &gt;24h)
              </span>
            </dd>
          </div>
          <div>
            <dt className="text-muted-foreground text-xs tracking-wide uppercase">
              Cliff risk
            </dt>
            <dd className="scl-data mt-1 text-sm font-semibold tabular-nums">
              {health.cliffRisk}
              <span className="text-muted-foreground ml-2 font-normal">
                past {health.cliffWarningDays}d / lookback {health.lookbackDays}
                d
              </span>
            </dd>
          </div>
          <div>
            <dt className="text-muted-foreground text-xs tracking-wide uppercase">
              Schema patches
            </dt>
            <dd className="scl-data mt-1 text-sm font-semibold">
              {schema.allReady ? "READY" : "INCOMPLETE"}
              <span className="text-muted-foreground mt-1 block text-xs font-normal tracking-normal normal-case">
                notesPublic={String(schema.notesPublic)} clv=
                {String(schema.clvColumns)} usage=
                {String(schema.oddsUsageDaily)}
              </span>
            </dd>
          </div>
          <div>
            <dt className="text-muted-foreground text-xs tracking-wide uppercase">
              Aged-out stuck
            </dt>
            <dd className="scl-data mt-1 text-sm font-semibold tabular-nums">
              {stuck.length}
            </dd>
          </div>
        </dl>
        {stuck.length ? (
          <ul className="divide-border border-border max-h-64 divide-y overflow-auto rounded-lg border text-sm">
            {stuck.map((p) => (
              <li key={p.id} className="px-3 py-2">
                <p className="font-medium break-words">
                  {p.selection}{" "}
                  <span className="text-muted-foreground font-normal">
                    · {p.market} · {p.sport}
                  </span>
                </p>
                <p className="text-muted-foreground scl-data text-xs tabular-nums">
                  @{p.handle ?? "?"} · {p.oddsAmerican} · {p.units}U · event{" "}
                  {p.eventId ?? "null"} · start {p.eventStartsAt ?? "null"} ·{" "}
                  {p.id}
                </p>
              </li>
            ))}
          </ul>
        ) : null}
      </section>

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
