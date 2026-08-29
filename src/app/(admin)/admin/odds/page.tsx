import {
  Activity,
  AlertTriangle,
  BarChart3,
  CalendarClock,
  CheckCircle2,
  CircleDollarSign,
  Gauge,
  History,
  PauseCircle,
  Power,
  Settings2,
  ShieldCheck,
  SlidersHorizontal,
} from "lucide-react";

import { AdminOddsControlEditor } from "@/components/scl/admin-odds-control-editor";
import { AdminOddsUsageChart } from "@/components/scl/admin-odds-usage-chart";
import { SectionHeader } from "@/components/scl/section";
import { EmptyState } from "@/components/scl/states";
import { StatBlock } from "@/components/scl/stat";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { creditLimitState } from "@/lib/odds-control";
import { getOddsCreditDashboard } from "@/lib/queries/odds-control";
import { cn } from "@/lib/utils";

export const metadata = { title: "API credits" };

const CAPABILITIES = [
  {
    icon: BarChart3,
    title: "Monitor spend",
    description: "See credit use, allocation, and projected burn.",
  },
  {
    icon: ShieldCheck,
    title: "Set hard limits",
    description: "Cap daily, weekly, and monthly API usage.",
  },
  {
    icon: SlidersHorizontal,
    title: "Choose coverage",
    description: "Select sports, leagues, and market tiers.",
  },
  {
    icon: CalendarClock,
    title: "Control cadence",
    description: "Schedule each sport and coverage tier.",
  },
] as const;

function credits(value: number): string {
  return Math.round(value).toLocaleString();
}

function marketLabel(value: string): string {
  return value
    .replace(/_/g, " ")
    .replace(/\b\w/g, (character) => character.toUpperCase());
}

function BudgetMeter({
  label,
  used,
  limit,
  warningPercent,
}: {
  label: string;
  used: number;
  limit: number;
  warningPercent: number;
}) {
  const state = creditLimitState(used, limit, warningPercent);
  const percent = limit > 0 ? Math.min((used / limit) * 100, 100) : 0;

  return (
    <div className="space-y-2">
      <div className="flex items-end justify-between gap-3 text-sm">
        <span className="font-medium">{label}</span>
        <span className="nums text-muted-foreground text-xs">
          {credits(used)} / {credits(limit)}
        </span>
      </div>
      <div
        className="bg-surface-2 h-2 overflow-hidden rounded-full"
        role="progressbar"
        aria-label={`${label} API credit usage`}
        aria-valuemin={0}
        aria-valuemax={limit}
        aria-valuenow={Math.min(used, limit)}
      >
        <div
          className={cn(
            "h-full rounded-full transition-[width]",
            state === "blocked"
              ? "bg-neg"
              : state === "warning"
                ? "bg-primary"
                : "bg-live",
          )}
          style={{ width: `${percent}%` }}
        />
      </div>
    </div>
  );
}

function RunStatus({ status }: { status: string }) {
  const normalized = status.toLowerCase();
  const successful = normalized === "completed" || normalized === "success";
  const failed = normalized === "failed" || normalized === "error";

  return (
    <Badge
      variant="outline"
      className={cn(
        successful && "border-live/30 bg-live/10 text-live",
        failed && "border-neg/30 bg-neg/10 text-neg",
      )}
    >
      {marketLabel(status)}
    </Badge>
  );
}

