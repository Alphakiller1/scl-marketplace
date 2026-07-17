"use server";

import { revalidatePath } from "next/cache";

import { settleParlay } from "@/lib/grading";
import { isBookKey } from "@/lib/books";
import { fetchLiveLine, verifyPick } from "@/lib/odds-api";
import { decidePickIntegrity, marketKeysForMarket } from "@/lib/odds-verify";
import {
  americanToDecimal,
  combineDecimalOdds,
  decimalToAmerican,
} from "@/lib/odds";
import {
  moveKey,
  resolveCaptureOdds,
  type AcceptedMove,
  type MovedLinePayload,
} from "@/lib/odds-movement";
import { prisma } from "@/lib/prisma";
import {
  createParlaySchema,
  gradeParlaySchema,
  type CreateParlayInput,
  type GradeParlayInput,
} from "@/lib/schemas/parlay.schema";
import { getCurrentAccount, requireAdmin } from "@/lib/session";
import { isVerifiedTier, type ParlayReceipt } from "@/lib/verification";

type Result = { ok: true } | { ok: false; error: string };
export type CreateParlayResult =
  | { ok: true; receipt: ParlayReceipt }
  | { ok: false; error: string }
  | { ok: false; needsConfirm: MovedLinePayload[] }
  | { ok: false; unavailable: MovedLinePayload[] };

export type { AcceptedMove, MovedLinePayload };

/** Capper logs a multi-leg parlay. Stake lives on the parlay; legs are components. */
export async function createParlay(
  input: CreateParlayInput,
  acceptedMoves?: AcceptedMove[],
): Promise<CreateParlayResult> {
  const account = await getCurrentAccount();
  if (!account) return { ok: false, error: "You must be logged in." };
  if (account.accountStatus !== "ACTIVE") {
    return { ok: false, error: "Your account is not active." };
  }
  if (!account.emailVerified) {
    return { ok: false, error: "Verify your email before submitting plays." };
  }
  if (!account.legalAcceptance) {
    return {
      ok: false,
      error: "Accept the current terms before submitting plays.",
    };
  }

  const parsed = createParlaySchema.safeParse(input);
  if (!parsed.success) {
    return {
      ok: false,
      error:
        parsed.error.issues[0]?.message ??
        "Please check the form and try again.",
    };
  }

  const profile = await prisma.capperProfile.findUnique({
    where: { userId: account.id },
    select: { id: true, books: true },
  });
  if (!profile) return { ok: false, error: "No capper profile found." };

  const d = parsed.data;
  const now = new Date();

  // Verification is the universal standard: every leg must be board-bound; each is
  // odds-guarded (M5) then C1/C3-checked. Any unavailable/changed leg without a matching
  // acceptedMoves entry blocks the whole parlay — no partial write.
  const needsConfirm: MovedLinePayload[] = [];
  const unavailable: MovedLinePayload[] = [];
  const decided: Array<{
    leg: (typeof d.legs)[number];
    eventStartsAt: Date;
    oddsAmerican: number;
    selectedOddsAmerican: number;
    oddsMovedAccepted: boolean;
    moveNote?: string;
    loggedPreGame: boolean;
    oddsVerified: boolean;
    tier: "AUTO_VERIFIED" | "VERIFIED" | "SELF_REPORTED";
  }> = [];

  for (const [i, l] of d.legs.entries()) {
    if (!l.eventId || !l.eventStartsAt || !l.side) {
      return {
        ok: false,
        error: `Leg ${i + 1}: pick a line from the board — free-text legs aren't accepted.`,
      };
    }
    const eventStartsAt = new Date(l.eventStartsAt);
    const marketKeys = marketKeysForMarket(l.market);
    const key = moveKey({
      eventId: l.eventId,
      market: l.market,
      side: l.side,
      line: l.line,
      player: l.player,
    });
    const captureBook = l.book && isBookKey(l.book) ? l.book : null;

    const { event: liveEvent, liveAmerican } = await fetchLiveLine({
      sclSport: l.sport,
      eventId: l.eventId,
      marketKeys,
      side: l.side,
      line: l.line,
      player: l.player,
      book: captureBook,
      books: profile.books,
    });
    if (!liveEvent) {
      return {
        ok: false,
        error: `Leg ${i + 1}: odds unavailable for this event — try again.`,
      };
    }

    const capture = resolveCaptureOdds({
      selectedAmerican: l.oddsAmerican,
      liveAmerican,
      acceptedMoves,
      moveKey: key,
      eventId: l.eventId,
      eventLabel: l.selection,
      market: l.market,
      selection: l.selection,
      side: l.side,
      sport: l.sport,
      line: l.line,
      player: l.player,
      book: captureBook,
      verifiedAt: now,
    });

    if (capture.status === "unavailable") {
      unavailable.push(capture.moved);
      continue;
    }
    if (capture.status === "needs_confirm") {
      needsConfirm.push(capture.moved);
      continue;
    }

    const verify = await verifyPick({
      sclSport: l.sport,
      eventId: l.eventId,
      marketKeys,
      side: l.side,
      line: l.line,
      player: l.player,
      claimedAmerican: capture.oddsAmerican,
      books: profile.books,
    });
    const decision = decidePickIntegrity({
      now,
      eventStartsAt,
      eventBound: true,
      verify,
      source: "MANUAL",
    });
    if (!decision.accept) {
      return { ok: false, error: `Leg ${i + 1}: ${decision.reason}` };
    }
    decided.push({
      leg: l,
      eventStartsAt,
      oddsAmerican: capture.oddsAmerican,
      selectedOddsAmerican: capture.selectedOddsAmerican,
      oddsMovedAccepted: capture.oddsMovedAccepted,
      moveNote: capture.moveNote,
      loggedPreGame: decision.loggedPreGame,
      oddsVerified: decision.oddsVerified,
      tier: decision.tier,
    });
  }

  if (unavailable.length) {
    return { ok: false, unavailable };
  }
  if (needsConfirm.length) {
    return { ok: false, needsConfirm };
  }

  const combinedDecimal = combineDecimalOdds(
    decided.map((x) => americanToDecimal(x.oddsAmerican)),
  );
  const combinedOddsAmerican = decimalToAmerican(combinedDecimal);
  const tiers = decided.map((x) => x.tier);
  const verifiedLegCount = tiers.filter(isVerifiedTier).length;
  const allLoggedPreGame = decided.every((x) => x.loggedPreGame);
  const moveNotes = decided.map((x) => x.moveNote).filter(Boolean) as string[];
  const legBooks = [
    ...new Set(
      decided
        .map((x) => (x.leg.book && isBookKey(x.leg.book) ? x.leg.book : null))
        .filter((b): b is NonNullable<typeof b> => b != null),
    ),
  ];
  const parlayBook = legBooks.length === 1 ? legBooks[0]! : null;

  const parlay = await prisma.parlay.create({
    data: {
      capperId: profile.id,
      units: d.units,
      combinedOddsAmerican,
      legs: {
        create: decided.map(
          ({
            leg: l,
            eventStartsAt,
            oddsAmerican,
            selectedOddsAmerican,
            oddsMovedAccepted,
            ...v
          }) => ({
            capperId: profile.id,
            sport: l.sport,
            league: l.league ?? null,
            market: l.market,
            selection: l.selection,
            oddsAmerican,
            selectedOddsAmerican,
            oddsMovedAccepted,
            units: 0, // the parlay carries the stake; legs are components
            eventId: l.eventId,
            eventStartsAt,
            side: l.side,
            line: l.line ?? null,
            book: l.book && isBookKey(l.book) ? l.book : null,
            source: "MANUAL",
            loggedPreGame: v.loggedPreGame,
            oddsVerified: v.oddsVerified,
            verificationTier: v.tier,
          }),
        ),
      },
    },
    select: { createdAt: true },
  });

  revalidatePath("/dashboard");
  revalidatePath("/dashboard/picks");
  return {
    ok: true,
    receipt: {
      kind: "parlay",
      legCount: decided.length,
      combinedOddsAmerican,
      capturedAt: parlay.createdAt.toISOString(),
      allLoggedPreGame,
      verifiedLegCount,
      tiers,
      units: d.units,
      toWinUnits: d.units * (combinedDecimal - 1),
      moveNotes: moveNotes.length ? moveNotes : undefined,
      book: parlayBook,
    },
  };
}

