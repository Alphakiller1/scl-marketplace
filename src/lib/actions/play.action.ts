"use server";

import { revalidatePath } from "next/cache";

import { assertAnalysisSafe } from "@/lib/analysis-moderation";
import { confirmedBoardEvent } from "@/lib/board-selection-confirmation";
import {
  buildBulkSinglesReceipt,
  shapeBulkSinglesOutcome,
  type BulkLinePrep,
} from "@/lib/bulk-plays";
import { isBookKey } from "@/lib/books";
import { moveKey } from "@/lib/odds-movement";
import { etDayBounds } from "@/lib/et-day";
import {
  capperDefaultPackageIds,
  resolvePackageAttribution,
  validatePackageAttribution,
} from "@/lib/package-attribution";
import { decidePickIntegrity } from "@/lib/odds-verify";
import { americanToDecimal } from "@/lib/odds";
import { isExtremeAmericanOdds } from "@/lib/odds-board";
import { prisma } from "@/lib/prisma";
import {
  hasNeedsReviewColumn,
  hasNotesPublicColumn,
} from "@/lib/results/schema-features";
import { playSchema, type PlayInput } from "@/lib/schemas/play.schema";
import { getCurrentAccount } from "@/lib/session";
import {
  straightExposureError,
  straightExposureEventIds,
} from "@/lib/straight-exposure";
import type { Prisma } from "@prisma/client";
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
  isSupermax: boolean;
  supermaxDay: Date | null;
  notes: string | null;
  notesPublic: boolean;
  needsReview: boolean;
  eventId: string;
  eventLabel: string | null;
  homeTeam: string;
  awayTeam: string;
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
  | { ok: false; error: string };

