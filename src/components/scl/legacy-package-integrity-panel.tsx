import Link from "next/link";
import { AlertTriangle, CheckCircle2, ShieldCheck } from "lucide-react";

import { Button } from "@/components/ui/button";
import type { getLegacyPackageIntegrityForAdmin } from "@/lib/queries/store";
import { cn } from "@/lib/utils";

type Report = Awaited<ReturnType<typeof getLegacyPackageIntegrityForAdmin>>;

export function LegacyPackageIntegrityPanel({ report }: { report: Report }) {
  const healthy = !report.failed && report.errors.length === 0;

  return (
    <section
      className={cn(
        "space-y-4 rounded-xl border p-4 sm:p-5",
        healthy
          ? "border-pos/30 bg-pos/5"
          : "border-destructive/40 bg-destructive/5",
      )}
      aria-labelledby="legacy-package-integrity-title"
    >
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="flex min-w-0 gap-3">
          {healthy ? (
            <CheckCircle2
              className="text-pos mt-0.5 size-5 shrink-0"
              aria-hidden
            />
          ) : (
            <AlertTriangle
              className="text-destructive mt-0.5 size-5 shrink-0"
              aria-hidden
            />
          )}
          <div>
            <h2
              id="legacy-package-integrity-title"
              className="scl-display font-bold tracking-[0.04em] uppercase"
            >
              Legacy package verification
            </h2>
            <p className="text-muted-foreground mt-1 text-sm">
              Live database, checkout, provider, tracking, publication, and
              known-price invariants. Production deploys are blocked when a
              critical check fails.
            </p>
          </div>
        </div>
        <span
          className={cn(
            "rounded-md px-2 py-1 text-xs font-semibold tracking-wide uppercase",
            healthy
              ? "bg-pos/15 text-pos"
              : "bg-destructive/15 text-destructive",
          )}
        >
          {healthy ? "Verified" : "Action required"}
        </span>
      </div>

      <dl className="grid grid-cols-2 gap-2 text-sm sm:grid-cols-4 lg:grid-cols-7">
        {[
          ["Legacy total", report.stats.total],
          ["Active", report.stats.active],
          ["Public", report.stats.publicEligible],
          ["Whop total", report.stats.whop],
          ["Whop active", report.stats.activeWhop],
          ["API synced", report.stats.apiSynced],
          ["Manual / carried", report.stats.manualOrCarried],
        ].map(([label, value]) => (
          <div key={label} className="bg-card rounded-lg border p-2.5">
            <dt className="text-muted-foreground text-xs">{label}</dt>
            <dd className="mt-1 font-bold tabular-nums">{value}</dd>
          </div>
        ))}
      </dl>

      <p className="text-muted-foreground text-sm">
        Count lineage: {report.lineage.sourceTotal} imported +{" "}
        {report.lineage.created} audited additions - {report.lineage.deleted}{" "}
        audited deletions = {report.lineage.expectedTotal} expected;{" "}
        {report.lineage.currentTotal} currently stored.
      </p>

      {report.errors.length ? (
        <div role="alert" className="space-y-1 text-sm">
          <p className="font-semibold">Blocking failures</p>
          <ul className="list-disc space-y-1 pl-5">
            {report.errors.map((error) => (
              <li key={error}>{error}</li>
            ))}
          </ul>
        </div>
      ) : null}

      {report.warnings.length ? (
        <div className="space-y-1 text-sm">
          <p className="font-semibold">Publication differences</p>
          <ul className="text-muted-foreground list-disc space-y-1 pl-5">
            {report.warnings.map((warning) => (
              <li key={warning}>{warning}</li>
            ))}
          </ul>
        </div>
      ) : null}

      <div className="space-y-2">
        <div className="flex items-center gap-2">
          <ShieldCheck className="size-4" aria-hidden />
          <h3 className="text-sm font-semibold">Whop package inventory</h3>
        </div>
        <p className="text-muted-foreground text-sm">
          The original three migrated Whop offers are matched by owner, title,
          provider, active state, and exact checkout URL. Additional manual or
          API-synced Whop offers appear here too.
        </p>
        {report.whopPackages.length ? (
          <ul className="divide-border overflow-hidden rounded-lg border">
            {report.whopPackages.map((pkg) => (
              <li
                key={pkg.id}
                className="bg-card flex flex-wrap items-center justify-between gap-3 px-3 py-2.5"
              >
                <div className="min-w-0">
                  <p className="truncate text-sm font-semibold">
                    @{pkg.username ?? "unknown"} · {pkg.title}
                  </p>
                  <p className="text-muted-foreground mt-0.5 text-xs">
                    {pkg.priceLabel} · {pkg.source} ·{" "}
                    {pkg.active ? "active" : "hidden"}
                    {pkg.publicEligible ? " · public" : " · not public"}
                    {pkg.trackingIntact
                      ? " · tracking intact"
                      : " · tracking mismatch"}
                  </p>
                </div>
                <Button
                  size="sm"
                  variant="outline"
                  className="min-h-10"
                  render={
                    <Link
                      href={`/admin/cappers/${pkg.userId}?packageId=${pkg.id}#manual-package-manager`}
                    />
                  }
                  nativeButton={false}
                >
                  Verify or edit
                </Button>
              </li>
            ))}
          </ul>
        ) : (
          <p className="text-muted-foreground rounded-lg border p-3 text-sm">
            No Whop packages were found.
          </p>
        )}
      </div>
    </section>
  );
}
