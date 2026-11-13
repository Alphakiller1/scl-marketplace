import Link from "next/link";
import { Inbox } from "lucide-react";

import { AdminGradeRequestList } from "@/components/scl/admin-grade-request-list";
import { SectionHeader } from "@/components/scl/section";
import {
  ADMIN_REQUEST_LIST_LIMIT,
  countGradeRequestsByStatus,
  listGradeRequests,
  type GradeRequestFilter,
} from "@/lib/queries/grade-requests";
import { requireAdmin } from "@/lib/session";

export const metadata = { title: "Capper Requests" };

const FILTERS: { key: GradeRequestFilter; label: string; empty: string }[] = [
  {
    key: "OPEN",
    label: "Open",
    empty:
      "No open requests. Regrade and injury-protection requests from cappers land here.",
  },
  { key: "RESOLVED", label: "Resolved", empty: "No resolved requests yet." },
  { key: "DECLINED", label: "Declined", empty: "No declined requests." },
  { key: "ALL", label: "All", empty: "No requests yet." },
];

function parseFilter(value: string | string[] | undefined): GradeRequestFilter {
  const raw = (Array.isArray(value) ? value[0] : value)?.toUpperCase();
  return FILTERS.some((filter) => filter.key === raw)
    ? (raw as GradeRequestFilter)
    : "OPEN";
}

export default async function AdminGradeRequestsPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  await requireAdmin();
  const filter = parseFilter((await searchParams).status);
  const [requests, counts] = await Promise.all([
    listGradeRequests(filter),
    countGradeRequestsByStatus(),
  ]);
  const total = counts.OPEN + counts.RESOLVED + counts.DECLINED;
  const countFor = (key: GradeRequestFilter) =>
    key === "ALL" ? total : counts[key];
  const active = FILTERS.find((entry) => entry.key === filter)!;

  return (
    <div className="space-y-6">
      <SectionHeader
        icon={Inbox}
        title="Capper Requests"
        subtitle="Regrade and injury-protection requests sent from cappers' pick history. Open requests are listed oldest first."
        href="/admin/grading"
        hrefLabel="Back to grading"
      />
      <nav className="flex flex-wrap gap-2" aria-label="Filter requests">
        {FILTERS.map((entry) => (
          <Link
            key={entry.key}
            href={
              entry.key === "OPEN"
                ? "/admin/grading/requests"
                : `/admin/grading/requests?status=${entry.key.toLowerCase()}`
            }
            aria-current={filter === entry.key ? "page" : undefined}
            className={
              filter === entry.key
                ? "bg-primary text-primary-foreground inline-flex min-h-10 items-center gap-1.5 rounded-lg px-3 text-sm font-semibold"
                : "border-border bg-card text-muted-foreground hover:text-foreground inline-flex min-h-10 items-center gap-1.5 rounded-lg border px-3 text-sm font-semibold"
            }
          >
            {entry.label}
            <span className="tabular-nums opacity-80">
              {countFor(entry.key)}
            </span>
          </Link>
        ))}
      </nav>
      <AdminGradeRequestList requests={requests} empty={active.empty} />
      {requests.length >= ADMIN_REQUEST_LIST_LIMIT ? (
        <p className="text-muted-foreground text-xs">
          Showing the first {ADMIN_REQUEST_LIST_LIMIT} requests.
        </p>
      ) : null}
    </div>
  );
}
