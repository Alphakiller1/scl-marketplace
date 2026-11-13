import Link from "next/link";
import type { GradeRequestStatus, GradeRequestType } from "@prisma/client";
import { ArrowRight, MailWarning, RefreshCcw, ShieldPlus } from "lucide-react";

import {
  formatRequestDateTime,
  formatRequestGameDate,
  GRADE_REQUEST_STATUS_LABEL,
  GRADE_REQUEST_SUBJECT,
  resultLabel,
} from "@/lib/grade-requests";
import { profitUnitsEqual } from "@/lib/grading-correction";
import type { AdminGradeRequest } from "@/lib/queries/grade-requests";
import { cn } from "@/lib/utils";

const TYPE_ICON: Record<GradeRequestType, typeof RefreshCcw> = {
  REGRADE: RefreshCcw,
  INJURY_PROTECTION: ShieldPlus,
};

// Neutral on purpose: pink is reserved for conviction and green/red for
// settlement results (design spec v2), and a request's status is neither.
const STATUS_CLASS: Record<GradeRequestStatus, string> = {
  OPEN: "border-foreground/40 text-foreground",
  RESOLVED: "border-border text-muted-foreground",
  DECLINED: "border-border text-muted-foreground",
};

export function GradeRequestTypeChip({ type }: { type: GradeRequestType }) {
  const Icon = TYPE_ICON[type];
  return (
    <span className="bg-surface-2 text-foreground inline-flex items-center gap-1 rounded-md px-1.5 py-0.5 text-[0.7rem] font-semibold tracking-wide uppercase">
      <Icon className="size-3" aria-hidden />
      {GRADE_REQUEST_SUBJECT[type]}
    </span>
  );
}

export function GradeRequestStatusChip({
  status,
}: {
  status: GradeRequestStatus;
}) {
  return (
    <span
      className={cn(
        "inline-flex items-center rounded-md border px-1.5 py-0.5 text-[0.7rem] font-semibold tracking-wide uppercase",
        STATUS_CLASS[status],
      )}
    >
      {GRADE_REQUEST_STATUS_LABEL[status]}
    </span>
  );
}

/** "Loss · -1U → now Void · 0U" once the pick has moved since the request. */
function resultMovement(request: AdminGradeRequest): string {
  const then = resultLabel(
    request.outcomeAtRequest,
    request.profitUnitsAtRequest,
  );
  if (!request.currentOutcome) return then;
  const moved =
    request.currentOutcome !== request.outcomeAtRequest ||
    !profitUnitsEqual(request.currentProfitUnits, request.profitUnitsAtRequest);
  return moved
    ? `${then} → now ${resultLabel(request.currentOutcome, request.currentProfitUnits)}`
    : then;
}

export function AdminGradeRequestRow({
  request,
  showReviewLink = true,
}: {
  request: AdminGradeRequest;
  showReviewLink?: boolean;
}) {
  const gameDate = formatRequestGameDate(request.eventStartsAt);
  const submitted = formatRequestDateTime(request.createdAt);
  return (
    <article className="bg-card space-y-2 px-4 py-3">
      <div className="flex flex-wrap items-center gap-2">
        <GradeRequestTypeChip type={request.type} />
        <GradeRequestStatusChip status={request.status} />
        <span className="text-sm font-medium">
          {request.capperHandle ? (
            <Link
              href={`/cappers/${encodeURIComponent(request.capperHandle)}`}
              className="scl-link"
            >
              {request.capperLabel}
            </Link>
          ) : (
            request.capperLabel
          )}
        </span>
        {submitted ? (
          <time
            dateTime={request.createdAt.toISOString()}
            className="text-muted-foreground text-xs tabular-nums"
          >
            {submitted}
          </time>
        ) : null}
      </div>
      <p className="font-semibold break-words">{request.pickSummary}</p>
      <p className="text-muted-foreground scl-data text-xs tabular-nums">
        {gameDate ? `Game ${gameDate} · ` : ""}
        {request.kind === "parlay"
          ? request.legNumber
            ? `Leg ${request.legNumber} of ticket · `
            : "Whole ticket · "
          : ""}
        Result {resultMovement(request)}
      </p>
      <p className="text-sm leading-relaxed break-words whitespace-pre-wrap">
        {request.commentary}
      </p>
      {request.emailError && !request.emailSentAt ? (
        <p className="text-muted-foreground flex items-center gap-1.5 text-xs">
          <MailWarning className="size-3.5" aria-hidden />
          Notification email did not send ({request.emailError}) — this queue
          still has it.
        </p>
      ) : null}
      {request.status !== "OPEN" ? (
        <p className="text-muted-foreground text-xs">
          {GRADE_REQUEST_STATUS_LABEL[request.status]}
          {request.resolvedBy ? ` by ${request.resolvedBy}` : ""}
          {request.resolvedAt
            ? ` · ${formatRequestDateTime(request.resolvedAt)}`
            : ""}
          {request.resolutionNote ? ` — ${request.resolutionNote}` : ""}
        </p>
      ) : null}
      {showReviewLink ? (
        <Link
          href={request.href}
          className="scl-link inline-flex min-h-10 items-center gap-1 text-sm font-medium"
        >
          {request.status === "OPEN" ? "Review and correct" : "Open pick"}
          <ArrowRight className="size-3.5" aria-hidden />
        </Link>
      ) : null}
    </article>
  );
}

export function AdminGradeRequestList({
  requests,
  empty,
}: {
  requests: AdminGradeRequest[];
  empty: string;
}) {
  if (requests.length === 0) {
    return (
      <p className="border-border bg-card text-muted-foreground rounded-xl border p-5 text-sm">
        {empty}
      </p>
    );
  }
  return (
    <div className="divide-border border-border divide-y overflow-hidden rounded-xl border">
      {requests.map((request) => (
        <AdminGradeRequestRow key={request.id} request={request} />
      ))}
    </div>
  );
}