export type CreatePlaysResult =
  | { ok: true; receipt: BulkSinglesReceipt }
  | { ok: false; error: string };

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
  packageIds: string[];
  data: {
    sport: string;
    league: string | null;
    market: string;
    selection: string;
    oddsAmerican: number;
    selectedOddsAmerican: number;
    oddsMovedAccepted: boolean;
    units: number;
    isSupermax: boolean;
    supermaxDay: Date | null;
    notes: string | null;
    notesPublic: boolean;
    needsReview: boolean;
    eventId: string;
    eventLabel: string | null;
    homeTeam: string;
    awayTeam: string;
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

/** Enforces daily Supermax uniqueness and the lifetime 10u duplicate-straight cap. */
async function validateStraightLimits(
  tx: Prisma.TransactionClient,
  capperId: string,
  writes: ReadyWrite[],
  now: Date,
): Promise<string | null> {
  const { start, end } = etDayBounds(0, now);
  const eventIds = straightExposureEventIds(writes.map((write) => write.data));
  const existing = await tx.play.findMany({
    where: {
      capperId,
      parlayId: null,
      OR: [
        // Daily rows enforce the one-Supermax policy even when it is on a
        // different event from the incoming straight.
        { createdAt: { gte: start, lt: end } },
        // Duplicate exposure follows the event, not the submission date. A
        // future event may receive picks on more than one calendar day.
        ...(eventIds.length > 0 ? [{ eventId: { in: eventIds } }] : []),
      ],
    },
    select: {
      eventId: true,
      market: true,
      selection: true,
      side: true,
      line: true,
      units: true,
      isSupermax: true,
    },
  });

  return straightExposureError(
    existing.map((play) => ({ ...play, units: Number(play.units) })),
    writes.map((write) => write.data),
  );
}

/**
 * Shared per-line validation body (createPlay / createPlays).
 *
 * Submission deliberately does not call the odds provider or re-price the line.
 * Manual entry is disabled, so a structured pre-game board selection is captured
 * exactly as selected and recorded as VERIFIED. This keeps pick logging available
 * when odds move, a market is suspended, or the provider is unavailable.
 * Does not write — caller persists ReadyWrite rows.
 */
async function preparePlayLine(
  input: PlayInput,
  opts: { now: Date },
): Promise<
  | { status: "ready"; ready: ReadyWrite }
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
      error:
        parsed.error.issues[0]?.message ??
        "Please check the form and try again.",
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
  // No live betting — SCL only accepts pre-game picks. Once the event has
  // started, the pick is rejected outright (never logged as live/self-reported).
  if (eventStartsAt.getTime() <= Date.now()) {
    return {
      status: "error",
      error:
        "This event has already started. SCL only accepts pre-game picks — no live betting.",
      selection: d.selection,
      market: d.market,
    };
  }
  const key = moveKey({
    eventId: d.eventId,
    market: d.market,
    side: d.side,
    line: d.line,
    player: d.player,
  });
  const captureBook = d.book && isBookKey(d.book) ? d.book : null;
  const confirmedEvent = await confirmedBoardEvent({
    sport: d.sport,
    eventId: d.eventId,
    eventStartsAt,
    market: d.market,
    side: d.side,
    line: d.line,
    player: d.player,
    // A team total names its club here and nowhere else.
    selection: d.selection,
    oddsAmerican: d.oddsAmerican,
    book: captureBook,
  });
  if (!confirmedEvent) {
    return {
      status: "error",
      error:
        "This line could not be confirmed from the SCL board. Reopen the matchup and select it again.",
      moveKey: key,
      selection: d.selection,
      market: d.market,
    };
  }

  const decision = decidePickIntegrity({
    now: opts.now,
    eventStartsAt,
    eventBound: true,
    verify: null,
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
      packageIds: d.packageIds,
      data: {
        sport: d.sport,
        league: d.league ?? null,
        market: d.market,
        selection: d.selection,
        oddsAmerican: d.oddsAmerican,
        selectedOddsAmerican: d.oddsAmerican,
        oddsMovedAccepted: false,
        units: d.units,
        isSupermax: d.isSupermax,
        supermaxDay: d.isSupermax ? etDayBounds(0, opts.now).start : null,
        notes: d.notes ?? null,
        notesPublic: d.notesPublic ?? true,
        needsReview: isExtremeAmericanOdds(d.oddsAmerican),
        eventId: d.eventId,
        eventLabel: `${confirmedEvent.away} @ ${confirmedEvent.home}`,
        homeTeam: confirmedEvent.home,
        awayTeam: confirmedEvent.away,
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
        oddsAmerican: d.oddsAmerican,
        loggedPreGame: decision.loggedPreGame,
        oddsVerified: decision.oddsVerified,
        tier: decision.tier,
        units: d.units,
        toWinUnits: d.units * (americanToDecimal(d.oddsAmerican) - 1),
        book: captureBook,
        eventLabel: `${confirmedEvent.away} @ ${confirmedEvent.home}`,
        eventStartsAt: eventStartsAt.toISOString(),
      },
    },
  };
}

export async function createPlay(input: PlayInput): Promise<PlayResult> {
  const gate = await requireActiveCapper();
  if (!gate.ok) return gate;

  const profile = await prisma.capperProfile.findUnique({
    where: { userId: gate.userId },
    select: { id: true },
  });
  if (!profile) return { ok: false, error: "No capper profile found." };

  const now = new Date();
  const prep = await preparePlayLine(input, { now });
  if (prep.status === "error") {
    return { ok: false, error: prep.error };
  }

  const packageIds = await resolvePackageAttribution(
    profile.id,
    prep.ready.packageIds,
  );
  if (!packageIds) {
    return {
      ok: false,
      error: "One or more selected packages are unavailable.",
    };
  }

  const writeResult = await prisma.$transaction(async (tx) => {
    // Serialize each capper's straight writes so concurrent tabs cannot both
    // pass the combined-exposure check before either row exists.
    await tx.$queryRaw`SELECT pg_advisory_xact_lock(hashtext(${`straight-exposure:${profile.id}`}))`;
    const exposureError = await validateStraightLimits(
      tx,
      profile.id,
      [prep.ready],
      now,
    );
    if (exposureError) return { ok: false as const, error: exposureError };

    const play = await tx.play.create({
      data: {
        capperId: profile.id,
        ...(await playCreateData(prep.ready.data)),
        source: "MANUAL",
        packageLinks: {
          create: packageIds.map((packageId) => ({ packageId })),
        },
      },
      select: { createdAt: true },
    });
    return { ok: true as const, createdAt: play.createdAt };
  });
  if (!writeResult.ok) return writeResult;

  revalidatePath("/dashboard");
  revalidatePath("/dashboard/picks");
  return {
    ok: true,
    receipt: {
      ...prep.ready.receiptBase,
      capturedAt: writeResult.createdAt.toISOString(),
    },
  };
}

