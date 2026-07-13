"use server";

import { revalidatePath } from "next/cache";

import { prisma } from "@/lib/prisma";
import { getCurrentAccount } from "@/lib/session";
import { playSchema, type PlayInput } from "@/lib/schemas/play.schema";
import {
  decidePickIntegrity,
  marketKeysForMarket,
  type VerifyResult,
} from "@/lib/odds-verify";
import { verifyPick } from "@/lib/odds-api";
import type { StraightReceipt } from "@/lib/verification";

export type PlayResult =
  | { ok: true; receipt: StraightReceipt }
  | { ok: false; error: string };

export async function createPlay(input: PlayInput): Promise<PlayResult> {
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
    select: { id: true },
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

  // Pick integrity: the strict path — a hard pre-game lock (C1) and a live odds check (C3). The
  // server re-derives the lock from its own clock and re-fetches the market; the client-supplied
  // event fields are never trusted for either.
  const now = new Date();
  const eventStartsAt = new Date(d.eventStartsAt);

  const verify: VerifyResult = await verifyPick({
    sclSport: d.sport,
    eventId: d.eventId,
    marketKeys: marketKeysForMarket(d.market),
    side: d.side,
    line: d.line,
    player: d.player,
    claimedAmerican: d.oddsAmerican,
  });

  const decision = decidePickIntegrity({
    now,
    eventStartsAt,
    eventBound: true,
    verify,
    source: "MANUAL",
  });
  if (!decision.accept) return { ok: false, error: decision.reason };

  await prisma.play.create({
    data: {
      capperId: profile.id,
      sport: d.sport,
      league: d.league ?? null,
      market: d.market,
      selection: d.selection,
      oddsAmerican: d.oddsAmerican,
      units: d.units,
      notes: d.notes ?? null,
      eventId: d.eventId ?? null,
      eventStartsAt,
      side: d.side ?? null,
      line: d.line ?? null,
      source: "MANUAL",
      loggedPreGame: decision.loggedPreGame,
      oddsVerified: decision.oddsVerified,
      verificationTier: decision.tier,
    },
  });

  revalidatePath("/dashboard");
  revalidatePath("/dashboard/picks");
  return {
    ok: true,
    receipt: {
      kind: "straight",
      selection: d.selection,
      market: d.market,
      oddsAmerican: d.oddsAmerican,
      loggedPreGame: decision.loggedPreGame,
      oddsVerified: decision.oddsVerified,
      tier: decision.tier,
    },
  };
}
