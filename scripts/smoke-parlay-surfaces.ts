/**
 * CI smoke: every public surface that lists or aggregates positions of record
 * must return parlays, not straight picks alone.
 *
 * This is the regression guard for the split that hid @wisegentlemensports_parlay
 * — a capper who posts nothing but parlays — from their own Pick History, the
 * public ledger, and the home board while their leaderboard record kept moving.
 * Unit tests cannot catch it: the bug lived in Prisma `where` clauses, so the
 * check has to run real queries against a real database.
 *
 * DESTRUCTIVE — it truncates the schema it runs against. It refuses to run
 * anywhere but a local throwaway database.
 */
import assert from "node:assert/strict";

import { prisma } from "@/lib/prisma";
import { getPublicProfileHistoryPage } from "@/lib/queries/capper";
import { encodeHistoryCursor } from "@/lib/profile-history";
import { getPublicRecentPickRows } from "@/lib/queries/plays";
import { getYesterdaysGradedWins } from "@/lib/queries/yesterday-wins";
import { getLiveActivityTicker } from "@/lib/queries/live-activity-ticker";
import {
  getFeaturedGradedPlay,
  getTodaysGradedMoves,
} from "@/lib/queries/home-live";
import {
  joinParlaysToPublicPicks,
  joinPlaysToPublicPicks,
  mergePublicPicks,
} from "@/lib/public-picks";

const HANDLE = "parlayonlycapper";

/**
 * The script deletes every row it can see, so it must never point at a shared
 * database. Local host only, never a production environment.
 */
function assertThrowawayDatabase(): void {
  const url = process.env.DATABASE_URL ?? "";
  const host = (() => {
    try {
      return new URL(url).hostname;
    } catch {
      return "";
    }
  })();
  const local = host === "localhost" || host === "127.0.0.1" || host === "::1";
  if (
    !local ||
    process.env.NODE_ENV === "production" ||
    process.env.VERCEL_ENV === "production"
  ) {
    throw new Error(
      "smoke-parlay-surfaces truncates its database and only runs against a local one.",
    );
  }
}

async function reset() {
  await prisma.parlayGradingAudit.deleteMany({});
  await prisma.gradingAudit.deleteMany({});
  await prisma.play.deleteMany({});
  await prisma.parlay.deleteMany({});
  await prisma.capperProfile.deleteMany({});
  await prisma.user.deleteMany({});
}

async function seed() {
  const now = new Date();
  const hoursAgo = (h: number) => new Date(now.getTime() - h * 3_600_000);

  const user = await prisma.user.create({
    data: {
      email: `${HANDLE}@example.com`,
      username: HANDLE,
      displayName: "Parlay Only",
      accountStatus: "ACTIVE",
      emailVerified: now,
      role: "CAPPER",
      capperProfile: { create: {} },
    },
    include: { capperProfile: true },
  });
  const capperId = user.capperProfile!.id;

  // One old straight pick (the "last row anyone could see" case).
  await prisma.play.create({
    data: {
      capperId,
      sport: "MLB",
      league: "MLB",
      market: "Moneyline",
      selection: "Yankees ML",
      side: "Yankees",
      oddsAmerican: -140,
      units: 1,
      outcome: "WIN",
      profitUnits: 0.71,
      status: "COMMITTED",
      verificationTier: "VERIFIED",
      eventStartsAt: hoursAgo(400),
      eventLabel: "Red Sox @ Yankees",
      createdAt: hoursAgo(405),
      gradedAt: hoursAgo(396),
    },
  });

  // A graded parlay from a few hours ago — every surface should carry it.
  const graded = await prisma.parlay.create({
    data: {
      capperId,
      combinedOddsAmerican: 121,
      units: 3,
      outcome: "WIN",
      profitUnits: 3.64,
      createdAt: hoursAgo(6),
      gradedAt: hoursAgo(1),
    },
  });
  for (const [index, selection] of ["Mets ML", "Dodgers ML"].entries()) {
    await prisma.play.create({
      data: {
        capperId,
        parlayId: graded.id,
        sport: "MLB",
        league: "MLB",
        market: "Moneyline",
        selection,
        side: selection.split(" ")[0],
        oddsAmerican: -175,
        // Legs carry no stake of their own — the parlay holds it.
        units: 0,
        outcome: "WIN",
        status: "COMMITTED",
        verificationTier: "VERIFIED",
        eventStartsAt: hoursAgo(5 - index),
        eventLabel: index === 0 ? "Braves @ Mets" : "Padres @ Dodgers",
        createdAt: hoursAgo(6),
        gradedAt: hoursAgo(1),
      },
    });
  }

  // A pending parlay whose games have not started — must stay sealed.
  const pending = await prisma.parlay.create({
    data: {
      capperId,
      combinedOddsAmerican: 260,
      units: 2,
      outcome: "PENDING",
      createdAt: hoursAgo(1),
    },
  });
  await prisma.play.create({
    data: {
      capperId,
      parlayId: pending.id,
      sport: "NFL",
      league: "NFL",
      market: "Spread",
      selection: "Chiefs -3.5",
      side: "Chiefs",
      oddsAmerican: -110,
      units: 0,
      outcome: "PENDING",
      status: "COMMITTED",
      verificationTier: "VERIFIED",
      eventStartsAt: new Date(now.getTime() + 6 * 3_600_000),
      eventLabel: "Chiefs @ Bills",
      createdAt: hoursAgo(1),
    },
  });

  return { capperId };
}

