"use server";

import { revalidatePath } from "next/cache";

import { assertAnalysisSafe } from "@/lib/analysis-moderation";
import {
  buildBulkSinglesReceipt,
  shapeBulkSinglesOutcome,
  type BulkLinePrep,
} from "@/lib/bulk-plays";
import { isBookKey } from "@/lib/books";
import { fetchLiveLine, verifyPick } from "@/lib/odds-api";
import { moveKey, resolveCaptureOdds } from "@/lib/odds-movement";
import type { AcceptedMove, MovedLinePayload } from "@/lib/odds-movement";
import {
  decidePickIntegrity,
  marketKeysForMarket,
  type VerifyResult,
} from "@/lib/odds-verify";
import { americanToDecimal } from "@/lib/odds";
import { isExtremeAmericanOdds } from "@/lib/odds-board";
import { prisma } from "@/lib/prisma";
import {
  hasNeedsReviewColumn,
  hasNotesPublicColumn,
} from "@/lib/results/schema-features";
import { playSchema, type PlayInput } from "@/lib/schemas/play.schema";
import { getCurrentAccount } from "@/lib/session";
import type { BulkSinglesReceipt, StraightReceipt } from "@/lib/verification";

type ReadyPlayData = {
  sport: string;
  league: string | null;
  market: string;
  selection: string;
  oddsAmerican: number;
  selectedOddsAmerican: number;
  oddsMovedAccepted: boolean;
  units: number;
  notes: string | null;
  notesPublic: boolean;
  needsReview: boolean;
  eventId: string;
  eventStartsAt: Date;
  side: string;
  line: number | null;
  book: string | null;
  loggedPreGame: boolean;
  oddsVerified: boolean;
  verificationTier: StraightReceipt["tier"];
};

async function playCreateData(data: ReadyPlayData) {
  const { notesPublic, needsReview, ...base } = data;
  return {
    ...base,
    ...((await hasNotesPublicColumn()) ? { notesPublic } : {}),
    ...((await hasNeedsReviewColumn()) ? { needsReview } : {}),
  };
}

export type PlayResult =
  | { ok: true; receipt: StraightReceipt }
  | { ok: false; error: string }
  | { ok: false; needsConfirm: MovedLinePayload[] }
  | { ok: false; unavailable: MovedLinePayload[] };

export type CreatePlaysResult =
  | {
      ok: true;
      receipt: BulkSinglesReceipt;
      /** Present when some lines were suspended after a partial write. */
      unavailable?: MovedLinePayload[];
    }
  | { ok: false; error: string }
  | {
      ok: false;
      needsConfirm: MovedLinePayload[];
      unavailable?: MovedLinePayload[];
    }
  | { ok: false; unavailable: MovedLinePayload[] };

type AccountGate = { ok: true; userId: string } | { ok: false; error: string };

async function requireActiveCapper(): Promise<AccountGate> {
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
  return { ok: true, userId: account.id };
}

type ReadyWrite = {
  moveKey: string;
  data: {
    sport: string;
    league: string | null;
    market: string;
    selection: string;
    oddsAmerican: number;
    selectedOddsAmerican: number;
    oddsMovedAccepted: boolean;
    units: number;
    notes: string | null;
    notesPublic: boolean;
    needsReview: boolean;
    eventId: string;
    eventStartsAt: Date;
    side: string;
    line: number | null;
    book: string | null;
    loggedPreGame: boolean;
    oddsVerified: boolean;
    verificationTier: "AUTO_VERIFIED" | "VERIFIED" | "SELF_REPORTED";
  };
  receiptBase: Omit<StraightReceipt, "capturedAt">;
};

/**
 * Shared per-line verified + odds-guarded body (createPlay / createPlays).
 * Does not write — caller persists ReadyWrite rows.
 */
async function preparePlayLine(
  input: PlayInput,
  opts: {
    books: readonly string[];
    acceptedMoves?: AcceptedMove[];
    now: Date;
  },
): Promise<
  | { status: "ready"; ready: ReadyWrite }
  | { status: "needs_confirm"; moved: MovedLinePayload }
  | { status: "unavailable"; moved: MovedLinePayload }
  | {
      status: "error";
      error: string;
      moveKey?: string;
      selection?: string;
      market?: string;
    }
