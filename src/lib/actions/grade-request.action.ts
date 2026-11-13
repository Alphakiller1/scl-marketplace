"use server";

import type { GradeRequestType } from "@prisma/client";
import { revalidatePath } from "next/cache";

import { sendGradeRequestEmail } from "@/lib/email";
import { emailVerificationEnforced } from "@/lib/email-verification-policy";
import {
  formatRequestGameDate,
  GRADE_REQUEST_SUBJECT,
  pickSummaryLine,
} from "@/lib/grade-requests";
import { prisma } from "@/lib/prisma";
import {
  findOpenGradeRequest,
  loadCapperPickForRequest,
  loadRequestingCapper,
} from "@/lib/queries/grade-request-pick";
import { consumeRateLimit } from "@/lib/rate-limit";
import {
  reviewGradeRequestSchema,
  submitGradeRequestSchema,
  type ReviewGradeRequestInput,
  type SubmitGradeRequestInput,
} from "@/lib/schemas/grade-request.schema";
import { getCurrentAccount, requireAdmin } from "@/lib/session";

export type SubmitGradeRequestResult =
  | { ok: true; requestId: string; requestType: GradeRequestType }
  | {
      ok: false;
      error: string;
      fieldErrors?: Partial<Record<"commentary" | "legId", string>>;
    };

/** A capper can send this many requests per hour across all their picks. */
const REQUESTS_PER_HOUR = 10;

/**
 * Capper sends "Request Regrade" / "Request Injury Protection" from My Picks.
 *
 * Only the request type, the pick id, the optional leg and the commentary come
 * from the browser. The pick, the date, the result and the capper are read from
 * the database and the session, so what reaches SCL is exactly what is on file.
 * The request is saved before the email is sent: the Grading tab queue is the
 * system of record and the email is the alert.
 */
export async function submitGradeRequestAction(
  input: SubmitGradeRequestInput,
): Promise<SubmitGradeRequestResult> {
  const account = await getCurrentAccount();
  if (!account) {
    return { ok: false, error: "Sign in to send a request." };
  }
  if (account.accountStatus !== "ACTIVE") {
    return { ok: false, error: "Your account is not active." };
  }
  if (emailVerificationEnforced() && !account.emailVerified) {
    return { ok: false, error: "Verify your email before sending requests." };
  }
  if (!account.legalAcceptance) {
    return {
      ok: false,
      error: "Accept the current terms before sending requests.",
    };
  }

  const parsed = submitGradeRequestSchema.safeParse(input);
  if (!parsed.success) {
    const fieldErrors = parsed.error.flatten().fieldErrors;
    return {
      ok: false,
      error: "Check the highlighted fields and try again.",
      fieldErrors: {
        commentary: fieldErrors.commentary?.[0],
        legId: fieldErrors.legId?.[0],
      },
    };
  }
  const { type, kind, pickId, legId, commentary } = parsed.data;

  const profile = await loadRequestingCapper(account.id);
  if (!profile) {
    return { ok: false, error: "Only capper accounts can send requests." };
  }

  const details = await loadCapperPickForRequest(profile.id, kind, pickId);
  if (!details) {
    return {
      ok: false,
      error: "We couldn't find that pick on your account.",
    };
  }
  if (details.outcome === "PENDING") {
    return {
      ok: false,
      error:
        "This pick hasn't been graded yet. Requests open once it has a result.",
    };
  }
  if (type === "INJURY_PROTECTION" && details.outcome === "VOID") {
    return {
      ok: false,
      error: "This pick is already void, so there is nothing to protect.",
    };
  }
  if (
    legId &&
    (kind !== "parlay" || !details.legs.some((l) => l.id === legId))
  ) {
    return {
      ok: false,
      error: "Choose a leg from this parlay.",
      fieldErrors: { legId: "Choose a leg from this parlay." },
    };
  }

  const existing = await findOpenGradeRequest({
    capperId: profile.id,
    type,
    kind,
    pickId,
  });
  if (existing) {
    const sent = formatRequestGameDate(existing.createdAt);
    return {
      ok: false,
      error: `You already have an open ${GRADE_REQUEST_SUBJECT[type].toLowerCase()} for this pick${sent ? ` (sent ${sent})` : ""}. SCL will review it — you'll see the result on My Picks.`,
    };
  }

  let allowed = false;
  try {
    allowed = await consumeRateLimit({
      scope: "grade-request",
      identity: account.id,
      limit: REQUESTS_PER_HOUR,
      windowMs: 60 * 60 * 1000,
    });
  } catch (error) {
    console.error("[grade-request] rate-limit check failed", error);
    return {
      ok: false,
      error:
        "Requests are temporarily unavailable. Try again in a few minutes.",
    };
  }
  if (!allowed) {
    return {
      ok: false,
      error:
        "You've sent a lot of requests in the last hour. Try again later, or contact support if it's urgent.",
    };
  }

  const request = await prisma.gradeRequest.create({
    data: {
      type,
      capperId: profile.id,
      playId: kind === "straight" ? pickId : (legId ?? null),
      parlayId: kind === "parlay" ? pickId : null,
      commentary,
      outcomeAtRequest: details.outcome,
      profitUnitsAtRequest: details.profitUnits,
      pickSummary: pickSummaryLine(details, legId),
      eventStartsAt: details.eventStartsAt,
    },
    select: { id: true, createdAt: true },
  });

  const mail = await sendGradeRequestEmail({
    requestId: request.id,
    type,
    capper: {
      handle: profile.user.username,
      displayName: profile.user.displayName,
      email: profile.user.email,
      userId: account.id,
    },
    details,
    legId: legId ?? null,
    commentary,
    submittedAt: request.createdAt,
  });
  try {
    await prisma.gradeRequest.update({
      where: { id: request.id },
      data: mail.delivered
        ? { emailSentAt: new Date(), emailError: null }
        : { emailError: mail.error.slice(0, 500) },
    });
  } catch (error) {
    // The request itself is saved and queued; only the delivery stamp is lost.
    console.error("[grade-request] could not record email outcome", error);
  }

  // No revalidatePath here, on purpose. A server action that revalidates makes
  // the client re-render the page it was called from, and this page, re-rendered,
  // finds the open request it just created and swaps the capper's confirmation
  // for "You already sent a request" — which reads like a duplicate error. Every
  // page that shows requests (My Picks, the dashboard, the admin queue) renders
  // per request and is never served from a cache, so nothing goes stale.
  return { ok: true, requestId: request.id, requestType: type };
}