/**
 * Admin grades a parlay by assigning each leg's outcome; the parlay is settled from
 * the legs (any loss loses it; push/void legs drop and odds recombine). P/L lands on
 * the parlay row; each changed leg gets an append-only audit entry.
 */
export async function gradeParlayAction(
  input: GradeParlayInput,
): Promise<Result> {
  const admin = await requireAdmin();

  const parsed = gradeParlaySchema.safeParse(input);
  if (!parsed.success) {
    return {
      ok: false,
      error: parsed.error.issues[0]?.message ?? "Check the grade.",
    };
  }
  const { parlayId, legs: legGrades, reason } = parsed.data;
  if (!reason) {
    return { ok: false, error: "A reason is required to grade a parlay." };
  }

  const parlay = await prisma.parlay.findUnique({
    where: { id: parlayId },
    select: {
      id: true,
      units: true,
      legs: { select: { id: true, oddsAmerican: true, outcome: true } },
    },
  });
  if (!parlay) return { ok: false, error: "Parlay not found." };

  const legById = new Map(parlay.legs.map((l) => [l.id, l]));
  for (const g of legGrades) {
    if (!legById.has(g.playId)) {
      return {
        ok: false,
        error: "A submitted leg does not belong to this parlay.",
      };
    }
  }
  const gradeById = new Map(legGrades.map((g) => [g.playId, g.outcome]));

  const settledLegs = parlay.legs.map((leg) => ({
    ...leg,
    newOutcome: gradeById.get(leg.id) ?? leg.outcome,
  }));

  const settlement = settleParlay(
    settledLegs.map((l) => ({
      outcome: l.newOutcome,
      oddsAmerican: l.oddsAmerican,
    })),
    Number(parlay.units),
  );

  const ops = [];
  for (const leg of settledLegs) {
    if (leg.newOutcome === leg.outcome) continue;
    ops.push(
      prisma.play.update({
        where: { id: leg.id },
        data: { outcome: leg.newOutcome, gradedAt: new Date() },
      }),
      prisma.gradingAudit.create({
        data: {
          playId: leg.id,
          previousOutcome: leg.outcome,
          newOutcome: leg.newOutcome,
          source: leg.outcome === "PENDING" ? "MANUAL" : "ADMIN_OVERRIDE",
          gradedById: admin.id,
          reason,
        },
      }),
    );
  }
  ops.push(
    prisma.parlay.update({
      where: { id: parlay.id },
      data: {
        outcome: settlement.outcome,
        profitUnits: settlement.profitUnits,
        gradedAt: settlement.outcome === "PENDING" ? null : new Date(),
      },
    }),
  );

  await prisma.$transaction(ops);

  revalidatePath("/admin/grading");
  revalidatePath("/dashboard");
  return { ok: true };
}
