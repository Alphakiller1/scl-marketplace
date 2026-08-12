import Link from "next/link";
import {
  CheckCircle2,
  Clock,
  History,
  LifeBuoy,
  XCircle,
  Zap,
} from "lucide-react";

import { GradingAuditList } from "@/components/scl/grading-audit-list";
import { AutoGradeButton } from "@/components/scl/auto-grade-button";
import { SportTag } from "@/components/scl/badges";
import { SectionHeader } from "@/components/scl/section";
import { getGradingHealthReport } from "@/lib/grading-health";
import {
  getRecentCronRuns,
  getRecentGradingAudits,
} from "@/lib/queries/grading";
import { getSchemaStatusReport } from "@/lib/results/schema-status";
import {
  countPendingPlays,
  listAgedOutPendingPlays,
} from "@/lib/results/stuck-plays";

export const metadata = { title: "Grading" };

const dateTime = new Intl.DateTimeFormat("en-US", {
  dateStyle: "medium",
  timeStyle: "short",
});

function durationSecs(start: Date | null, end: Date | null): string {
  if (!start || !end) return "—";
  return `${((end.getTime() - start.getTime()) / 1000).toFixed(1)}s`;
}

export default async function AdminGradingPage() {
  const [audits, health, schema, stuck, cronRuns, pendingTotal] =
    await Promise.all([
      getRecentGradingAudits(),
      getGradingHealthReport(),
      getSchemaStatusReport(),
      listAgedOutPendingPlays(),
      getRecentCronRuns(),
      countPendingPlays(),
    ]);

  return (
    <div className="space-y-8">
      <section className="border-border bg-card space-y-3 rounded-xl border p-4">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <SectionHeader
            icon={History}
            title="Pipeline diagnostics"
            subtitle="Cron health, lookback cliff, and schema patch status"
          />
          <AutoGradeButton />
        </div>
        <dl className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <div>
            <dt className="text-muted-foreground text-xs tracking-wide uppercase">
              Health
            </dt>
            <dd className="scl-data mt-1 text-sm font-semibold tabular-nums">
              {health.status}
              <span className="text-muted-foreground ml-2 font-normal">
                ({health.pendingPastExpectedFinal} past expected final /{" "}
                {health.pendingPast24h} &gt;24h)
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
              Ungraded / aged-out
            </dt>
            <dd className="scl-data mt-1 text-sm font-semibold tabular-nums">
              {pendingTotal} / {stuck.length}
            </dd>
          </div>
        </dl>
        {stuck.length ? (
          <ul className="divide-border border-border max-h-64 divide-y overflow-auto rounded-lg border text-sm">
            {stuck.map((p) => (
              <li key={p.id}>
                <Link
                  href={`/admin/plays/straight/${p.id}`}
                  className="hover:bg-surface-2/60 focus-visible:ring-ring flex flex-col gap-1 px-3 py-2 focus-visible:ring-2 focus-visible:outline-none focus-visible:ring-inset"
                >
                  <p className="flex flex-wrap items-center gap-2 font-medium break-words">
                    <SportTag sport={p.sport} markOnly />
                    <span>
                      {p.selection}{" "}
                      <span className="text-muted-foreground font-normal">
                        · {p.market} · {p.sport}
                      </span>
                    </span>
                    <span className="scl-link ml-auto inline-flex items-center gap-1 text-xs">
                      <LifeBuoy className="size-3.5" aria-hidden />
                      Backup override →
                    </span>
                  </p>
                  <p className="text-muted-foreground scl-data text-xs tabular-nums">
                    @{p.handle ?? "?"} · {p.oddsAmerican} · {p.units}U · event{" "}
                    {p.eventId ?? "null"} · start {p.eventStartsAt ?? "null"} ·{" "}
                    {p.id}
                  </p>
                </Link>
              </li>
            ))}
          </ul>
        ) : null}
      </section>

      <section className="space-y-4">
        <SectionHeader
          icon={Zap}
          title="Automated cron runs"
          subtitle="Every 15 min via GitHub Actions — results graded without human input"
        />
        {cronRuns.length === 0 ? (
          <div className="border-border bg-card flex items-center gap-3 rounded-xl border p-5 text-sm">
            <Clock className="text-muted-foreground size-5 shrink-0" />
            <span className="text-muted-foreground">
              No cron runs recorded yet. The first run will appear here after
              the next scheduled execution.
            </span>
          </div>
        ) : (
          <ul className="divide-border border-border divide-y overflow-hidden rounded-xl border">
            {cronRuns.map((run) => (
              <li
                key={run.id}
                className="bg-card flex flex-col gap-2 px-4 py-3 sm:flex-row sm:items-center sm:justify-between"
              >
                <div className="flex min-w-0 items-center gap-3">
                  {run.status === "SUCCESS" ? (
                    <CheckCircle2
                      className="text-pos size-4 shrink-0"
                      aria-label="Success"
                    />
                  ) : run.status === "RUNNING" ? (
                    <Clock
                      className="text-muted-foreground size-4 shrink-0 animate-pulse"
                      aria-label="Running"
                    />
                  ) : (
                    <XCircle
                      className="text-neg size-4 shrink-0"
                      aria-label="Failed"
                    />
                  )}
                  <div className="min-w-0">
                    <p className="text-sm font-medium">
                      {run.status === "RUNNING"
                        ? "Running…"
                        : run.status === "SUCCESS"
                          ? `${run.graded} graded · ${run.skipped} skipped · ${run.parlaysGraded} parlays`
                          : (run.error ?? "Failed")}
                    </p>
                    {run.createdAt && (
                      <p className="text-muted-foreground text-xs tabular-nums">
                        {dateTime.format(run.createdAt)}
                        {run.startedAt && run.finishedAt
                          ? ` · ${durationSecs(run.startedAt, run.finishedAt)}`
                          : null}
                      </p>
                    )}
                  </div>
                </div>
                <span
                  className={`shrink-0 rounded-full px-2 py-0.5 text-xs font-medium ${
                    run.status === "SUCCESS"
                      ? "bg-pos/15 text-pos"
                      : run.status === "RUNNING"
                        ? "bg-muted text-muted-foreground"
                        : "bg-neg/15 text-neg"
                  }`}
                >
                  {run.status}
                </span>
              </li>
            ))}
          </ul>
        )}
      </section>

      <section className="space-y-4">
        <SectionHeader
          icon={History}
          title="Recent Grading Activity"
          subtitle="Append-only audit trail of every grade"
        />
        <GradingAuditList items={audits} />
      </section>
    </div>
  );
}
