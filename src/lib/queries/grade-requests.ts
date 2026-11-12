import "server-only";

import type {
  GradeRequestStatus,
  GradeRequestType,
  Outcome,
  Prisma,
} from "@prisma/client";

import { adminGradeRequestPath } from "@/lib/grade-request-email";
import { gradeRequestPickKey } from "@/lib/grade-requests";
import { accountLabel } from "@/lib/identity";
import { prisma } from "@/lib/prisma";

/** pick key ("straight:<id>" | "parlay:<id>") → request types still OPEN on it. */
export type OpenGradeRequestsByPick = Record<string, GradeRequestType[]>;

/**
 * The capper's own open requests, keyed by the My Picks row they belong to.
 *
 * My Picks is the capper's main screen; it must render even if this lookup
 * fails (for example before the table exists in a database), so a failure
 * degrades to "no open requests" — the buttons simply stay available.
 */
export async function getOpenGradeRequestsForCapper(
  userId: string,
): Promise<OpenGradeRequestsByPick> {
  try {
    const rows = await prisma.gradeRequest.findMany({
      where: { status: "OPEN", capper: { userId } },
      select: { type: true, playId: true, parlayId: true },
    });
    const byPick: OpenGradeRequestsByPick = {};
    for (const row of rows) {
      const key = row.parlayId
        ? gradeRequestPickKey("parlay", row.parlayId)
        : row.playId
          ? gradeRequestPickKey("straight", row.playId)
          : null;
      if (!key) continue;
      const types = (byPick[key] ??= []);
      if (!types.includes(row.type)) types.push(row.type);
    }
    return byPick;
  } catch (error) {
    console.error("[grade-requests] open-request lookup failed", error);
    return {};
  }
}

/** For the admin nav badge and the Grading tab header. Soft-fails to 0. */
export async function countOpenGradeRequests(): Promise<number> {
  try {
    return await prisma.gradeRequest.count({ where: { status: "OPEN" } });
  } catch (error) {
    console.error("[grade-requests] open count failed", error);
    return 0;
  }
}

const adminRequestSelect = {
  id: true,
  type: true,
  status: true,
  playId: true,
  parlayId: true,
  commentary: true,
  pickSummary: true,
  outcomeAtRequest: true,
  profitUnitsAtRequest: true,
  eventStartsAt: true,
  emailSentAt: true,
  emailError: true,
  resolvedAt: true,
  resolutionNote: true,
  createdAt: true,
  resolvedBy: { select: { username: true, displayName: true } },
  capper: {
    select: {
      user: { select: { username: true, displayName: true, email: true } },
    },
  },
  play: {
    select: { selection: true, outcome: true, profitUnits: true },
  },
  parlay: {
    select: {
      outcome: true,
      profitUnits: true,
      legs: { select: { id: true }, orderBy: { createdAt: "asc" } },
    },
  },
} satisfies Prisma.GradeRequestSelect;

type AdminRequestRow = Prisma.GradeRequestGetPayload<{
  select: typeof adminRequestSelect;
}>;

export type AdminGradeRequest = {
  id: string;
  type: GradeRequestType;
  status: GradeRequestStatus;
  kind: "straight" | "parlay";
  /** The straight play id, or the parlay id. */
  pickId: string;
  /** Parlay requests that named a leg. */
  legId: string | null;
  legNumber: number | null;
  legSelection: string | null;
  capperLabel: string;
  capperHandle: string | null;
  capperEmail: string;
  pickSummary: string;
  commentary: string;
  outcomeAtRequest: Outcome;
  profitUnitsAtRequest: number | null;
  /** The pick's result now — differs from the snapshot once corrected. */
  currentOutcome: Outcome | null;
  currentProfitUnits: number | null;
  eventStartsAt: Date | null;
  createdAt: Date;
  emailSentAt: Date | null;
  emailError: string | null;
  resolvedAt: Date | null;
  resolvedBy: string | null;
  resolutionNote: string | null;
  /** Correction screen, scrolled to this request. */
  href: string;
};