type AdminResult = { ok: true } | { ok: false; error: string };

function revalidateAdminRequestViews(pick: {
  playId: string | null;
  parlayId: string | null;
}) {
  revalidatePath("/admin/grading");
  revalidatePath("/admin/grading/requests");
  if (pick.parlayId) revalidatePath(`/admin/plays/parlay/${pick.parlayId}`);
  else if (pick.playId) revalidatePath(`/admin/plays/straight/${pick.playId}`);
  revalidatePath("/dashboard/picks");
  revalidatePath("/dashboard");
}

/** Admin closes a request: resolved (handled) or declined (result stands). */
export async function reviewGradeRequestAction(
  input: ReviewGradeRequestInput,
): Promise<AdminResult> {
  const admin = await requireAdmin();
  const parsed = reviewGradeRequestSchema.safeParse(input);
  if (!parsed.success) {
    return {
      ok: false,
      error: parsed.error.issues[0]?.message ?? "Check the request.",
    };
  }
  const { requestId, decision, note } = parsed.data;
  const request = await prisma.gradeRequest.findUnique({
    where: { id: requestId },
    select: { playId: true, parlayId: true },
  });
  if (!request) return { ok: false, error: "Request not found." };

  const { count } = await prisma.gradeRequest.updateMany({
    where: { id: requestId, status: "OPEN" },
    data: {
      status: decision,
      resolvedAt: new Date(),
      resolvedById: admin.id,
      resolutionNote: note ?? null,
    },
  });
  if (count !== 1) {
    return {
      ok: false,
      error: "This request was already closed. Refresh to see its status.",
    };
  }
  revalidateAdminRequestViews(request);
  return { ok: true };
}

/** Admin reopens a request closed by mistake. */
export async function reopenGradeRequestAction(input: {
  requestId: string;
}): Promise<AdminResult> {
  await requireAdmin();
  const requestId =
    typeof input?.requestId === "string" ? input.requestId.trim() : "";
  if (!requestId) return { ok: false, error: "Request not found." };
  const request = await prisma.gradeRequest.findUnique({
    where: { id: requestId },
    select: { playId: true, parlayId: true },
  });
  if (!request) return { ok: false, error: "Request not found." };
  const { count } = await prisma.gradeRequest.updateMany({
    where: { id: requestId, status: { not: "OPEN" } },
    data: {
      status: "OPEN",
      resolvedAt: null,
      resolvedById: null,
      resolutionNote: null,
    },
  });
  if (count !== 1) {
    return { ok: false, error: "This request is already open." };
  }
  revalidateAdminRequestViews(request);
  return { ok: true };
}
