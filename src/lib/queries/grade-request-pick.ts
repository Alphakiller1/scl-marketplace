import "server-only";

import {
  parlayPickDetails,
  straightPickDetails,
  type GradeRequestPickDetails,
  type GradeRequestPickKind,
} from "@/lib/grade-requests";
import { prisma } from "@/lib/prisma";

const legSelect = {
  id: true,
  sport: true,
  market: true,
  selection: true,
  oddsAmerican: true,
  outcome: true,
  eventLabel: true,
  homeTeam: true,
  awayTeam: true,
  eventStartsAt: true,
} as const;

/**
 * A pick for a regrade / injury-protection request — only if it belongs to the
 * given capper. Everything the request screen pre-fills, the email states and
 * the queue shows is built from this stored row, never from the browser.
 *
 * Lives outside the `"use server"` action module on purpose: an exported async
 * function there is a callable endpoint, and this one takes a capper id.
 */
export async function loadCapperPickForRequest(
  capperId: string,
  kind: GradeRequestPickKind,
  pickId: string,
): Promise<GradeRequestPickDetails | null> {
  if (kind === "straight") {
    const play = await prisma.play.findFirst({
      where: { id: pickId, capperId, parlayId: null, status: "COMMITTED" },
      select: {
        id: true,
        sport: true,
        league: true,
        market: true,
        selection: true,
        oddsAmerican: true,
        units: true,
        book: true,
        outcome: true,
        profitUnits: true,
        eventLabel: true,
        homeTeam: true,
        awayTeam: true,
        eventStartsAt: true,
        createdAt: true,
      },
    });
    if (!play) return null;
    return straightPickDetails({
      ...play,
      units: Number(play.units),
      profitUnits: play.profitUnits == null ? null : Number(play.profitUnits),
    });
  }
  const parlay = await prisma.parlay.findFirst({
    where: { id: pickId, capperId, legs: { some: {} } },
    select: {
      id: true,
      combinedOddsAmerican: true,
      units: true,
      outcome: true,
      profitUnits: true,
      createdAt: true,
      legs: { orderBy: { createdAt: "asc" }, select: legSelect },
    },
  });
  if (!parlay) return null;
  return parlayPickDetails({
    ...parlay,
    units: Number(parlay.units),
    profitUnits: parlay.profitUnits == null ? null : Number(parlay.profitUnits),
  });
}

/** The capper's own profile + contact details for the request screen and email. */
export async function loadRequestingCapper(userId: string) {
  return prisma.capperProfile.findUnique({
    where: { userId },
    select: {
      id: true,
      user: { select: { username: true, displayName: true, email: true } },
    },
  });
}

/** An OPEN request of this type already on this pick, if any. */
export async function findOpenGradeRequest(input: {
  capperId: string;
  type: "REGRADE" | "INJURY_PROTECTION";
  kind: GradeRequestPickKind;
  pickId: string;
}) {
  return prisma.gradeRequest.findFirst({
    where: {
      type: input.type,
      status: "OPEN",
      capperId: input.capperId,
      ...(input.kind === "parlay"
        ? { parlayId: input.pickId }
        : { playId: input.pickId, parlayId: null }),
    },
    select: { id: true, createdAt: true },
  });
}
