import "server-only";

import { after } from "next/server";

import { hasDeliverableEmail } from "@/lib/account-claim";
import { sendGradeRequestAcceptedEmail } from "@/lib/email";
import {
  GRADE_REQUEST_RESOLUTION_NOTE_MAX,
  gradeRequestAcceptedVariables,
} from "@/lib/grade-requests";
import { prisma } from "@/lib/prisma";

/**
 * Close the open capper requests a correction just answered.
 *
 * A request is answered when the pick it is about changed:
 * - a straight-play request, when that play changed;
 * - a parlay request about the whole ticket, when any of its legs changed;
 * - a parlay request naming a leg, when that leg changed.
 *
 * Every request closed here is an accepted one, so its capper is emailed. Only
 * the rows this statement moved out of OPEN are mailed, so a request an admin
 * closed by hand a moment earlier is never told twice.
 *
 * Runs AFTER the grading transaction commits and never throws. Grading is the
 * thing that must not fail; a request left open is visible in the queue and
 * one click to close by hand.
 */
export async function resolveGradeRequestsForPicks(input: {
  /** Straight plays and parlay legs whose outcome changed. */
  playIds: readonly string[];
  /** Tickets that were re-settled. */
  parlayIds: readonly string[];
  adminId: string;
  note: string;
}): Promise<number> {
  const playIds = [...new Set(input.playIds)];
  const parlayIds = [...new Set(input.parlayIds)];
  if (playIds.length === 0 && parlayIds.length === 0) return 0;
  try {
    const closed = await prisma.gradeRequest.updateManyAndReturn({
      where: {
        status: "OPEN",
        OR: [
          ...(playIds.length
            ? [{ parlayId: null, playId: { in: playIds } }]
            : []),
          ...(parlayIds.length
            ? [
                { parlayId: { in: parlayIds }, playId: null },
                {
                  parlayId: { in: parlayIds },
                  playId: { in: playIds },
                },
              ]
            : []),
        ],
      },
      data: {
        status: "RESOLVED",
        resolvedAt: new Date(),
        resolvedById: input.adminId,
        resolutionNote: input.note.slice(0, GRADE_REQUEST_RESOLUTION_NOTE_MAX),
      },
      select: { id: true },
    });
    emailCappersAboutAcceptedRequests(closed.map((row) => row.id));
    return closed.length;
  } catch (error) {
    console.error("[grade-requests] auto-resolve after correction failed", {
      error,
      playIds,
      parlayIds,
    });
    return 0;
  }
}

/**
 * Email each capper whose request was just accepted, once the response is out.
 *
 * `after` because a serverless instance freezes when its response returns: a
 * send left floating is killed mid-flight with nothing logged. It also keeps
 * the admin's save from waiting on the mailer.
 */
export function emailCappersAboutAcceptedRequests(
  requestIds: readonly string[],
): void {
  const ids = [...new Set(requestIds)];
  if (ids.length === 0) return;
  after(() => sendAcceptedRequestEmails(ids));
}

/**
 * Send the "request accepted" email for each request still RESOLVED.
 *
 * Reads the pick's result at send time, after the correction committed, so the
 * email reports what the capper's record now says. Never throws: a mail problem
 * is logged per request (and in the admin email activity log) and the rest
 * still go out.
 */
export async function sendAcceptedRequestEmails(
  requestIds: readonly string[],
): Promise<number> {
  let sent = 0;
  try {
    const requests = await prisma.gradeRequest.findMany({
      where: { id: { in: [...requestIds] }, status: "RESOLVED" },
      select: {
        id: true,
        type: true,
        pickSummary: true,
        outcomeAtRequest: true,
        profitUnitsAtRequest: true,
        resolvedAt: true,
        play: { select: { outcome: true, profitUnits: true } },
        parlay: { select: { outcome: true, profitUnits: true } },
        capper: {
          select: { user: { select: { email: true, username: true } } },
        },
      },
    });
    for (const request of requests) {
      // The ticket's result for a parlay request, whichever leg was named.
      const pick = request.parlay ?? request.play;
      const { email, username } = request.capper.user;
      if (!pick || !request.resolvedAt) continue;
      if (!hasDeliverableEmail(email)) {
        console.warn("[grade-requests] no deliverable capper email", {
          requestId: request.id,
        });
        continue;
      }
      const { delivered } = await sendGradeRequestAcceptedEmail({
        requestId: request.id,
        type: request.type,
        resolvedAt: request.resolvedAt,
        to: email,
        username,
        variables: gradeRequestAcceptedVariables({
          username,
          pickSummary: request.pickSummary,
          outcomeAtRequest: request.outcomeAtRequest,
          profitUnitsAtRequest:
            request.profitUnitsAtRequest == null
              ? null
              : Number(request.profitUnitsAtRequest),
          outcome: pick.outcome,
          profitUnits:
            pick.profitUnits == null ? null : Number(pick.profitUnits),
        }),
      });
      if (delivered) sent += 1;
    }
  } catch (error) {
    console.error("[grade-requests] accepted-request emails failed", {
      error,
      requestIds,
    });
  }
  return sent;
}
