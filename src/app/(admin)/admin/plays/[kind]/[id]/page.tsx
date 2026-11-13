import Link from "next/link";
import {
  History,
  Inbox,
  Layers,
  LifeBuoy,
  ListChecks,
  Users,
  Zap,
} from "lucide-react";
import { notFound, redirect } from "next/navigation";

import {
  AdminBulkCorrection,
  type BulkCorrectionSource,
} from "@/components/scl/admin-bulk-correction";
import { AdminGradeCorrection } from "@/components/scl/admin-grade-correction";
import { AdminGradeRequestReview } from "@/components/scl/admin-grade-request-review";
import { AdminSettlementAudit } from "@/components/scl/admin-settlement-audit";
import { PickTierBadge, SportTag, StatusBadge } from "@/components/scl/badges";
import { SectionHeader } from "@/components/scl/section";
import { formatOdds, formatUnits } from "@/lib/format";
import { adminGradingHref } from "@/lib/admin-grading-link";
import { prisma } from "@/lib/prisma";
import { requireAdmin } from "@/lib/session";
import {
  getAdminParlayCorrectionRecord,
  getAdminStraightCorrectionRecord,
} from "@/lib/queries/admin-play-correction";
import { loadCorrectionCandidates } from "@/lib/queries/bulk-correction";
import { listGradeRequestsForPick } from "@/lib/queries/grade-requests";

export const metadata = { title: "Settlement review" };

const dateTime = new Intl.DateTimeFormat("en-US", {
  dateStyle: "medium",
  timeStyle: "short",
});

const OUTCOME_TO_STATUS = {
  PENDING: "pending",
  WIN: "win",
  LOSS: "loss",
  PUSH: "push",
  VOID: "void",
} as const;

