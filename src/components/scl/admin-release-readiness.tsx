import { AlertTriangle, CheckCircle2, CircleX, Rocket } from "lucide-react";

import { Card } from "@/components/ui/card";
import { SectionHeader } from "@/components/scl/section";
import type {
  ReleaseCheckStatus,
  ReleaseReadinessCheck,
} from "@/lib/release-readiness";
import { cn } from "@/lib/utils";

const STATUS_META: Record<
  ReleaseCheckStatus,
  { label: string; icon: typeof CheckCircle2; className: string }
> = {
  ready: {
    label: "Ready",
    icon: CheckCircle2,
    className: "text-[color:var(--scl-perf-win-text)]",
  },
  warning: {
    label: "Review",
    icon: AlertTriangle,
    className: "text-amber-500",
  },
  blocked: {
    label: "Blocked",
    icon: CircleX,
    className: "text-[color:var(--scl-perf-loss-text)]",
  },
};

export function AdminReleaseReadiness({
  checks,
  summary,
}: {
  checks: ReleaseReadinessCheck[];
  summary: { ready: number; warning: number; blocked: number };
}) {
  return (
    <section className="space-y-4" aria-labelledby="launch-readiness-title">
      <SectionHeader
        icon={Rocket}
        title="Launch readiness"
        subtitle="Live checks for production configuration, security, schema, and storefront integrity"
      />
      <Card className="overflow-hidden">
        <div className="border-border bg-surface-2 flex flex-wrap items-center justify-between gap-3 border-b px-4 py-3">
          <div>
            <h2 id="launch-readiness-title" className="font-semibold">
              Release gate
            </h2>
            <p className="text-muted-foreground text-sm">
              Resolve every blocked item before production launch.
            </p>
          </div>
          <div className="flex flex-wrap gap-2 text-xs font-semibold">
            <span className="rounded-full border border-emerald-500/30 px-2.5 py-1 text-[color:var(--scl-perf-win-text)]">
              {summary.ready} ready
            </span>
            <span className="rounded-full border border-amber-500/30 px-2.5 py-1 text-amber-500">
              {summary.warning} review
            </span>
            <span className="rounded-full border border-red-500/30 px-2.5 py-1 text-[color:var(--scl-perf-loss-text)]">
              {summary.blocked} blocked
            </span>
          </div>
        </div>
        <div className="divide-border divide-y">
          {checks.map((check) => {
            const meta = STATUS_META[check.status];
            const Icon = meta.icon;
            return (
              <div
                key={check.id}
                className="grid gap-2 px-4 py-3 sm:grid-cols-[10rem_1fr_auto] sm:items-center"
              >
                <p className="text-sm font-semibold">{check.label}</p>
                <p className="text-muted-foreground text-sm leading-relaxed">
                  {check.detail}
                </p>
                <span
                  className={cn(
                    "inline-flex w-fit items-center gap-1.5 text-xs font-semibold",
                    meta.className,
                  )}
                >
                  <Icon className="size-4" aria-hidden />
                  {meta.label}
                </span>
              </div>
            );
          })}
        </div>
      </Card>
    </section>
  );
}