function toNumber(value: { toString(): string } | null): number | null {
  return value == null ? null : Number(value);
}

function toAdminRequest(row: AdminRequestRow): AdminGradeRequest {
  const kind = row.parlayId ? "parlay" : "straight";
  const pickId = row.parlayId ?? row.playId ?? "";
  const legId = row.parlayId ? row.playId : null;
  const legIndex =
    legId && row.parlay
      ? row.parlay.legs.findIndex((leg) => leg.id === legId)
      : -1;
  const current = row.parlay ?? row.play;
  return {
    id: row.id,
    type: row.type,
    status: row.status,
    kind,
    pickId,
    legId,
    legNumber: legIndex >= 0 ? legIndex + 1 : null,
    legSelection: legId ? (row.play?.selection ?? null) : null,
    capperLabel: accountLabel(row.capper.user, "Unknown capper"),
    capperHandle: row.capper.user.username?.replace(/^@/, "") ?? null,
    capperEmail: row.capper.user.email,
    pickSummary: row.pickSummary,
    commentary: row.commentary,
    outcomeAtRequest: row.outcomeAtRequest,
    profitUnitsAtRequest: toNumber(row.profitUnitsAtRequest),
    currentOutcome: current?.outcome ?? null,
    currentProfitUnits: toNumber(current?.profitUnits ?? null),
    eventStartsAt: row.eventStartsAt,
    createdAt: row.createdAt,
    emailSentAt: row.emailSentAt,
    emailError: row.emailError,
    resolvedAt: row.resolvedAt,
    resolvedBy: row.resolvedBy ? accountLabel(row.resolvedBy, "Admin") : null,
    resolutionNote: row.resolutionNote,
    href: adminGradeRequestPath({ requestId: row.id, kind, pickId }),
  };
}

export type GradeRequestFilter = GradeRequestStatus | "ALL";

export const ADMIN_REQUEST_LIST_LIMIT = 200;

/**
 * The admin queue. OPEN lists oldest first — the order they should be worked —
 * and every closed view lists the most recently handled first.
 */
export async function listGradeRequests(
  filter: GradeRequestFilter = "OPEN",
): Promise<AdminGradeRequest[]> {
  const rows = await prisma.gradeRequest.findMany({
    where: filter === "ALL" ? {} : { status: filter },
    orderBy:
      filter === "OPEN"
        ? { createdAt: "asc" }
        : filter === "ALL"
          ? { createdAt: "desc" }
          : [{ resolvedAt: "desc" }, { createdAt: "desc" }],
    take: ADMIN_REQUEST_LIST_LIMIT,
    select: adminRequestSelect,
  });
  return rows.map(toAdminRequest);
}

export async function countGradeRequestsByStatus(): Promise<
  Record<GradeRequestStatus, number>
> {
  const grouped = await prisma.gradeRequest.groupBy({
    by: ["status"],
    _count: { _all: true },
  });
  const counts: Record<GradeRequestStatus, number> = {
    OPEN: 0,
    RESOLVED: 0,
    DECLINED: 0,
  };
  for (const row of grouped) counts[row.status] = row._count._all;
  return counts;
}

/**
 * Every request on one pick, open first, for the correction screen. Soft-fails
 * to an empty list so the correction screen keeps working regardless.
 */
export async function listGradeRequestsForPick(input: {
  kind: "straight" | "parlay";
  id: string;
}): Promise<AdminGradeRequest[]> {
  try {
    const rows = await prisma.gradeRequest.findMany({
      where:
        input.kind === "parlay"
          ? { parlayId: input.id }
          : { playId: input.id, parlayId: null },
      orderBy: { createdAt: "desc" },
      select: adminRequestSelect,
    });
    const requests = rows.map(toAdminRequest);
    return [
      ...requests.filter((request) => request.status === "OPEN"),
      ...requests.filter((request) => request.status !== "OPEN"),
    ];
  } catch (error) {
    console.error("[grade-requests] per-pick lookup failed", error);
    return [];
  }
}
