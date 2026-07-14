"use server";

import { revalidatePath } from "next/cache";

import { prisma } from "@/lib/prisma";
import { getCurrentAccount } from "@/lib/session";
import { playSchema, type PlayInput } from "@/lib/schemas/play.schema";
import { isBookKey } from "@/lib/books";
import {
  decidePickIntegrity,
  marketKeysForMarket,
  type VerifyResult,
} from "@/lib/odds-verify";
import { fetchLiveLine, verifyPick } from "@/lib/odds-api";
import { americanToDecimal } from "@/lib/odds";
import {
  moveKey,
  resolveCaptureOdds,
  type AcceptedMove,
  type MovedLinePayload,
} from "@/lib/odds-movement";
import type { StraightReceipt } from "@/lib/verification";

export type PlayResult =
  | { ok: true; receipt: StraightReceipt }
  | { ok: false; error: string }
  | { ok: false; needsConfirm: MovedLinePayload[] }
  | { ok: false; unavailable: MovedLinePayload[] };

export type { AcceptedMove, MovedLinePayload };

export async function createPlay(
  input: PlayInput,
  acceptedMoves?: AcceptedMove[],
): Promise<PlayResult> {
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

  const parsed = playSchema.safeParse(input);
  if (!parsed.success) {
    return { ok: false, error: "Please check the form and try again." };
  }

  const profile = await prisma.capperProfile.findUnique({
    where: { userId: account.id },
    select: { id: true, books: true },
  });
  if (!profile) return { ok: false, error: "No capper profile found." };

  const d = parsed.data;

  // Verification is the universal standard (docs/SCL_PICK_INTEGRITY.md): every pick MUST be an
  // event-bound board pick. Free-text entry is retired — reject anything lacking a real event +
  // structured side here on the server, never trusting that the UI enforced it.
  if (!d.eventId || !d.eventStartsAt || !d.side) {
    return {
      ok: false,
      error:
        "Pick a line from the board — manual free-text entry is no longer accepted.",
    };
  }

  const now = new Date();
  const eventStartsAt = new Date(d.eventStartsAt);
  const marketKeys = marketKeysForMarket(d.market);
  const key = moveKey({
    eventId: d.eventId,
    market: d.market,
    side: d.side,
    line: d.line,
    player: d.player,
  });
  const captureBook = d.book && isBookKey(d.book) ? d.book : null;

  // M5 odds-movement guard: re-fetch live price before any write.
  const { event: liveEvent, liveAmerican } = await fetchLiveLine({
    sclSport: d.sport,
    eventId: d.eventId,
    marketKeys,
    side: d.side,
    line: d.line,
    player: d.player,
    book: captureBook,
    books: profile.books,
  });
  if (!liveEvent) {
    return {
      ok: false,
      error: "Odds unavailable for this event — try again in a moment.",
    };
  }

  const capture = resolveCaptureOdds({
    selectedAmerican: d.oddsAmerican,
    liveAmerican,
    acceptedMoves,
    moveKey: key,
    eventId: d.eventId,
    eventLabel: d.selection,
    market: d.market,
    selection: d.selection,
    side: d.side,
    line: d.line,
    player: d.player,
    book: captureBook,
    verifiedAt: now,
  });

  if (capture.status === "unavailable") {
    return { ok: false, unavailable: [capture.moved] };
  }
  if (capture.status === "needs_confirm") {
    return { ok: false, needsConfirm: [capture.moved] };
  }

  // C1/C3 integrity against the odds we will persist (never the stale selected price alone).
  const verify: VerifyResult = await verifyPick({
    sclSport: d.sport,
    eventId: d.eventId,
    marketKeys,
    side: d.side,
    line: d.line,
    player: d.player,
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
  if (!decision.accept) return { ok: false, error: decision.reason };

  const play = await prisma.play.create({
    data: {
      capperId: profile.id,
      sport: d.sport,
      league: d.league ?? null,
      market: d.market,
      selection: d.selection,
      oddsAmerican: capture.oddsAmerican,
      selectedOddsAmerican: capture.selectedOddsAmerican,
      oddsMovedAccepted: capture.oddsMovedAccepted,
      units: d.units,
      notes: d.notes ?? null,
      eventId: d.eventId ?? null,
      eventStartsAt,
      side: d.side ?? null,
      line: d.line ?? null,
      book: captureBook,
      source: "MANUAL",
      loggedPreGame: decision.loggedPreGame,
      oddsVerified: decision.oddsVerified,
      verificationTier: decision.tier,
    },
    select: { createdAt: true },
  });

  revalidatePath("/dashboard");
  revalidatePath("/dashboard/picks");
  return {
    ok: true,
    receipt: {
      kind: "straight",
      selection: d.selection,
      market: d.market,
      oddsAmerican: capture.oddsAmerican,
      capturedAt: play.createdAt.toISOString(),
      loggedPreGame: decision.loggedPreGame,
      oddsVerified: decision.oddsVerified,
      tier: decision.tier,
      units: d.units,
      toWinUnits: d.units * (americanToDecimal(capture.oddsAmerican) - 1),
      moveNote: capture.moveNote,
    },
  };
}
