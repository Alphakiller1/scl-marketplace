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

type PlayResult = { ok: true } | { ok: false; error: string };

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

  // Pick integrity (docs/SCL_PICK_INTEGRITY.md). Event-bound picks run the strict path: a hard
  // pre-game lock (C1) and a live odds check (C3). Legacy free-text picks (no event) skip
  // verification and land as SELF_REPORTED. The server re-derives the lock from its own clock and
  // re-fetches the market — the client-supplied event fields are never trusted for either.
  const now = new Date();
  const eventStartsAt = d.eventStartsAt ? new Date(d.eventStartsAt) : null;
  const eventBound = Boolean(d.eventId && d.side);

  let verify: VerifyResult | null = null;
  if (d.eventId && eventStartsAt && d.side) {
    verify = await verifyPick({
      sclSport: d.sport,
      eventId: d.eventId,
      marketKeys: marketKeysForMarket(d.market),
      side: d.side,
      line: d.line,
      player: d.player,
      claimedAmerican: d.oddsAmerican,
    });
  }

  const decision = decidePickIntegrity({
    now,
    eventStartsAt,
    eventBound,
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
  return { ok: true };
}
