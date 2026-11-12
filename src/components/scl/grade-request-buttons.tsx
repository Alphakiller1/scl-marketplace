import Link from "next/link";
import type { GradeRequestType, Outcome } from "@prisma/client";
import { Clock3, RefreshCcw, ShieldPlus } from "lucide-react";

import { Button } from "@/components/ui/button";
import {
  availableGradeRequestTypes,
  GRADE_REQUEST_ACTION_LABEL,
  GRADE_REQUEST_PENDING_LABEL,
  myPicksRequestHref,
  type GradeRequestPickKind,
} from "@/lib/grade-requests";

const ICON: Record<GradeRequestType, typeof RefreshCcw> = {
  REGRADE: RefreshCcw,
  INJURY_PROTECTION: ShieldPlus,
};

/**
 * "Request Regrade" / "Request Injury Protection" under a graded pick on the
 * capper's own pick history. Each opens the pre-filled support request screen.
 * While a request of that type is open, its button is replaced by a status chip
 * so the same pick cannot be sent twice.
 */
export function GradeRequestButtons({
  kind,
  id,
  outcome,
  openRequests = [],
  pickLabel,
}: {
  kind: GradeRequestPickKind;
  id: string;
  outcome: Outcome;
  openRequests?: readonly GradeRequestType[];
  /** For the accessible name: "Request Regrade for Lakers -3.5". */
  pickLabel: string;
}) {
  const types = availableGradeRequestTypes(outcome);
  if (types.length === 0) return null;

  return (
    <div
      className="border-border mt-3 flex flex-wrap items-center gap-2 border-t pt-3"
      data-testid="grade-request-actions"
    >
      {types.map((type) => {
        const Icon = ICON[type];
        if (openRequests.includes(type)) {
          return (
            <span
              key={type}
              className="border-border bg-surface-2 text-muted-foreground inline-flex min-h-10 items-center gap-1.5 rounded-lg border px-3 text-xs font-medium"
              title="SCL is reviewing this request. You'll see any correction here."
            >
              <Clock3 className="size-3.5" aria-hidden />
              {GRADE_REQUEST_PENDING_LABEL[type]}
            </span>
          );
        }
        return (
          <Button
            key={type}
            variant="outline"
            size="sm"
            className="min-h-10"
            render={
              <Link
                href={myPicksRequestHref({ type, kind, id })}
                aria-label={`${GRADE_REQUEST_ACTION_LABEL[type]} for ${pickLabel}`}
              />
            }
            nativeButton={false}
          >
            <Icon aria-hidden />
            {GRADE_REQUEST_ACTION_LABEL[type]}
          </Button>
        );
      })}
    </div>
  );
}
