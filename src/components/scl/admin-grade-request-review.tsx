"use client";

import { useId, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { CircleCheck, CircleX, Undo2 } from "lucide-react";
import { toast } from "sonner";

import { AdminGradeRequestRow } from "@/components/scl/admin-grade-request-list";
import { Button } from "@/components/ui/button";
import {
  reopenGradeRequestAction,
  reviewGradeRequestAction,
} from "@/lib/actions/grade-request.action";
import { GRADE_REQUEST_RESOLUTION_NOTE_MAX } from "@/lib/grade-requests";
import type { AdminGradeRequest } from "@/lib/queries/grade-requests";
import { CORRECTION_REASON_MIN } from "@/lib/schemas/grading.schema";
import { cn } from "@/lib/utils";

/**
 * One capper request on the correction screen, with its close-out controls.
 *
 * Applying a correction below closes the open requests it answers on its own;
 * these buttons are for the other outcomes — the result stands (decline, with
 * a note), the request was handled some other way (resolve), or it was closed
 * by mistake (reopen).
 */
export function AdminGradeRequestReview({
  request,
  highlighted = false,
}: {
  request: AdminGradeRequest;
  highlighted?: boolean;
}) {
  const router = useRouter();
  const noteId = useId();
  const [note, setNote] = useState("");
  const [pending, startTransition] = useTransition();
  const declineReady = note.trim().length >= CORRECTION_REASON_MIN;

  function run(
    work: () => Promise<{ ok: true } | { ok: false; error: string }>,
    success: string,
  ) {
    startTransition(async () => {
      try {
        const result = await work();
        if (!result.ok) {
          toast.error(result.error);
          return;
        }
        toast.success(success);
        setNote("");
        router.refresh();
      } catch {
        toast.error("That could not be saved. Try again.");
      }
    });
  }

  return (
    <div
      id={`request-${request.id}`}
      className={cn(
        "border-border overflow-hidden rounded-xl border",
        highlighted && "ring-ring ring-2",
      )}
    >
      <AdminGradeRequestRow request={request} showReviewLink={false} />
      <div className="bg-surface-2 border-border space-y-3 border-t px-4 py-3">
        {request.status === "OPEN" ? (
          <>
            <div>
              <label
                htmlFor={noteId}
                className="mb-1.5 block text-sm font-medium"
              >
                Note{" "}
                <span className="text-muted-foreground font-normal">
                  (required to decline)
                </span>
              </label>
              <textarea
                id={noteId}
                value={note}
                onChange={(event) => setNote(event.target.value)}
                maxLength={GRADE_REQUEST_RESOLUTION_NOTE_MAX}
                rows={2}
                disabled={pending}
                placeholder="Why the result stands, or how this was handled."
                className="border-input bg-background focus-visible:border-ring focus-visible:ring-ring/50 w-full resize-y rounded-lg border px-3 py-2 text-sm focus-visible:ring-[3px] focus-visible:outline-none"
              />
            </div>
            <div className="flex flex-wrap gap-2">
              <Button
                type="button"
                variant="outline"
                className="min-h-10"
                disabled={pending || !declineReady}
                onClick={() =>
                  run(
                    () =>
                      reviewGradeRequestAction({
                        requestId: request.id,
                        decision: "DECLINED",
                        note,
                      }),
                    "Request declined — the published result stands.",
                  )
                }
              >
                <CircleX className="size-4" aria-hidden />
                Decline — result stands
              </Button>
              <Button
                type="button"
                variant="ghost"
                className="min-h-10"
                disabled={pending}
                onClick={() =>
                  run(
                    () =>
                      reviewGradeRequestAction({
                        requestId: request.id,
                        decision: "RESOLVED",
                        note,
                      }),
                    "Request marked resolved.",
                  )
                }
              >
                <CircleCheck className="size-4" aria-hidden />
                Mark resolved
              </Button>
            </div>
            <p className="text-muted-foreground text-xs">
              Applying a correction below resolves this request automatically.
              Reply to the capper from the notification email.
            </p>
          </>
        ) : (
          <Button
            type="button"
            variant="ghost"
            className="min-h-10"
            disabled={pending}
            onClick={() =>
              run(
                () => reopenGradeRequestAction({ requestId: request.id }),
                "Request reopened.",
              )
            }
          >
            <Undo2 className="size-4" aria-hidden />
            Reopen request
          </Button>
        )}
      </div>
    </div>
  );
}
