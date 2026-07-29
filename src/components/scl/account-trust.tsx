import type { AccountStatus } from "@prisma/client";
import { Check, Clock3, MailCheck, Scale, ShieldCheck } from "lucide-react";

import { cn } from "@/lib/utils";

const statusStyles: Record<AccountStatus, string> = {
  PENDING:
    "border-[color:var(--scl-line)] bg-[color:var(--scl-ink-700)] text-[color:var(--scl-muted-data)]",
  ACTIVE: "border-pos/30 bg-pos/10 text-pos",
  SUSPENDED: "border-neg/30 bg-neg/10 text-neg",
  DISABLED: "border-neg/30 bg-neg/10 text-neg",
};

const statusLabels: Record<AccountStatus, string> = {
  PENDING: "Pending",
  ACTIVE: "Active",
  SUSPENDED: "Suspended",
  DISABLED: "Disabled",
};

export function AccountStatusBadge({ status }: { status: AccountStatus }) {
  return (
    <span
      className={cn(
        "inline-flex min-h-7 items-center rounded-lg border px-2 text-xs font-semibold",
        statusStyles[status],
      )}
    >
      {statusLabels[status]}
    </span>
  );
}

export function AccountTrustSummary({
  status,
  emailVerified,
  acceptedAt,
  policyVersion,
}: {
  status: AccountStatus;
  emailVerified: boolean;
  acceptedAt?: Date | null;
  policyVersion?: string | null;
}) {
  return (
    <section
      aria-labelledby="account-trust-title"
      className="border-border bg-card rounded-xl border p-4"
    >
      <div className="flex items-center justify-between gap-3">
        <div>
          <h2 id="account-trust-title" className="font-semibold">
            Account Trust
          </h2>
          <p className="text-muted-foreground text-sm">
            Access And Policy Standing
          </p>
        </div>
        <AccountStatusBadge status={status} />
      </div>

      <dl className="mt-4 grid gap-2">
        <TrustRow
          icon={MailCheck}
          label="Email"
          value={emailVerified ? "Verified" : "Pending"}
          complete={emailVerified}
        />
        <TrustRow
          icon={Scale}
          label="Policies"
          value={
            acceptedAt
              ? `Accepted ${policyVersion ?? ""}`.trim()
              : "Review Required"
          }
          complete={Boolean(acceptedAt)}
        />
        <TrustRow
          icon={ShieldCheck}
          label="Capper Access"
          value={status === "ACTIVE" ? "Enabled" : "Limited"}
          complete={status === "ACTIVE"}
        />
      </dl>
    </section>
  );
}

function TrustRow({
  icon: Icon,
  label,
  value,
  complete,
}: {
  icon: React.ComponentType<{ className?: string }>;
  label: string;
  value: string;
  complete: boolean;
}) {
  return (
    <div className="bg-surface-2 flex min-h-10 items-center gap-3 rounded-lg px-3">
      <Icon className="text-muted-foreground size-4" aria-hidden />
      <div className="min-w-0 flex-1">
        <dt className="text-muted-foreground text-xs">{label}</dt>
        <dd className="truncate text-sm font-medium">{value}</dd>
      </div>
      {complete ? (
        <Check className="text-pos size-4" aria-hidden />
      ) : (
        <Clock3
          className="size-4 text-[color:var(--scl-muted-label)]"
          aria-hidden
        />
      )}
    </div>
  );
}