export default async function AdminOddsPage() {
  const data = await getOddsCreditDashboard();
  const { settings } = data;
  const controlState = !settings.config.managedSchedulingEnabled
    ? "inactive"
    : settings.config.paused
      ? "paused"
      : "active";
  const limitWarnings = [
    {
      label: "Daily",
      used: data.summary.today,
      limit: settings.config.dailyCreditLimit,
    },
    {
      label: "Weekly",
      used: data.summary.week,
      limit: settings.config.weeklyCreditLimit,
    },
    {
      label: "Monthly",
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
    <div className="space-y-10">
      <header className="space-y-2">
        <p className="text-muted-foreground text-xs font-semibold tracking-[0.16em] uppercase">
          Admin operations
        </p>
        <h1 className="scl-display text-3xl font-semibold tracking-tight sm:text-4xl">
          API Credit Control
        </h1>
        <p className="text-muted-foreground max-w-3xl text-sm sm:text-base">
          Decide what SCL pulls, how often it refreshes, and how much it can
          spend—without changing backend code.
        </p>
      </header>

      <nav
        aria-label="API credit dashboard sections"
        className="border-border bg-card sticky top-[calc(4rem+env(safe-area-inset-top))] z-20 -mx-4 flex gap-1 overflow-x-auto border-y px-4 py-2 sm:mx-0 sm:rounded-xl sm:border"
      >
        {[
          ["Usage", "#usage"],
          ["Guardrails", "#controls"],
          ["Sports & markets", "#sports"],
          ["Activity", "#activity"],
        ].map(([label, href]) => (
          <a
            key={href}
            href={href}
            className="hover:bg-surface-2 focus-visible:ring-ring shrink-0 rounded-lg px-3 py-2 text-sm font-medium focus-visible:ring-2 focus-visible:outline-none"
          >
            {label}
          </a>
        ))}
      </nav>

      <section aria-labelledby="control-status-heading">
        <Card className="overflow-hidden p-0">
          <div className="grid lg:grid-cols-[minmax(18rem,0.8fr)_minmax(0,1.6fr)]">
            <div className="border-border space-y-4 border-b p-5 sm:p-6 lg:border-r lg:border-b-0">
              <div className="flex items-start justify-between gap-4">
                <div className="space-y-2">
                  <p className="text-muted-foreground text-xs font-semibold tracking-wide uppercase">
                    Scheduling authority
                  </p>
                  <h2
                    id="control-status-heading"
                    className="text-xl font-semibold"
                  >
                    {controlState === "active"
                      ? "Owner controls are active"
                      : controlState === "paused"
                        ? "API pulls are paused"
                        : "Production cadence is unchanged"}
                  </h2>
                </div>
                <span
                  className={cn(
                    "grid size-10 shrink-0 place-items-center rounded-full",
                    controlState === "active" && "bg-live/10 text-live",
                    controlState === "paused" && "bg-primary/10 text-primary",
                    controlState === "inactive" &&
                      "bg-surface-2 text-muted-foreground",
                  )}
                  aria-hidden="true"
                >
                  {controlState === "active" ? (
                    <CheckCircle2 className="size-5" />
                  ) : controlState === "paused" ? (
                    <PauseCircle className="size-5" />
                  ) : (
                    <Power className="size-5" />
                  )}
                </span>
              </div>
              <p className="text-muted-foreground text-sm leading-6">
                {controlState === "active"
                  ? "The dispatcher is enforcing the limits, coverage, and schedules configured below."
                  : controlState === "paused"
                    ? "Owner-managed scheduling remains enabled, but new managed API runs are stopped."
                    : "Saved settings are in preview only. Enable owner-managed scheduling when the strategy is ready."}
              </p>
              <Badge
                variant={controlState === "active" ? "default" : "outline"}
                className="uppercase"
              >
                {controlState}
              </Badge>
            </div>

            <div className="grid sm:grid-cols-2">
              {CAPABILITIES.map((capability) => {
                const Icon = capability.icon;
                return (
                  <article
                    key={capability.title}
                    className="border-border border-b p-5 last:border-b-0 sm:[&:nth-child(odd)]:border-r sm:[&:nth-last-child(-n+2)]:border-b-0"
                  >
                    <Icon className="text-primary mb-3 size-5" aria-hidden />
                    <h3 className="font-semibold">{capability.title}</h3>
                    <p className="text-muted-foreground mt-1 text-sm">
                      {capability.description}
                    </p>
                  </article>
                );
              })}
            </div>
          </div>
        </Card>
      </section>

      <section id="usage" className="scroll-mt-24 space-y-5">
        <SectionHeader
          icon={Gauge}
          title="Usage & budget"
          subtitle="Current consumption, limits, and the expected month-end burn"
        />

        {limitWarnings.length ? (
          <div
            className="border-primary/30 bg-primary/10 rounded-xl border p-4 text-sm"
            role="alert"
          >
            <div className="flex gap-3">
              <AlertTriangle
                className="text-primary mt-0.5 size-5 shrink-0"
                aria-hidden
              />
              <div>
                <p className="font-semibold">Credit limit needs attention</p>
                <p className="text-muted-foreground mt-1">
                  {limitWarnings
                    .map(
                      (window) =>
                        `${window.label}: ${credits(window.used)} of ${credits(window.limit)}`,
                    )
                    .join(" · ")}
                </p>
              </div>
            </div>
          </div>
        ) : null}

        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-5">
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
        </div>

        <div className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_minmax(20rem,0.55fr)]">
          <Card className="space-y-5 p-4 sm:p-5">
            <SectionHeader
              icon={Activity}
              title="30-day usage"
              subtitle="Board, verification, results, and CLV calls"
            />
            <AdminOddsUsageChart history={data.history} />
          </Card>

          <Card className="space-y-5 p-4 sm:p-5">
            <div>
              <h3 className="font-semibold">Budget guardrails</h3>
              <p className="text-muted-foreground mt-1 text-xs">
                The dispatcher blocks new managed runs at 100%.
              </p>
            </div>
            <BudgetMeter
              label="Daily"
              used={data.summary.today}
              limit={settings.config.dailyCreditLimit}
              warningPercent={settings.config.warningPercent}
            />
            <BudgetMeter
              label="Weekly"
              used={data.summary.week}
              limit={settings.config.weeklyCreditLimit}
              warningPercent={settings.config.warningPercent}
            />
            <BudgetMeter
              label="Monthly"
              used={data.summary.month}
              limit={settings.config.monthlyCreditLimit}
              warningPercent={settings.config.warningPercent}
            />
          </Card>
        </div>

        <div className="grid gap-4 lg:grid-cols-2">
          <Card className="space-y-4 p-4 sm:p-5">
            <div>
              <h3 className="font-semibold">Credits by sport</h3>
              <p className="text-muted-foreground text-xs">Current month</p>
            </div>
            {data.bySport.length ? (
              <div className="divide-border divide-y">
                {data.bySport.map((row) => (
                  <div
                    key={row.sport}
                    className="flex items-center justify-between gap-3 py-3 text-sm"
                  >
                    <span>{row.sport}</span>
                    <span className="nums font-semibold">
                      {credits(row.credits)}
                    </span>
                  </div>
                ))}
              </div>
            ) : (
              <EmptyState
                icon={CircleDollarSign}
                title="No sport usage yet"
                description="Credit usage will appear after API runs are recorded."
                headingLevel="h3"
              />
            )}
          </Card>

          <Card className="space-y-4 p-4 sm:p-5">
            <div>
              <h3 className="font-semibold">Credits by market</h3>
              <p className="text-muted-foreground text-xs">
                Estimated allocation from managed runs
              </p>
            </div>
            {data.byMarket.length ? (
              <div className="divide-border max-h-80 divide-y overflow-y-auto">
                {data.byMarket.slice(0, 12).map((row) => (
                  <div
                    key={row.market}
                    className="flex items-center justify-between gap-3 py-3 text-sm"
                  >
                    <span className="truncate">{marketLabel(row.market)}</span>
                    <span className="nums font-semibold">
                      {credits(row.credits)}
                    </span>
                  </div>
                ))}
              </div>
            ) : (
              <EmptyState
                icon={SlidersHorizontal}
                title="No market attribution yet"
                description="Market-level attribution begins with managed API runs."
                headingLevel="h3"
              />
            )}
          </Card>
        </div>
      </section>

      <section id="controls" className="scroll-mt-24 space-y-5">
        <SectionHeader
          icon={Settings2}
          title="Owner strategy"
          subtitle="Set authority, guardrails, coverage, and refresh cadence"
        />
        <AdminOddsControlEditor
          initialConfig={settings.config}
          initialSports={settings.sports}
          storageReady={settings.storageReady}
        />
      </section>

      <section id="activity" className="scroll-mt-24 space-y-5">
        <SectionHeader
          icon={History}
          title="Activity & change history"
          subtitle="Confirm what ran, what it cost, and who changed the strategy"
        />
        <div className="grid gap-4 lg:grid-cols-2">
          <Card className="space-y-4 p-4 sm:p-5">
            <div>
              <h3 className="font-semibold">Recent API runs</h3>
              <p className="text-muted-foreground text-xs">
                Latest managed requests and actual credit cost
              </p>
            </div>
            {data.recentRuns.length ? (
              <div className="divide-border divide-y">
                {data.recentRuns.slice(0, 12).map((run) => (
                  <article key={run.id} className="space-y-2 py-3 text-sm">
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <p className="font-medium">
                          {run.sport} · {marketLabel(run.tier)}
                        </p>
                        <p className="text-muted-foreground text-xs">
                          {new Date(run.startedAt).toLocaleString()} ·{" "}
                          {marketLabel(run.trigger)}
                        </p>
                      </div>
                      <RunStatus status={run.status} />
                    </div>
                    <div className="text-muted-foreground flex justify-between gap-3 text-xs">
                      <span>Actual credits</span>
                      <span className="nums text-foreground font-semibold">
                        {credits(run.credits)}
                      </span>
                    </div>
                    {run.error ? (
                      <p className="text-neg text-xs">{run.error}</p>
                    ) : null}
                  </article>
                ))}
              </div>
            ) : (
              <EmptyState
                icon={Activity}
                title="No managed runs yet"
                description="Run history begins after owner-managed scheduling is activated."
                headingLevel="h3"
              />
            )}
          </Card>

          <Card className="space-y-4 p-4 sm:p-5">
            <div>
              <h3 className="font-semibold">Strategy changes</h3>
              <p className="text-muted-foreground text-xs">
                Audit trail for API control updates
              </p>
            </div>
            {data.audit.length ? (
              <div className="divide-border divide-y">
                {data.audit.slice(0, 12).map((event) => (
                  <article key={event.id} className="py-3 text-sm">
                    <p className="font-medium">{marketLabel(event.action)}</p>
                    <p className="text-muted-foreground mt-1 text-xs">
                      {event.target} · {event.actor} ·{" "}
                      {new Date(event.createdAt).toLocaleString()}
                    </p>
                  </article>
                ))}
              </div>
            ) : (
              <EmptyState
                icon={History}
                title="No strategy changes"
                description="Saved API control updates will appear here."
                headingLevel="h3"
              />
            )}
          </Card>
        </div>
      </section>
    </div>
  );
}