export default async function AdminPlayCorrectionPage({
  params,
  searchParams,
}: {
  params: Promise<{ kind: string; id: string }>;
  searchParams?: Promise<Record<string, string | string[] | undefined>>;
}) {
  const { kind, id } = await params;
  if (kind !== "straight" && kind !== "parlay") notFound();
  await requireAdmin();

  // Repair bookmarks and already-open queue links generated before legs were
  // routed to their parent ticket. Authorize before looking up any play.
  if (kind === "straight") {
    const play = await prisma.play.findUnique({
      where: { id },
      select: { id: true, parlayId: true },
    });
    if (play?.parlayId) redirect(adminGradingHref(play));
  }

  const record =
    kind === "straight"
      ? await getAdminStraightCorrectionRecord(id)
      : await getAdminParlayCorrectionRecord(id);
  if (!record) notFound();

  const query = searchParams ? await searchParams : {};
  const requestParam = Array.isArray(query.request)
    ? query.request[0]
    : query.request;
  const sourceIds =
    record.kind === "straight" ? [record.id] : record.legs.map((leg) => leg.id);
  const [requests, candidates] = await Promise.all([
    listGradeRequestsForPick({ kind: record.kind, id: record.id }),
    loadCorrectionCandidates(sourceIds),
  ]);
  // The request the admin arrived from (email link), else the oldest open one.
  const focusRequest =
    requests.find((request) => request.id === requestParam) ??
    requests.find((request) => request.status === "OPEN") ??
    null;
  const bulkSources: BulkCorrectionSource[] = sourceIds.flatMap(
    (sourceId, index) => {
      const found = candidates.get(sourceId);
      if (!found) return [];
      const leg =
        record.kind === "parlay"
          ? record.legs.find((candidate) => candidate.id === sourceId)
          : null;
      return [
        {
          sourceId,
          label: leg
            ? `Leg ${index + 1}: ${leg.selection} (${leg.market})`
            : record.kind === "straight"
              ? record.selection
              : sourceId,
          ...found,
        },
      ];
    },
  );
  const initialSourceId =
    focusRequest?.status === "OPEN" && focusRequest.legId
      ? focusRequest.legId
      : (sourceIds[0] ?? "");

  const recordLabel =
    record.kind === "straight"
      ? record.selection
      : `${record.legs.length}-leg parlay`;
  const username = record.username?.replace(/^@/, "");

  return (
    <div className="space-y-6">
      <SectionHeader
        icon={ListChecks}
        title="Settlement Review"
        subtitle="Play details and grading history"
        href="/admin/plays?status=graded"
        hrefLabel="Back to published plays"
      />

      <section className="border-border bg-card space-y-4 rounded-xl border p-4 sm:p-5">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
          <div className="min-w-0">
            <p className="text-muted-foreground text-xs tracking-wide uppercase">
              {record.kind === "straight" ? "Straight play" : "Parlay"}
            </p>
            <h1 className="mt-1 text-xl font-semibold break-words">
              {recordLabel}
            </h1>
            <p className="text-muted-foreground mt-1 text-sm">
              {username ? (
                <Link href={`/cappers/${username}`} className="scl-link">
                  {record.capperName}
                </Link>
              ) : (
                record.capperName
              )}
              {" · "}
              Published{" "}
              <time dateTime={record.createdAt.toISOString()}>
                {dateTime.format(record.createdAt)}
              </time>
            </p>
          </div>
          <StatusBadge status={OUTCOME_TO_STATUS[record.outcome]} />
        </div>

        <dl className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <div className="bg-surface-2 rounded-lg p-3">
            <dt className="text-muted-foreground text-xs tracking-wide uppercase">
              Stake
            </dt>
            <dd className="scl-data mt-1 font-semibold tabular-nums">
              {formatUnits(record.units, true, false)}
            </dd>
          </div>
          <div className="bg-surface-2 rounded-lg p-3">
            <dt className="text-muted-foreground text-xs tracking-wide uppercase">
              Stored profit
            </dt>
            <dd className="scl-data mt-1 font-semibold tabular-nums">
              {record.profitUnits == null
                ? "Open"
                : formatUnits(record.profitUnits)}
            </dd>
          </div>
          <div className="bg-surface-2 rounded-lg p-3">
            <dt className="text-muted-foreground text-xs tracking-wide uppercase">
              Price
            </dt>
            <dd className="scl-data mt-1 font-semibold tabular-nums">
              {record.kind === "straight"
                ? formatOdds(record.oddsAmerican)
                : record.combinedOddsAmerican == null
                  ? "Unavailable"
                  : formatOdds(record.combinedOddsAmerican)}
            </dd>
          </div>
          <div className="bg-surface-2 rounded-lg p-3">
            <dt className="text-muted-foreground text-xs tracking-wide uppercase">
              Last settled
            </dt>
            <dd className="mt-1 text-sm font-semibold">
              {record.gradedAt
                ? dateTime.format(record.gradedAt)
                : "Not graded"}
            </dd>
          </div>
        </dl>

        {record.kind === "straight" ? (
          <div className="flex flex-wrap items-center gap-2 text-sm">
            <SportTag sport={record.sport} />
            <span>{record.market}</span>
            <PickTierBadge tier={record.verificationTier} />
          </div>
        ) : null}
      </section>

      {record.kind === "parlay" ? (
        <section className="space-y-4">
          <SectionHeader
            icon={Layers}
            title="Parlay Legs"
            subtitle="The parent result and profit are recalculated from these component outcomes"
          />
          <ol className="divide-border border-border divide-y overflow-hidden rounded-xl border">
            {record.legs.map((leg, index) => (
              <li
                key={leg.id}
                className="bg-card flex flex-col gap-3 p-4 sm:flex-row sm:items-center sm:justify-between"
              >
                <div className="min-w-0">
                  <div className="flex items-center gap-2">
                    <SportTag sport={leg.sport} />
                    <span className="text-muted-foreground text-xs">
                      Leg {index + 1}
                    </span>
                  </div>
                  <p className="mt-1 font-medium break-words">
                    {leg.selection}
                  </p>
                  <p className="text-muted-foreground text-xs">
                    {leg.market} ·{" "}
                    <span className="tabular-nums">
                      {formatOdds(leg.oddsAmerican)}
                    </span>
                  </p>
                </div>
                <StatusBadge status={OUTCOME_TO_STATUS[leg.outcome]} />
              </li>
            ))}
          </ol>
        </section>
      ) : null}

      {record.outcome === "PENDING" ? (
        <section className="border-border bg-card flex items-start gap-3 rounded-xl border p-5">
          <Zap className="text-muted-foreground mt-0.5 size-5 shrink-0" />
          <div>
            <h2 className="font-semibold">Awaiting auto-grade</h2>
            <p className="text-muted-foreground mt-1 text-sm">
              Automatic grading retries pending plays when final results are
              available. If this play is stale or needs a book-specific ruling,
              review the result and use the override below.
            </p>
          </div>
        </section>
      ) : null}

      {requests.length ? (
        <section id="capper-requests" className="scroll-mt-24 space-y-4">
          <SectionHeader
            icon={Inbox}
            title="Capper Requests"
            subtitle="What the capper asked for and why. Applying a correction below resolves the requests it answers."
            href="/admin/grading/requests"
            hrefLabel="All open requests"
          />
          <div className="space-y-3">
            {requests.map((request) => (
              <AdminGradeRequestReview
                key={request.id}
                request={request}
                highlighted={request.id === focusRequest?.id}
              />
            ))}
          </div>
        </section>
      ) : null}

      {bulkSources.length ? (
        <section id="correct" className="scroll-mt-24 space-y-4">
          <SectionHeader
            icon={Users}
            title="Correct this pick"
            subtitle="Settle a stale play or fix a mis-grade — for this capper only, or for every capper who logged the same pick. Every change is logged with a required reason."
          />
          <AdminBulkCorrection
            key={`${record.kind}-${record.id}`}
            kind={record.kind}
            sources={bulkSources}
            initialSourceId={initialSourceId}
            initialOutcome={
              focusRequest?.status === "OPEN" &&
              focusRequest.type === "INJURY_PROTECTION"
                ? "VOID"
                : undefined
            }
          />
        </section>
      ) : null}

      {record.kind === "parlay" ? (
        <section className="space-y-4">
          <SectionHeader
            icon={LifeBuoy}
            title="Edit several legs on this ticket"
            subtitle="Set each leg's result on this ticket only, in one save. Review the result before saving; every change is logged with a required reason."
          />
          <AdminGradeCorrection
            kind="parlay"
            id={record.id}
            outcome={record.outcome}
            profitUnits={record.profitUnits}
            units={record.units}
            legs={record.legs.map((leg) => ({
              id: leg.id,
              selection: leg.selection,
              market: leg.market,
              oddsAmerican: leg.oddsAmerican,
              outcome: leg.outcome,
            }))}
          />
        </section>
      ) : null}

      <section className="space-y-4">
        <SectionHeader
          icon={History}
          title="Immutable Settlement History"
          subtitle={
            record.kind === "parlay"
              ? "Parent-level calculations, administrator, reason, and timestamp"
              : "Every result and profit change, including the value it replaced"
          }
        />
        <AdminSettlementAudit audits={record.audits} />
      </section>

      {record.kind === "parlay" &&
      record.legs.some((leg) => leg.audits.length) ? (
        <section className="space-y-4">
          <SectionHeader
            icon={ListChecks}
            title="Leg Audit Detail"
            subtitle="Component-level outcome changes supporting the parent settlement"
          />
          <div className="space-y-3">
            {record.legs.map((leg, index) =>
              leg.audits.length ? (
                <details
                  key={leg.id}
                  className="border-border bg-card rounded-xl border p-4"
                >
                  <summary className="min-h-10 cursor-pointer font-medium">
                    Leg {index + 1}: {leg.selection} ({leg.audits.length})
                  </summary>
                  <div className="mt-3">
                    <AdminSettlementAudit audits={leg.audits} />
                  </div>
                </details>
              ) : null,
            )}
          </div>
        </section>
      ) : null}
    </div>
  );
}
