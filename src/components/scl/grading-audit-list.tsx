import type { GradingSource, Outcome } from "@prisma/client";
import { ArrowRight, History } from "lucide-react";

import { StatusBadge } from "@/components/scl/badges";
import { EmptyState } from "@/components/scl/states";
import type { GradingAuditItem } from "@/lib/queries/grading";

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

const SOURCE_LABEL: Record<GradingSource, string> = {
  AUTO: "Auto",
  ADMIN_OVERRIDE: "Override",
  MANUAL: "Manual",
};

/** Append-only audit trail: each grade/override, previous → new, source, actor, reason. */
export function GradingAuditList({ items }: { items: GradingAuditItem[] }) {
  if (!items.length) {
    return (
      <EmptyState
        icon={History}
        title="No grading activity yet"
        description="Grades and overrides will appear here as plays are settled."
      />
    );
  }

  return (
    <ul className="divide-border border-border divide-y overflow-hidden rounded-xl border">
      {items.map((a) => (
        <li
          key={a.id}
          className="bg-card flex flex-col gap-2 p-3.5 sm:flex-row sm:items-center sm:justify-between"
        >
          <div className="min-w-0">
            <p className="truncate font-medium">{a.selection}</p>
            <p className="text-muted-foreground truncate text-xs">
              {a.capperName} · {a.market}
              {a.reason ? ` · “${a.reason}”` : ""}
            </p>
          </div>
          <div className="flex shrink-0 flex-wrap items-center gap-2 text-xs">
            <StatusBadge status={OUTCOME_TO_STATUS[a.previousOutcome]} />
            <ArrowRight
              className="text-muted-foreground size-3.5"
              aria-hidden
            />
            <StatusBadge status={OUTCOME_TO_STATUS[a.newOutcome]} />
            <span className="text-muted-foreground">
              {SOURCE_LABEL[a.source]} · {a.gradedBy}
            </span>
          </div>
        </li>
      ))}
    </ul>
  );
}