> {
  const parsed = playSchema.safeParse(input);
  if (!parsed.success) {
    return {
      status: "error",
      error: "Please check the form and try again.",
      selection:
        typeof input.selection === "string" ? input.selection : undefined,
      market: typeof input.market === "string" ? input.market : undefined,
    };
  }
  const d = parsed.data;

  const analysisError = assertAnalysisSafe(d.notes);
  if (analysisError) {
    return {
      status: "error",
      error: analysisError,
      selection: d.selection,
      market: d.market,
    };
  }

  if (!d.eventId || !d.eventStartsAt || !d.side) {
    return {
      status: "error",
      error:
        "Pick a line from the board — manual free-text entry is no longer accepted.",
      selection: d.selection,
      market: d.market,
    };
  }

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

  const { event: liveEvent, liveAmerican } = await fetchLiveLine({
    sclSport: d.sport,
    eventId: d.eventId,
    marketKeys,
    side: d.side,
    line: d.line,
    player: d.player,
    book: captureBook,
    books: opts.books,
  });
  if (!liveEvent) {
    return {
      status: "error",
      error: "Odds unavailable for this event — try again in a moment.",
      moveKey: key,
      selection: d.selection,
      market: d.market,
    };
  }

  const capture = resolveCaptureOdds({
    selectedAmerican: d.oddsAmerican,
    liveAmerican,
    acceptedMoves: opts.acceptedMoves,
    moveKey: key,
    eventId: d.eventId,
    eventLabel: d.selection,
    market: d.market,
    selection: d.selection,
    side: d.side,
    sport: d.sport,
    line: d.line,
    player: d.player,
    book: captureBook,
    verifiedAt: opts.now,
  });

  if (capture.status === "unavailable") {
    return { status: "unavailable", moved: capture.moved };
  }
  if (capture.status === "needs_confirm") {
    return { status: "needs_confirm", moved: capture.moved };
  }

  const verify: VerifyResult = await verifyPick({
    sclSport: d.sport,
    eventId: d.eventId,
    marketKeys,
    side: d.side,
    line: d.line,
    player: d.player,
    claimedAmerican: capture.oddsAmerican,
    books: opts.books,
  });

  const decision = decidePickIntegrity({
    now: opts.now,
    eventStartsAt,
    eventBound: true,
    verify,
    source: "MANUAL",
  });
  if (!decision.accept) {
    return {
      status: "error",
      error: decision.reason,
      moveKey: key,
      selection: d.selection,
      market: d.market,
    };
  }

  return {
    status: "ready",
    ready: {
      moveKey: key,
      data: {
        sport: d.sport,
        league: d.league ?? null,
        market: d.market,
        selection: d.selection,
        oddsAmerican: capture.oddsAmerican,
        selectedOddsAmerican: capture.selectedOddsAmerican,
        oddsMovedAccepted: capture.oddsMovedAccepted,
        units: d.units,
        notes: d.notes ?? null,
        notesPublic: d.notesPublic ?? true,
        needsReview: isExtremeAmericanOdds(capture.oddsAmerican),
        eventId: d.eventId,
        eventStartsAt,
        side: d.side,
        line: d.line ?? null,
        book: captureBook,
        loggedPreGame: decision.loggedPreGame,
        oddsVerified: decision.oddsVerified,
        verificationTier: decision.tier,
      },
      receiptBase: {
        kind: "straight",
        selection: d.selection,
        market: d.market,
        sport: d.sport,
        side: d.side,
        oddsAmerican: capture.oddsAmerican,
        loggedPreGame: decision.loggedPreGame,
        oddsVerified: decision.oddsVerified,
        tier: decision.tier,
        units: d.units,
        toWinUnits: d.units * (americanToDecimal(capture.oddsAmerican) - 1),
        moveNote: capture.moveNote,
        book: captureBook,
      },
    },
  };
}

export async function createPlay(
  input: PlayInput,
  acceptedMoves?: AcceptedMove[],
): Promise<PlayResult> {
  const gate = await requireActiveCapper();
  if (!gate.ok) return gate;

  const profile = await prisma.capperProfile.findUnique({
    where: { userId: gate.userId },
    select: { id: true, books: true },
  });
  if (!profile) return { ok: false, error: "No capper profile found." };

  const now = new Date();
  const prep = await preparePlayLine(input, {
    books: profile.books,
    acceptedMoves,
    now,
  });

  if (prep.status === "unavailable") {
    return { ok: false, unavailable: [prep.moved] };
  }
  if (prep.status === "needs_confirm") {
    return { ok: false, needsConfirm: [prep.moved] };
  }
  if (prep.status === "error") {
    return { ok: false, error: prep.error };
  }

  const play = await prisma.play.create({
    data: {
      capperId: profile.id,
      ...(await playCreateData(prep.ready.data)),
      source: "MANUAL",
    },
    select: { createdAt: true },
  });

  revalidatePath("/dashboard");
  revalidatePath("/dashboard/picks");
  return {
    ok: true,
    receipt: {
      ...prep.ready.receiptBase,
      capturedAt: play.createdAt.toISOString(),
    },
  };
}

