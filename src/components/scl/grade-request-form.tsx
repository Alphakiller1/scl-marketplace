"use client";

import { useId, useState, useTransition } from "react";
import Link from "next/link";
import type { GradeRequestType } from "@prisma/client";
import { ArrowLeft, CircleCheck, Lock, Send } from "lucide-react";

import { StatusBadge } from "@/components/scl/badges";
import { Button } from "@/components/ui/button";
import { submitGradeRequestAction } from "@/lib/actions/grade-request.action";
import { formatUnits } from "@/lib/format";
import {
  formatRequestDateTime,
  formatRequestGameDate,
  GRADE_REQUEST_COMMENTARY_MAX,
  GRADE_REQUEST_COMMENTARY_MIN,
  GRADE_REQUEST_COMMENTARY_PROMPT,
  GRADE_REQUEST_SUBJECT,
  legLine,
  outcomeLabel,
  type GradeRequestPickDetails,
} from "@/lib/grade-requests";
import { cn } from "@/lib/utils";

const OUTCOME_TO_STATUS = {
  PENDING: "pending",
  WIN: "win",
  LOSS: "loss",
  PUSH: "push",
  VOID: "void",
} as const;

const controlClass =
  "border-border bg-background text-foreground focus-visible:ring-ring min-h-11 w-full rounded-lg border px-3 py-2 text-sm outline-none focus-visible:ring-2";
const readOnlyClass =
  "border-border bg-surface-2 text-foreground min-h-11 w-full rounded-lg border px-3 py-2 text-sm";

export type GradeRequestFormProps = {
  type: GradeRequestType;
  details: GradeRequestPickDetails;
  capper: {
    handle: string | null;
    displayName: string | null;
    email: string;
  };
  /** Pre-selected leg for a parlay (from `?leg=`), if any. */
  initialLegId?: string | null;
};

/**
 * A labelled, pre-populated line of the request — shown, never editable.
 * Rendered as text rather than a read-only input so long values (an email
 * address, a parlay date) wrap on a phone instead of being cut off.
 */
function PrefilledField({
  label,
  value,
  hint,
}: {
  label: string;
  value: string;
  hint?: string;
}) {
  const id = useId();
  return (
    <div className="space-y-2 text-sm">
      <p id={id} className="flex items-center gap-1.5 font-medium">
        {label}
        <Lock
          className="text-muted-foreground size-3"
          aria-label="Filled in from your account"
        />
      </p>
      <p
        aria-labelledby={id}
        className={cn(readOnlyClass, "leading-relaxed break-words")}
      >
        {value}
      </p>
      {hint ? <p className="text-muted-foreground text-xs">{hint}</p> : null}
    </div>
  );
}

function PickCard({ details }: { details: GradeRequestPickDetails }) {
  const context = [
    details.market !== "Parlay" ? details.market : null,
    details.league && details.league !== details.sport
      ? `${details.sport} · ${details.league}`
      : details.sport,
    details.matchup,
  ].filter(Boolean);
  return (
    <div className="border-border bg-surface-2 rounded-lg border p-3.5">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="font-semibold break-words">{details.title}</p>
          {context.length ? (
            <p className="text-muted-foreground mt-0.5 text-xs break-words">
              {context.join(" · ")}
            </p>
          ) : null}
        </div>
        <StatusBadge status={OUTCOME_TO_STATUS[details.outcome]} />
      </div>
      {details.legs.length ? (
        <ol className="mt-3 space-y-1.5">
          {details.legs.map((leg, index) => (
            <li
              key={leg.id}
              className="flex items-start justify-between gap-3 text-xs"
            >
              <span className="min-w-0 break-words">
                <span className="text-muted-foreground">Leg {index + 1}: </span>
                {legLine(leg)}
              </span>
              <span className="text-muted-foreground shrink-0">
                {outcomeLabel(leg.outcome)}
              </span>
            </li>
          ))}
        </ol>
      ) : null}
      <dl className="mt-3 flex flex-wrap gap-x-4 gap-y-1 text-xs">
        <div className="flex gap-1">
          <dt className="text-muted-foreground">Odds</dt>
          <dd className="scl-data tabular-nums">{details.odds}</dd>
        </div>
        <div className="flex gap-1">
          <dt className="text-muted-foreground">Stake</dt>
          <dd className="scl-data tabular-nums">{details.stake}</dd>
        </div>
        {details.book ? (
          <div className="flex gap-1">
            <dt className="text-muted-foreground">Book</dt>
            <dd>{details.book}</dd>
          </div>
        ) : null}
        <div className="flex gap-1">
          <dt className="text-muted-foreground">Result</dt>
          <dd className="scl-data tabular-nums">
            {outcomeLabel(details.outcome)}
            {details.profitUnits != null
              ? ` · ${formatUnits(details.profitUnits)}`
              : ""}
          </dd>
        </div>
      </dl>
    </div>
  );
}

