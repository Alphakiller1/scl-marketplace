import type { Outcome } from "@prisma/client";
import { ArrowRight, History } from "lucide-react";

import { StatusBadge } from "@/components/scl/badges";
import { EmptyState } from "@/components/scl/states";
import { formatUnits } from "@/lib/format";
import type { AdminSettlementAudit } from "@/lib/queries/admin-play-correction";

const OUTCOME_TO_STATUS = {
  PENDING: "pending",
  WIN: "win",
  LOSS: "loss",
  PUSH: "push",
  VOID: "void",
} as const satisfies Record<
  Outcome,
  "pending" | "win" | "loss" | "push" | "void"
>;

const dateTime = new Intl.DateTimeFormat("en-US", {
  dateStyle: "medium",
  timeStyle: "short",
});

function profitLabel(value: number | null, outcome: Outcome) {
  if (value != null) return formatUnits(value);
  return outcome === "PENDING" ? "Open" : "Not captured";
}

export function AdminSettlementAudit({
  audits,
  emptyDescription = "Corrections and grades will appear here after the record is settled.",
}: {
  audits: AdminSettlementAudit[];
  emptyDescription?: string;
}) {
  if (!audits.length) {
    return (
      <EmptyState
        icon={History}
        title="No Settlement History"
        description={emptyDescription}
      />
    );
  }

  return (
    <ol className="divide-border border-border divide-y overflow-hidden rounded-xl border">
      {audits.map((audit) => (
        <li key={audit.id} className="bg-card space-y-3 p-4">
          <div className="flex flex-wrap items-center gap-2">
            <StatusBadge status={OUTCOME_TO_STATUS[audit.previousOutcome]} />
            <span className="scl-data text-muted-foreground tabular-nums">
              {profitLabel(audit.previousProfitUnits, audit.previousOutcome)}
            </span>
            <ArrowRight className="text-muted-foreground size-4" aria-hidden />
            <StatusBadge status={OUTCOME_TO_STATUS[audit.newOutcome]} />
            <span className="scl-data tabular-nums">
              {profitLabel(audit.newProfitUnits, audit.newOutcome)}
            </span>
          </div>
          <p className="text-sm leading-relaxed">
            {audit.reason || "No reason recorded."}
          </p>
          <p className="text-muted-foreground text-xs">
            {audit.source === "ADMIN_OVERRIDE"
              ? "Admin correction"
              : audit.source === "MANUAL"
                ? "Manual grade"
                : "Automatic grade"}
            {" · "}
            {audit.gradedBy}
            {" · "}
            <time dateTime={audit.createdAt.toISOString()}>
              {dateTime.format(audit.createdAt)}
            </time>
          </p>
        </li>
      ))}
    </ol>
  );
}
