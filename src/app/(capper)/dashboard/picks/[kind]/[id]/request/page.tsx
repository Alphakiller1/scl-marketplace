import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft, Clock3, LifeBuoy } from "lucide-react";

import { GradeRequestForm } from "@/components/scl/grade-request-form";
import { Button } from "@/components/ui/button";
import {
  formatRequestDateTime,
  GRADE_REQUEST_ACTION_LABEL,
  GRADE_REQUEST_SUBJECT,
  gradeRequestTypeFromSlug,
} from "@/lib/grade-requests";
import {
  findOpenGradeRequest,
  loadCapperPickForRequest,
  loadRequestingCapper,
} from "@/lib/queries/grade-request-pick";
import { requireCapperAccess } from "@/lib/session";

export const metadata = { title: "Support Request" };

const INTRO = {
  REGRADE:
    "Think this pick was graded wrong? Tell SCL what the correct result is and why. We check the official result and correct your record if it was mis-graded.",
  INJURY_PROTECTION:
    "Ask SCL to void this pick under injury protection. Tell us which player was hurt and when — we review it and update your record if it qualifies.",
} as const;

function first(value: string | string[] | undefined): string | undefined {
  return Array.isArray(value) ? value[0] : value;
}

function BackToPicks() {
  return (
    <Button
      variant="outline"
      className="min-h-11 gap-2"
      render={<Link href="/dashboard/picks" />}
      nativeButton={false}
    >
      <ArrowLeft className="size-4" aria-hidden />
      Back to My Picks
    </Button>
  );
}

export default async function GradeRequestPage({
  params,
  searchParams,
}: {
  params: Promise<{ kind: string; id: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const [{ kind, id }, query] = await Promise.all([params, searchParams]);
  if (kind !== "straight" && kind !== "parlay") notFound();
  const type = gradeRequestTypeFromSlug(first(query.type));
  if (!type) notFound();

  const account = await requireCapperAccess();
  const capper = await loadRequestingCapper(account.id);
  if (!capper) notFound();
  // Ownership is part of the lookup: another capper's pick is simply not found.
  const details = await loadCapperPickForRequest(capper.id, kind, id);
  if (!details) notFound();

  const existing =
    details.outcome === "PENDING"
      ? null
      : await findOpenGradeRequest({
          capperId: capper.id,
          type,
          kind,
          pickId: id,
        });
  const blocked =
    details.outcome === "PENDING"
      ? "This pick hasn't been graded yet. Requests open once it has a result."
      : type === "INJURY_PROTECTION" && details.outcome === "VOID"
        ? "This pick is already void, so there is nothing to protect."
        : existing
          ? `You already sent a ${GRADE_REQUEST_SUBJECT[type].toLowerCase()} for this pick${
              formatRequestDateTime(existing.createdAt)
                ? ` on ${formatRequestDateTime(existing.createdAt)}`
                : ""
            }. SCL is reviewing it — any correction will show on My Picks.`
          : null;

  return (
    <div className="mx-auto max-w-3xl">
      <header>
        <div className="flex items-center gap-2">
          <LifeBuoy
            className="size-5 text-[color:var(--scl-pink)]"
            aria-hidden
          />
          <p className="scl-eyebrow text-[color:var(--scl-muted-label)]">
            Support request
          </p>
        </div>
        <h1 className="scl-display mt-3 text-3xl font-bold tracking-[0.02em] sm:text-4xl">
          {GRADE_REQUEST_ACTION_LABEL[type]}
        </h1>
        <p className="text-muted-foreground mt-3 max-w-2xl leading-relaxed">
          {INTRO[type]}
        </p>
      </header>

      <section className="border-border bg-card mt-8 rounded-2xl border p-5 sm:p-7">
        {blocked ? (
          <div className="space-y-4" role="status">
            <p className="flex items-start gap-2 text-sm leading-relaxed">
              <Clock3
                className="text-muted-foreground mt-0.5 size-4 shrink-0"
                aria-hidden
              />
              {blocked}
            </p>
            <BackToPicks />
          </div>
        ) : (
          <GradeRequestForm
            type={type}
            details={details}
            capper={{
              handle: capper.user.username,
              displayName: capper.user.displayName,
              email: capper.user.email,
            }}
            initialLegId={first(query.leg) ?? null}
          />
        )}
      </section>
    </div>
  );
}