/**
 * Bulk singles submit. Every valid pre-game board selection writes without an
 * odds-provider round trip. Invalid rows are surfaced on the bulk receipt.
 */
export async function createPlays(
  inputs: PlayInput[],
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
    select: { id: true },
  });
  if (!profile) return { ok: false, error: "No capper profile found." };

  const now = new Date();
  const preps: BulkLinePrep[] = [];
  const readyWrites: ReadyWrite[] = [];

  for (const input of inputs) {
    const prep = await preparePlayLine(input, { now });
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

  if (shaped.phase !== "write") {
    return {
      ok: false,
      error:
        shaped.phase === "error"
          ? shaped.error
          : "Unable to prepare these picks. Refresh the board and try again.",
    };
  }

  const requestedPackageIds = [
    ...new Set(readyWrites.flatMap((ready) => ready.packageIds)),
  ];
  const validPackageIds = await validatePackageAttribution(
    profile.id,
    requestedPackageIds,
  );
  if (!validPackageIds) {
    return {
      ok: false,
      error: "One or more selected packages are unavailable.",
    };
  }

  // Resolved per line, not from the union: a line that named no package fans out
  // to the whole storefront, and one that named packages keeps exactly those.
  const needsDefault = readyWrites.some(
    (ready) => ready.packageIds.length === 0,
  );
  const defaultPackageIds = needsDefault
    ? await capperDefaultPackageIds(profile.id)
    : [];

  // Validate and write the full batch under the same capper-scoped lock. This
  // makes the 10u combined limit deterministic even across concurrent tabs.
  const writeResult = await prisma.$transaction(async (tx) => {
    await tx.$queryRaw`SELECT pg_advisory_xact_lock(hashtext(${`straight-exposure:${profile.id}`}))`;
    const exposureError = await validateStraightLimits(
      tx,
      profile.id,
      readyWrites,
      now,
    );
    if (exposureError) return { ok: false as const, error: exposureError };

    const readyByKey = new Map(
      readyWrites.map((ready) => [ready.moveKey, ready]),
    );
    const writtenReceipts: StraightReceipt[] = [];
    const writtenMoveKeys: string[] = [];
    for (const row of shaped.ready) {
      const ready = readyByKey.get(row.moveKey);
      if (!ready) continue;
      const play = await tx.play.create({
        data: {
          capperId: profile.id,
          ...(await playCreateData(ready.data)),
          source: "MANUAL",
          packageLinks: {
            create: (ready.packageIds.length > 0
              ? ready.packageIds
              : defaultPackageIds
            ).map((packageId) => ({ packageId })),
          },
        },
        select: { createdAt: true },
      });
      writtenMoveKeys.push(ready.moveKey);
      writtenReceipts.push({
        ...ready.receiptBase,
        capturedAt: play.createdAt.toISOString(),
      });
    }
    return { ok: true as const, writtenReceipts, writtenMoveKeys };
  });
  if (!writeResult.ok) return writeResult;

  revalidatePath("/dashboard");
  revalidatePath("/dashboard/picks");

  const receipt = buildBulkSinglesReceipt({
    picks: writeResult.writtenReceipts,
    attemptedCount: inputs.length,
    writtenMoveKeys: writeResult.writtenMoveKeys,
    failed: shaped.failed,
  });

  return { ok: true, receipt };
}