type CapperSummaryLike = Parameters<typeof joinPlaysToPublicPicks>[1][number];
const summary: CapperSummaryLike[] = [];

async function main() {
  assertThrowawayDatabase();
  await reset();
  const { capperId } = await seed();

  // 1. Profile Pick History
  const history = await getPublicProfileHistoryPage(HANDLE);
  const kinds = history.entries.map((entry) => entry.kind);
  assert.deepEqual(kinds, ["parlay", "parlay", "play"], `history: ${kinds}`);
  const sealed = history.entries[0];
  assert.equal(sealed?.kind, "parlay");
  assert.equal(sealed?.isEmbargoed, true, "pending parlay must stay sealed");
  if (sealed?.kind === "parlay") {
    assert.equal(sealed.combinedOddsAmerican, null, "sealed price");
    assert.equal(sealed.legs[0]?.selection, "Pick hidden");
  }
  const gradedEntry = history.entries[1];
  if (gradedEntry?.kind === "parlay") {
    assert.equal(gradedEntry.combinedOddsAmerican, 121);
    assert.equal(gradedEntry.legs.length, 2);
    assert.equal(gradedEntry.profitUnits, 3.64);
  } else {
    assert.fail("second history row should be the graded parlay");
  }

  // Three positions fit on one page, so the ledger reports no next cursor.
  assert.equal(history.nextCursor, null, "one page holds every position");

  // Cursor paging across both tables: resume below the newest position and the
  // remaining two — one parlay, one straight pick — come back in order.
  const resumed = await getPublicProfileHistoryPage(
    HANDLE,
    encodeHistoryCursor(history.entries[0]!),
  );
  assert.deepEqual(
    resumed.entries.map((entry) => entry.kind),
    ["parlay", "play"],
    `resumed: ${resumed.entries.map((e) => e.kind).join(",")}`,
  );

  // 2. Public picks ledger
  const feed = await getPublicRecentPickRows(24);
  assert.equal(feed.parlays.length, 2, "feed parlays");
  assert.equal(feed.plays.length, 1, "feed straight plays");
  summary.push({
    id: capperId,
    name: "Parlay Only",
    handle: HANDLE,
    verified: true,
    record: { w: 2, l: 0, p: 0 },
    rank: 1,
  } as CapperSummaryLike);
  const picks = mergePublicPicks(
    joinPlaysToPublicPicks(feed.plays, summary),
    joinParlaysToPublicPicks(feed.parlays, summary),
  );
  assert.deepEqual(
    picks.map((pick) => pick.selection),
    ["1-Leg Parlay", "2-Leg Parlay", "Yankees ML"],
    `ledger: ${picks.map((p) => p.selection).join(", ")}`,
  );

  // 3. Graded-results ticker
  const ticker = await getYesterdaysGradedWins();
  assert.ok(
    ticker.results.some((row) => row.selection === "2-Leg Parlay"),
    `graded ticker: ${JSON.stringify(ticker.results)}`,
  );

  // 4. Homepage marquee
  const marquee = await getLiveActivityTicker();
  assert.equal(marquee.failed, false);
  assert.ok(
    marquee.items.some((item) => item.kind === "win"),
    "marquee should carry the parlay win",
  );
  assert.ok(
    marquee.items.some((item) => item.kind === "posted"),
    "marquee should carry the posted parlay",
  );

  // 5. Today's moves — the parlay graded within the ET day
  const moves = await getTodaysGradedMoves();
  assert.ok(
    moves.moves.some((move) => move.handle === HANDLE),
    `today's moves: ${JSON.stringify(moves)}`,
  );

  // 6. Featured proof receipt — newest graded position is the parlay
  const featured = await getFeaturedGradedPlay();
  assert.equal(featured.play?.selection, "2-Leg Parlay");
  assert.equal(featured.play?.parlay?.legs.length, 2);
  assert.equal(featured.play?.market, "Parlay");

  console.log("All public parlay surfaces returned the parlay positions ✔");
}

main()
  .then(() => reset())
  .then(() => prisma.$disconnect())
  .catch(async (error) => {
    console.error(error);
    await prisma.$disconnect();
    process.exit(1);
  });
