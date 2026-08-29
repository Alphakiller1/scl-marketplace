import { Activity, Gauge, History, Settings2 } from "lucide-react";

import { AdminOddsControlEditor } from "@/components/scl/admin-odds-control-editor";
import { AdminOddsUsageChart } from "@/components/scl/admin-odds-usage-chart";
import { SectionHeader } from "@/components/scl/section";
import { StatBlock } from "@/components/scl/stat";
import { Card } from "@/components/ui/card";
import { getOddsCreditDashboard } from "@/lib/queries/odds-control";
import { creditLimitState } from "@/lib/odds-control";

export const metadata = { title: "API credits" };

function credits(value: number): string {
  return Math.round(value).toLocaleString();
}

function marketLabel(value: string): string {
  return value
    .replace(/_/g, " ")
    .replace(/\b\w/g, (character) => character.toUpperCase());
}

export default async function AdminOddsPage() {
  const data = await getOddsCreditDashboard();
  const { settings } = data;
  const limitWarnings = [
    {
      label: "daily",
      used: data.summary.today,
      limit: settings.config.dailyCreditLimit,
    },
    {
      label: "weekly",
      used: data.summary.week,
      limit: settings.config.weeklyCreditLimit,
    },
    {
      label: "monthly",
      used: data.summary.month,
      limit: settings.config.monthlyCreditLimit,
    },
  ].filter(
    (window) =>
      creditLimitState(
        window.used,
        window.limit,
        settings.config.warningPercent,
      ) !== "ok",
  );

  return (
    <div className="space-y-8">
      <SectionHeader
        icon={Gauge}
        title="API Credit Control"
        subtitle="See where Odds API credits go, control supported coverage, and enforce owner-defined spending limits"
      />

      <div
        className={`rounded-xl border p-4 text-sm ${
          settings.config.managedSchedulingEnabled
            ? settings.config.paused
              ? "border-border bg-surface-2"
              : "border-border-strong bg-card"
            : "border-border bg-surface-2"
        }`}
        role="status"
      >
        <p className="font-medium">
          {settings.config.managedSchedulingEnabled
            ? settings.config.paused
              ? "Owner-managed scheduling is paused"
              : "Owner-managed scheduling is enabled"
            : "Existing production cadence remains active"}
        </p>
        <p className="text-muted-foreground mt-1">
          {settings.config.managedSchedulingEnabled
            ? "The dispatcher will enforce the settings and limits below."
            : "Dashboard settings cannot alter API calls until an owner explicitly enables managed scheduling."}
        </p>
      </div>

      <section className="grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
        <Card className="p-4">
          <StatBlock
            label="Used today"
            value={credits(data.summary.today)}
            sub="credits"
          />
        </Card>
        <Card className="p-4">
          <StatBlock
            label="Used this week"
            value={credits(data.summary.week)}
            sub="rolling 7 days"
          />
        </Card>
        <Card className="p-4">
          <StatBlock
            label="Used this month"
            value={credits(data.summary.month)}
            sub={`${data.summary.percentUsed.toFixed(1)}% of limit`}
          />
        </Card>
        <Card className="p-4">
          <StatBlock
            label="Provider remaining"
            value={
              data.summary.remaining == null
                ? "Unknown"
                : credits(data.summary.remaining)
            }
          />
        </Card>
        <Card className="p-4">
          <StatBlock
            label="Projected month"
            value={credits(data.summary.projectedMonth)}
            sub={`limit ${credits(settings.config.monthlyCreditLimit)}`}
          />
        </Card>
      </section>

      {limitWarnings.length ? (
        <div
          className="border-border bg-surface-2 rounded-xl border p-4 text-sm"
          role="alert"
        >
          <p className="font-medium">API credit warning</p>
          <p className="text-muted-foreground mt-1">
            {limitWarnings
              .map(
                (window) =>
                  `${window.label}: ${credits(window.used)} of ${credits(window.limit)}`,
              )
              .join(" · ")}
          </p>
        </div>
      ) : null}

      <section className="grid gap-4 lg:grid-cols-[minmax(0,2fr)_minmax(18rem,1fr)]">
        <Card className="space-y-4 p-4 sm:p-5">
          <SectionHeader
            icon={Activity}
            title="30-day usage"
            subtitle="Daily credits across board, verification, results, and CLV calls"
          />
          <AdminOddsUsageChart history={data.history} />
        </Card>
        <Card className="space-y-5 p-4 sm:p-5">
          <div>
            <h2 className="font-semibold">Usage by sport</h2>
            <p className="text-muted-foreground text-xs">Current month</p>
          </div>
          {data.bySport.length ? (
            <div className="space-y-3">
              {data.bySport.map((row) => (
                <div
                  key={row.sport}
                  className="flex items-center justify-between gap-3 text-sm"
                >
                  <span>{row.sport}</span>
                  <span className="nums font-semibold">
                    {credits(row.credits)}
                  </span>
                </div>
              ))}
            </div>
          ) : (
            <p className="text-muted-foreground text-sm">
              No usage recorded this month.
            </p>
          )}
          <div className="border-border border-t pt-4">
            <h3 className="font-semibold">Usage by market</h3>
            <p className="text-muted-foreground mb-3 text-xs">
              Managed runs recorded after activation
            </p>
            {data.byMarket.length ? (
              <div className="max-h-56 space-y-2 overflow-y-auto">
                {data.byMarket.slice(0, 12).map((row) => (
                  <div
                    key={row.market}
                    className="flex items-center justify-between gap-3 text-xs"
                  >
                    <span className="truncate">{marketLabel(row.market)}</span>
                    <span className="nums">{credits(row.credits)}</span>
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-muted-foreground text-sm">
                Market attribution begins with managed runs.
              </p>
            )}
          </div>
        </Card>
      </section>

      <Card className="p-4 sm:p-5">
        <SectionHeader
          icon={Settings2}
          title="Owner controls"
          subtitle="All mutations are validated and enforced on the server"
        />
        <div className="mt-6">
          <AdminOddsControlEditor
            initialConfig={settings.config}
            initialSports={settings.sports}
            storageReady={settings.storageReady}
          />
        </div>
      </Card>

      <section className="grid gap-4 lg:grid-cols-2">
        <Card className="space-y-4 p-4 sm:p-5">
          <SectionHeader icon={History} title="Recent API runs" />
          {data.recentRuns.length ? (
            <div className="divide-border divide-y">
              {data.recentRuns.slice(0, 12).map((run) => (
                <article
                  key={run.id}
                  className="flex items-start justify-between gap-3 py-3 text-sm"
                >
                  <div>
                    <p className="font-medium">
                      {run.sport} · {marketLabel(run.tier)}
                    </p>
                    <p className="text-muted-foreground text-xs">
                      {new Date(run.startedAt).toLocaleString()} · {run.trigger}
                    </p>
                    {run.error ? (
                      <p className="text-neg mt-1 text-xs">{run.error}</p>
                    ) : null}
                  </div>
                  <div className="text-right">
                    <p className="nums font-semibold">{credits(run.credits)}</p>
                    <p className="text-muted-foreground text-xs">
                      {run.status.toLowerCase()}
                    </p>
                  </div>
                </article>
              ))}
            </div>
          ) : (
            <p className="text-muted-foreground text-sm">
              Managed run history begins after activation.
            </p>
          )}
        </Card>
        <Card className="space-y-4 p-4 sm:p-5">
          <SectionHeader icon={History} title="Change activity" />
          {data.audit.length ? (
            <div className="divide-border divide-y">
              {data.audit.slice(0, 12).map((event) => (
                <article key={event.id} className="py-3 text-sm">
                  <p className="font-medium">{marketLabel(event.action)}</p>
                  <p className="text-muted-foreground text-xs">
                    {event.target} · {event.actor} ·{" "}
                    {new Date(event.createdAt).toLocaleString()}
                  </p>
                </article>
              ))}
            </div>
          ) : (
            <p className="text-muted-foreground text-sm">
              No API control changes recorded.
            </p>
          )}
        </Card>
      </section>
    </div>
  );
}