export function GradeRequestForm({
  type,
  details,
  capper,
  initialLegId = null,
}: GradeRequestFormProps) {
  const commentaryId = useId();
  const legSelectId = useId();
  const [commentary, setCommentary] = useState("");
  const [legId, setLegId] = useState<string>(
    initialLegId && details.legs.some((leg) => leg.id === initialLegId)
      ? initialLegId
      : "",
  );
  const [error, setError] = useState<string | null>(null);
  const [fieldError, setFieldError] = useState<string | null>(null);
  const [sent, setSent] = useState(false);
  const [pending, startTransition] = useTransition();

  const subject = GRADE_REQUEST_SUBJECT[type];
  const handle = capper.handle ? `@${capper.handle.replace(/^@/, "")}` : null;
  const capperLine = [handle, capper.displayName, capper.email]
    .filter((part, index, all) => part && all.indexOf(part) === index)
    .join(" · ");
  const gameDate = formatRequestGameDate(details.eventStartsAt);
  const logged = formatRequestDateTime(details.loggedAt);
  const trimmedLength = commentary.trim().length;
  const tooShort = trimmedLength < GRADE_REQUEST_COMMENTARY_MIN;

  function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (pending) return;
    setError(null);
    setFieldError(null);
    if (tooShort) {
      setFieldError(
        `Please explain your request in at least ${GRADE_REQUEST_COMMENTARY_MIN} characters.`,
      );
      return;
    }
    startTransition(async () => {
      try {
        const result = await submitGradeRequestAction({
          type,
          kind: details.kind,
          pickId: details.id,
          legId: legId || undefined,
          commentary,
        });
        if (result.ok) {
          setSent(true);
          return;
        }
        setError(result.error);
        setFieldError(result.fieldErrors?.commentary ?? null);
      } catch {
        setError("We couldn't send your request. Try again in a moment.");
      }
    });
  }

  if (sent) {
    return (
      <div role="status" className="space-y-4">
        <div className="flex items-start gap-3">
          <CircleCheck
            className="mt-0.5 size-6 shrink-0 text-[color:var(--scl-perf-win-text)]"
            aria-hidden
          />
          <div>
            <h2 className="text-lg font-semibold">{subject} sent</h2>
            <p className="text-muted-foreground mt-1 text-sm leading-relaxed">
              SCL support has your request for{" "}
              <span className="text-foreground font-medium">
                {details.title}
              </span>
              . Any correction will show on My Picks and in your record, and
              replies come to {capper.email}.
            </p>
          </div>
        </div>
        <Button
          className="min-h-11 gap-2"
          render={<Link href="/dashboard/picks" />}
          nativeButton={false}
        >
          <ArrowLeft className="size-4" aria-hidden />
          Back to My Picks
        </Button>
      </div>
    );
  }

  return (
    <form onSubmit={submit} className="space-y-5" noValidate>
      <div className="grid gap-5 sm:grid-cols-2">
        <PrefilledField label="To" value="SCL Support" />
        <PrefilledField label="Subject" value={subject} />
      </div>

      <div className="space-y-2 text-sm">
        <p className="flex items-center gap-1.5 font-medium">
          Pick
          <Lock
            className="text-muted-foreground size-3"
            aria-label="Filled in from your pick history"
          />
        </p>
        <PickCard details={details} />
      </div>

      <div className="grid gap-5 sm:grid-cols-2">
        <PrefilledField
          label="Date"
          value={gameDate ?? "Game date not recorded"}
          hint={logged ? `Pick logged ${logged}` : undefined}
        />
        <PrefilledField
          label="Capper"
          value={capperLine}
          hint="SCL replies to this email address."
        />
      </div>

      {details.kind === "parlay" ? (
        <div className="space-y-2 text-sm">
          <label htmlFor={legSelectId} className="block font-medium">
            Which leg is this about?
          </label>
          <select
            id={legSelectId}
            value={legId}
            onChange={(event) => setLegId(event.target.value)}
            disabled={pending}
            className={controlClass}
          >
            <option value="">The whole ticket / not sure</option>
            {details.legs.map((leg, index) => (
              <option key={leg.id} value={leg.id}>
                Leg {index + 1}: {leg.selection}
              </option>
            ))}
          </select>
        </div>
      ) : null}

      <div className="space-y-2 text-sm">
        <label htmlFor={commentaryId} className="block font-medium">
          Commentary{" "}
          <span className="text-muted-foreground font-normal">(required)</span>
        </label>
        <p
          id={`${commentaryId}-prompt`}
          className="text-muted-foreground text-xs leading-relaxed"
        >
          {GRADE_REQUEST_COMMENTARY_PROMPT[type]}
        </p>
        <textarea
          id={commentaryId}
          value={commentary}
          onChange={(event) => setCommentary(event.target.value)}
          required
          rows={7}
          maxLength={GRADE_REQUEST_COMMENTARY_MAX}
          disabled={pending}
          aria-invalid={fieldError ? true : undefined}
          aria-describedby={`${commentaryId}-prompt ${commentaryId}-count${fieldError ? ` ${commentaryId}-error` : ""}`}
          className={cn(controlClass, "resize-y")}
        />
        <p
          id={`${commentaryId}-count`}
          className="text-muted-foreground flex justify-between gap-3 text-xs"
        >
          <span>Minimum {GRADE_REQUEST_COMMENTARY_MIN} characters.</span>
          <span className="tabular-nums">
            {commentary.length.toLocaleString("en-US")}/
            {GRADE_REQUEST_COMMENTARY_MAX.toLocaleString("en-US")}
          </span>
        </p>
        {fieldError ? (
          <p
            id={`${commentaryId}-error`}
            className="text-xs text-[color:var(--scl-perf-loss-text)]"
          >
            {fieldError}
          </p>
        ) : null}
      </div>

      {error ? (
        <p
          role="alert"
          className="text-sm text-[color:var(--scl-perf-loss-text)]"
        >
          {error}
        </p>
      ) : null}

      <div className="flex flex-wrap items-center gap-3">
        <Button type="submit" disabled={pending} className="min-h-11 gap-2">
          <Send className="size-4" aria-hidden />
          {pending ? "Sending…" : `Send ${subject}`}
        </Button>
        <Button
          variant="ghost"
          className="min-h-11"
          render={<Link href="/dashboard/picks" />}
          nativeButton={false}
        >
          Cancel
        </Button>
      </div>
    </form>
  );
}