/**
 * Bulk singles submit (M5 PR-4). Each line is odds-guarded independently.
 * needsConfirm blocks the whole write (Cancel writes nothing). Unavailable does
 * not block clean lines — those write and suspended keys stay in the slip.
 */
export async function createPlays(
  inputs: PlayInput[],
  acceptedMoves?: AcceptedMove[],
): Promise<CreatePlaysResult> {
  const gate = await requireActiveCapper();
  if (!gate.ok) return gate;

  if (!Array.isArray(inputs) || inputs.length === 0) {
    return { ok: false, error: "Add at least one pick to submit." };
  }
  if (inputs.length > 20) {
    return { ok: false, error: "Too many picks in one submit." };
  }

  const profile = await prisma.capperProfile.findUnique({
    where: { userId: gate.userId },
    select: { id: true, books: true },
  });
  if (!profile) return { ok: false, error: "No capper profile found." };

  const now = new Date();
  const preps: BulkLinePrep[] = [];
  const readyWrites: ReadyWrite[] = [];

  for (const input of inputs) {
    const prep = await preparePlayLine(input, {
      books: profile.books,
      acceptedMoves,
      now,
    });
    if (prep.status === "ready") {
      readyWrites.push(prep.ready);
      preps.push({
        status: "ready",
        moveKey: prep.ready.moveKey,
        // capturedAt filled after write
        receipt: {
          ...prep.ready.receiptBase,
          capturedAt: now.toISOString(),
        },
      });
    } else if (prep.status === "needs_confirm") {
      preps.push({ status: "needs_confirm", moved: prep.moved });
    } else if (prep.status === "unavailable") {
      preps.push({ status: "unavailable", moved: prep.moved });
    } else {
      preps.push({
        status: "error",
        error: prep.error,
        moveKey: prep.moveKey,
        selection: prep.selection,
        market: prep.market,
      });
    }
  }

  const shaped = shapeBulkSinglesOutcome(preps);

  if (shaped.phase === "error") {
    return { ok: false, error: shaped.error };
  }
  if (shaped.phase === "needs_confirm") {
    return {
      ok: false,
      needsConfirm: shaped.needsConfirm,
      unavailable: shaped.unavailable.length ? shaped.unavailable : undefined,
    };
  }
  if (shaped.phase === "unavailable_only") {
    // Nothing to write — still return unavailable for the slip prompt path.
    // Failed lines (if any) are not written either; client keeps them via no written keys.
    return { ok: false, unavailable: shaped.unavailable };
  }

  // Write every ready line independently (only shaped.ready — never stale/needsConfirm).
  const readyByKey = new Map(readyWrites.map((r) => [r.moveKey, r]));
  const writtenReceipts: StraightReceipt[] = [];
  const writtenMoveKeys: string[] = [];
  for (const row of shaped.ready) {
    const ready = readyByKey.get(row.moveKey);
    if (!ready) continue;
    const play = await prisma.play.create({
      data: {
        capperId: profile.id,
        ...(await playCreateData(ready.data)),
        source: "MANUAL",
      },
      select: { createdAt: true },
    });
    writtenMoveKeys.push(ready.moveKey);
    writtenReceipts.push({
      ...ready.receiptBase,
      capturedAt: play.createdAt.toISOString(),
    });
  }

  revalidatePath("/dashboard");
  revalidatePath("/dashboard/picks");

  const suspended = shaped.unavailable.map((u) => ({
    kind: "suspended" as const,
    selection: u.selection,
    reason: "line unavailable or suspended",
    moveKey: u.moveKey,
    market: u.market,
  }));
  const receipt = buildBulkSinglesReceipt({
    picks: writtenReceipts,
    attemptedCount: inputs.length,
    writtenMoveKeys,
    suspended,
    failed: shaped.failed,
  });

  return {
    ok: true,
    receipt,
    unavailable: shaped.unavailable.length ? shaped.unavailable : undefined,
  };
}
