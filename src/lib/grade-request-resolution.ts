import "server-only";

import { GRADE_REQUEST_RESOLUTION_NOTE_MAX } from "@/lib/grade-requests";
import { prisma } from "@/lib/prisma";

/**
 * Close the open capper requests a correction just answered.
 *
 * A request is answered when the pick it is about changed:
 * - a straight-play request, when that play changed;
 * - a parlay request about the whole ticket, when any of its legs changed;
 * - a parlay request naming a leg, when that leg changed.
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
    const { count } = await prisma.gradeRequest.updateMany({
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
    });
    return count;
  } catch (error) {
    console.error("[grade-requests] auto-resolve after correction failed", {
      error,
      playIds,
      parlayIds,
    });
    return 0;
  }
}
