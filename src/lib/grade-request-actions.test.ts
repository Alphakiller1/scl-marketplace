import assert from "node:assert/strict";
import test from "node:test";

import * as bulkCorrection from "@/lib/bulk-correction";
import type { CorrectionPlay } from "@/lib/bulk-correction";
import * as gradeRequests from "@/lib/grade-requests";
import * as grading from "@/lib/grading";
import * as gradingCorrection from "@/lib/grading-correction";
import * as requestSchema from "@/lib/schemas/grade-request.schema";
import { loadTestModule } from "@/lib/test-support/load-module";
import type * as BulkAction from "@/lib/actions/bulk-correction.action";
import type * as RequestAction from "@/lib/actions/grade-request.action";

/** Values built inside the VM context carry foreign prototypes. */
const plain = <T>(value: T): T => JSON.parse(JSON.stringify(value)) as T;

// ---------------------------------------------------------------------------
// Capper: submit a request
// ---------------------------------------------------------------------------

const lossPick = gradeRequests.straightPickDetails({
  id: "play_1",
  sport: "NBA",
  league: "NBA",
  market: "Rebounds",
  selection: "Jabari Smith Jr Over 4.5",
  oddsAmerican: -115,
  units: 1,
  book: "draftkings",
  outcome: "LOSS",
  profitUnits: -1,
  eventLabel: "Houston Rockets @ Atlanta Hawks",
  homeTeam: null,
  awayTeam: null,
  eventStartsAt: new Date("2026-11-12T00:30:00Z"),
  createdAt: new Date("2026-11-11T18:00:00Z"),
});

const ticketPick = gradeRequests.parlayPickDetails({
  id: "ticket_1",
  combinedOddsAmerican: 264,
  units: 1,
  outcome: "LOSS",
  profitUnits: -1,
  createdAt: new Date("2026-11-11T17:00:00Z"),
  legs: [
    {
      id: "leg_a",
      sport: "NFL",
      market: "Moneyline",
      selection: "Detroit Lions",
      oddsAmerican: -150,
      outcome: "WIN",
      eventLabel: null,
      homeTeam: null,
      awayTeam: null,
      eventStartsAt: null,
    },
    {
      id: "leg_b",
      sport: "NFL",
      market: "Receiving Yds",
      selection: "George Pickens Over 59.5",
      oddsAmerican: -110,
      outcome: "LOSS",
      eventLabel: null,
      homeTeam: null,
      awayTeam: null,
      eventStartsAt: null,
    },
  ],
});

type SubmitWorld = {
  account?: Record<string, unknown> | null;
  pick?: typeof lossPick | null;
  open?: { id: string; createdAt: Date } | null;
  allowed?: boolean;
  delivered?: boolean;
};

function submitHarness(world: SubmitWorld = {}) {
  const created: Record<string, unknown>[] = [];
  const updated: Record<string, unknown>[] = [];
  const emails: Record<string, unknown>[] = [];
  const pickLookups: unknown[][] = [];
  const revalidated: string[] = [];
  const action = loadTestModule<typeof RequestAction>(
    "src/lib/actions/grade-request.action.ts",
    {
      "next/cache": {
        revalidatePath: (path: string) => {
          revalidated.push(path);
        },
      },
      "@/lib/email": {
        sendGradeRequestEmail: async (input: Record<string, unknown>) => {
          emails.push(input);
          return world.delivered === false
            ? { delivered: false, error: "domain not verified" }
            : { delivered: true };
        },
      },
      "@/lib/email-verification-policy": {
        emailVerificationEnforced: () => true,
      },
      "@/lib/grade-requests": gradeRequests,
      "@/lib/schemas/grade-request.schema": requestSchema,
      "@/lib/rate-limit": {
        consumeRateLimit: async () => world.allowed !== false,
      },
      "@/lib/session": {
        getCurrentAccount: async () =>
          world.account === undefined
            ? {
                id: "user_1",
                accountStatus: "ACTIVE",
                emailVerified: new Date(),
                legalAcceptance: { policyVersion: "v1" },
              }
            : world.account,
        requireAdmin: async () => ({ id: "admin" }),
      },
      "@/lib/queries/grade-request-pick": {
        loadRequestingCapper: async () => ({
          id: "capper_1",
          user: {
            username: "petespicks",
            displayName: "Pete",
            email: "pete@example.com",
          },
        }),
        loadCapperPickForRequest: async (...args: unknown[]) => {
          pickLookups.push(args);
          return world.pick === undefined ? lossPick : world.pick;
        },
        findOpenGradeRequest: async () => world.open ?? null,
      },
      "@/lib/prisma": {
        prisma: {
          gradeRequest: {
            create: async ({ data }: { data: Record<string, unknown> }) => {
              created.push(data);
              return { id: "req_1", createdAt: new Date("2026-11-12T04:00Z") };
            },
            update: async ({ data }: { data: Record<string, unknown> }) => {
              updated.push(data);
            },
          },
        },
      },
    },
  );
  return { action, created, updated, emails, pickLookups, revalidated };
}

const regrade: requestSchema.SubmitGradeRequestInput = {
  type: "REGRADE",
  kind: "straight",
  pickId: "play_1",
  commentary: "Box score shows 5 rebounds — the over cashed.",
};

test("a request is saved from the stored pick, then SCL support is emailed", async () => {
  const world = submitHarness();
  const result = await world.action.submitGradeRequestAction(regrade);
  assert.deepEqual(plain(result), {
    ok: true,
    requestId: "req_1",
    requestType: "REGRADE",
  });
  // Ownership is enforced in the lookup: the capper's own profile id.
  assert.deepEqual(plain(world.pickLookups), [
    ["capper_1", "straight", "play_1"],
  ]);
  assert.equal(world.created.length, 1);
  const row = world.created[0]!;
  assert.equal(row.type, "REGRADE");
  assert.equal(row.capperId, "capper_1");
  assert.equal(row.playId, "play_1");
  assert.equal(row.parlayId, null);
  assert.equal(row.outcomeAtRequest, "LOSS");
  assert.equal(row.profitUnitsAtRequest, -1);
  assert.equal(row.commentary, regrade.commentary);
  assert.equal(
    row.pickSummary,
    "Jabari Smith Jr Over 4.5 Rebounds · Houston Rockets @ Atlanta Hawks · -115 · 1U",
  );
  assert.equal(world.emails.length, 1);
  assert.equal(world.emails[0]!.requestId, "req_1");
  assert.ok(world.updated[0]!.emailSentAt instanceof Date);
  // Revalidating would re-render the request screen, which then finds this
  // request and replaces the capper's confirmation with "already sent".
  assert.deepEqual(world.revalidated, []);
});

test("a mail failure keeps the request (the queue has it) and records why", async () => {
  const world = submitHarness({ delivered: false });
  const result = await world.action.submitGradeRequestAction(regrade);
  assert.equal(result.ok, true);
  assert.equal(world.created.length, 1);
  assert.equal(world.updated[0]!.emailError, "domain not verified");
});

test("requests are refused for someone else's pick, ungraded picks, voids, duplicates and floods", async () => {
  const cases: [
    SubmitWorld,
    Partial<requestSchema.SubmitGradeRequestInput>,
    RegExp,
  ][] = [
    [{ pick: null }, {}, /couldn't find that pick on your account/],
    [
      { pick: { ...lossPick, outcome: "PENDING", profitUnits: null } },
      {},
      /hasn't been graded yet/,
    ],
    [
      { pick: { ...lossPick, outcome: "VOID", profitUnits: 0 } },
      { type: "INJURY_PROTECTION" },
      /already void/,
    ],
    [
      { open: { id: "r0", createdAt: new Date("2026-11-11T20:00Z") } },
      {},
      /already have an open regrade request/,
    ],
    [{ allowed: false }, {}, /lot of requests/],
    [{ account: null }, {}, /Sign in/],
    [
      {
        account: {
          id: "u",
          accountStatus: "SUSPENDED",
          emailVerified: new Date(),
          legalAcceptance: {},
        },
      },
      {},
      /not active/,
    ],
    [
      {
        account: {
          id: "u",
          accountStatus: "ACTIVE",
          emailVerified: null,
          legalAcceptance: {},
        },
      },
      {},
      /Verify your email/,
    ],
  ];
  for (const [world, overrides, message] of cases) {
    const harness = submitHarness(world);
    const result = await harness.action.submitGradeRequestAction({
      ...regrade,
      ...overrides,
    });
    assert.equal(result.ok, false, String(message));
    assert.match((result as { error: string }).error, message);
    assert.equal(harness.created.length, 0, String(message));
    assert.equal(harness.emails.length, 0, String(message));
  }
});

test("commentary is required", async () => {
  const world = submitHarness();
  const result = await world.action.submitGradeRequestAction({
    ...regrade,
    commentary: "  wrong  ",
  });
  assert.equal(result.ok, false);
  assert.match(
    (result as { fieldErrors?: { commentary?: string } }).fieldErrors
      ?.commentary ?? "",
    /at least 20 characters/,
  );
  assert.equal(world.created.length, 0);
});

test("a parlay request records the ticket and the leg — and rejects a leg from elsewhere", async () => {
  const ok = submitHarness({ pick: ticketPick });
  const result = await ok.action.submitGradeRequestAction({
    type: "INJURY_PROTECTION",
    kind: "parlay",
    pickId: "ticket_1",
    legId: "leg_b",
    commentary: "Pickens left in the 1st quarter with a hamstring injury.",
  });
  assert.equal(result.ok, true);
  assert.equal(ok.created[0]!.parlayId, "ticket_1");
  assert.equal(ok.created[0]!.playId, "leg_b");
  assert.match(String(ok.created[0]!.pickSummary), /Leg 2: George Pickens/);

  const bad = submitHarness({ pick: ticketPick });
  const refused = await bad.action.submitGradeRequestAction({
    type: "REGRADE",
    kind: "parlay",
    pickId: "ticket_1",
    legId: "leg_from_another_ticket",
    commentary: "This leg was graded against the wrong game.",
  });
  assert.equal(refused.ok, false);
  assert.equal(bad.created.length, 0);
});

// ---------------------------------------------------------------------------
// Admin: one capper or every capper
// ---------------------------------------------------------------------------

function cp(overrides: Partial<CorrectionPlay>): CorrectionPlay {
  return {
    id: "x",
    capperId: "c",
    capperLabel: "@c",
    sport: "NFL",
    market: "Receiving Yds",
    selection: "George Pickens Over 59.5",
    side: "Over",
    line: 59.5,
    eventId: "evt",
    eventLabel: null,
    homeTeam: null,
    awayTeam: null,
    eventStartsAt: "2026-11-09T01:20:00.000Z",
    createdAt: "2026-11-08T12:00:00.000Z",
    oddsAmerican: -110,
    units: 1,
    outcome: "LOSS",
    profitUnits: -1,
    parlay: null,
    ...overrides,
  };
}

const ticketLegs = [
  { id: "L1", outcome: "LOSS" as const, oddsAmerican: -110 },
  { id: "L2", outcome: "WIN" as const, oddsAmerican: 100 },
];
const S1 = cp({ id: "S1", capperId: "A", capperLabel: "@a" });
const S2 = cp({ id: "S2", capperId: "B", capperLabel: "@b" });
const L1 = cp({
  id: "L1",
  capperId: "C",
  capperLabel: "@c",
  profitUnits: null,
  parlay: {
    id: "T",
    units: 1,
    outcome: "LOSS",
    profitUnits: -1,
    legs: ticketLegs,
  },
});
const R1 = cp({
  id: "R1",
  capperId: "D",
  capperLabel: "@d",
  selection: "George Pickens Under 59.5",
  side: "Under",
  outcome: "WIN",
  profitUnits: 0.91,
});

type TxCall = { op: string; args: Record<string, unknown> };

function bulkHarness(
  opts: { straightWrite?: number; freshTicketLegs?: typeof ticketLegs } = {},
) {
  const calls: TxCall[] = [];
  const resolved: Record<string, unknown>[] = [];
  const tags: string[] = [];
  let transactions = 0;
  const record =
    (op: string, result: unknown = undefined) =>
    async (args: Record<string, unknown>) => {
      calls.push({ op, args });
      return typeof result === "function" ? result(args) : result;
    };
  const tx = {
    play: {
      updateMany: record(
        "play.updateMany",
        (args: { where: { id: string } }) => ({
          count: args.where.id.startsWith("S") ? (opts.straightWrite ?? 1) : 1,
        }),
      ),
    },
    gradingAudit: { create: record("gradingAudit.create") },
    parlay: {
      findUnique: record("parlay.findUnique", {
        outcome: "LOSS",
        profitUnits: -1,
        units: 1,
        legs: opts.freshTicketLegs ?? ticketLegs,
      }),
      update: record("parlay.update"),
    },
    parlayGradingAudit: { create: record("parlayGradingAudit.create") },
  };
  const action = loadTestModule<typeof BulkAction>(
    "src/lib/actions/bulk-correction.action.ts",
    {
      "next/cache": {
        revalidatePath: () => {},
        revalidateTag: (tag: string) => tags.push(tag),
      },
      "@/lib/bulk-correction": bulkCorrection,
      "@/lib/grade-requests": gradeRequests,
      "@/lib/grading": grading,
      "@/lib/grading-correction": gradingCorrection,
      "@/lib/schemas/grade-request.schema": requestSchema,
      "@/lib/session": { requireAdmin: async () => ({ id: "admin_1" }) },
      "@/lib/results/schema-features": { hasClvColumns: async () => false },
      "@/lib/results/closing-snapshot": { clvPtsForGrade: () => null },
      "@/lib/results/settlement-lock": {
        lockParlaySettlement: async (_tx: unknown, id: string) => {
          calls.push({ op: "lock", args: { id } });
        },
      },
      "@/lib/grade-request-resolution": {
        resolveGradeRequestsForPicks: async (
          input: Record<string, unknown>,
        ) => {
          resolved.push(input);
          return 2;
        },
      },
      "@/lib/queries/bulk-correction": {
        loadCorrectionCandidates: async (ids: string[]) =>
          new Map(
            ids.map((id) => [
              id,
              { exact: [S1, S2, L1], related: [R1], truncated: false },
            ]),
          ),
      },
      "@/lib/prisma": {
        prisma: {
          capperProfile: { findMany: async () => [] },
          play: { findMany: async () => [] },
          $transaction: async (
            fn: (client: typeof tx) => Promise<unknown>,
            options: { timeout: number },
          ) => {
            transactions++;
            assert.ok(options.timeout >= 30_000);
            return fn(tx);
          },
        },
      },
    },
  );
  return { action, calls, resolved, tags, transactions: () => transactions };
}

const voidAll = {
  sourcePlayId: "S1",
  outcome: "VOID" as const,
  reason: "Injury protection: Pickens left in 1Q",
  confirmedPublicImpact: true,
  targets: [
    { playId: "S1", expectedOutcome: "LOSS" as const },
    { playId: "S2", expectedOutcome: "LOSS" as const },
    { playId: "L1", expectedOutcome: "LOSS" as const },
  ],
};

test("one save voids the pick for every capper and re-settles the parlay", async () => {
  const world = bulkHarness();
  const result = await world.action.applyBulkCorrectionAction(voidAll);
  assert.deepEqual(plain(result), {
    ok: true,
    changedPlays: 3,
    straightsChanged: 2,
    parlaysResettled: 1,
    cappersAffected: 3,
    requestsResolved: 2,
  });
  assert.equal(world.transactions(), 1);

  const straightWrites = world.calls.filter(
    (c) =>
      c.op === "play.updateMany" &&
      String((c.args.where as { id: string }).id).startsWith("S"),
  );
  assert.deepEqual(
    plain(
      straightWrites.map((c) => [
        c.args.where,
        (c.args.data as { outcome: string; profitUnits: number }).outcome,
        (c.args.data as { profitUnits: number }).profitUnits,
      ]),
    ),
    [
      [
        { id: "S1", parlayId: null, outcome: "LOSS", profitUnits: -1 },
        "VOID",
        0,
      ],
      [
        { id: "S2", parlayId: null, outcome: "LOSS", profitUnits: -1 },
        "VOID",
        0,
      ],
    ],
  );
  const audits = world.calls.filter((c) => c.op === "gradingAudit.create");
  assert.equal(audits.length, 3);
  for (const audit of audits) {
    const data = audit.args.data as Record<string, unknown>;
    assert.equal(data.source, "ADMIN_OVERRIDE");
    assert.equal(data.gradedById, "admin_1");
    assert.equal(data.reason, voidAll.reason);
    assert.equal(data.newOutcome, "VOID");
  }

  // The ticket is locked before it is read, and L2 (+100) is all that pays.
  const lockAt = world.calls.findIndex((c) => c.op === "lock");
  const readAt = world.calls.findIndex((c) => c.op === "parlay.findUnique");
  assert.ok(lockAt >= 0 && lockAt < readAt);
  const parentWrite = world.calls.find((c) => c.op === "parlay.update")!;
  assert.deepEqual(
    plain({
      outcome: (parentWrite.args.data as Record<string, unknown>).outcome,
      profitUnits: (parentWrite.args.data as Record<string, unknown>)
        .profitUnits,
      combinedOddsAmerican: (parentWrite.args.data as Record<string, unknown>)
        .combinedOddsAmerican,
    }),
    { outcome: "WIN", profitUnits: 1, combinedOddsAmerican: 100 },
  );
  const parentAudit = world.calls.find(
    (c) => c.op === "parlayGradingAudit.create",
  )!;
  assert.equal(
    (parentAudit.args.data as Record<string, unknown>).source,
    "ADMIN_OVERRIDE",
  );

  assert.deepEqual(
    plain(world.resolved.map((r) => [r.playIds, r.parlayIds, r.adminId])),
    [[["S1", "S2", "L1"], ["T"], "admin_1"]],
  );
  assert.match(
    String(world.resolved[0]!.note),
    /^Void applied \(3 plays, 3 cappers\)/,
  );
  assert.deepEqual(world.tags, ["leaderboard"]);
});

test("the browser cannot widen the match, or apply a win to another line", async () => {
  const notEligible = bulkHarness();
  const widened = await notEligible.action.applyBulkCorrectionAction({
    ...voidAll,
    targets: [
      ...voidAll.targets,
      { playId: "someone_elses_play", expectedOutcome: "LOSS" },
    ],
  });
  assert.equal(widened.ok, false);
  assert.match((widened as { error: string }).error, /not the same pick/);
  assert.equal(notEligible.transactions(), 0);

  const wrongLine = bulkHarness();
  const win = await wrongLine.action.applyBulkCorrectionAction({
    ...voidAll,
    outcome: "WIN",
    targets: [
      { playId: "S1", expectedOutcome: "LOSS" },
      { playId: "R1", expectedOutcome: "WIN" },
    ],
  });
  assert.equal(win.ok, false);
  assert.match((win as { error: string }).error, /Only a void/);
  assert.equal(wrongLine.transactions(), 0);

  // A void may cover the opposite side.
  const related = bulkHarness();
  const voided = await related.action.applyBulkCorrectionAction({
    ...voidAll,
    targets: [{ playId: "R1", expectedOutcome: "WIN" }],
  });
  assert.equal(voided.ok, true);
});

test("anything that moved since the preview saves nothing", async () => {
  const preview = bulkHarness();
  const stalePreview = await preview.action.applyBulkCorrectionAction({
    ...voidAll,
    targets: [{ playId: "S1", expectedOutcome: "WIN" }],
  });
  assert.equal(stalePreview.ok, false);
  assert.match((stalePreview as { error: string }).error, /Nothing was saved/);
  assert.equal(preview.transactions(), 0);

  const raced = bulkHarness({ straightWrite: 0 });
  const lostRace = await raced.action.applyBulkCorrectionAction(voidAll);
  assert.equal(lostRace.ok, false);
  assert.match((lostRace as { error: string }).error, /Nothing was saved/);
  assert.equal(raced.resolved.length, 0);
  assert.equal(raced.tags.length, 0);

  const movedTicket = bulkHarness({
    freshTicketLegs: [ticketLegs[0]!, { ...ticketLegs[1]!, outcome: "LOSS" }],
  });
  const ticketRace =
    await movedTicket.action.applyBulkCorrectionAction(voidAll);
  assert.equal(ticketRace.ok, false);
  assert.equal(
    movedTicket.calls.some((c) => c.op === "parlay.update"),
    false,
  );
});

test("nothing to change is a no-op, not a write", async () => {
  const world = bulkHarness();
  const result = await world.action.applyBulkCorrectionAction({
    ...voidAll,
    outcome: "WIN",
    targets: [{ playId: "R1", expectedOutcome: "WIN" }],
  });
  // R1 is related (other side): refused before any write for a WIN.
  assert.equal(result.ok, false);
  const same = bulkHarness();
  const noop = await same.action.applyBulkCorrectionAction({
    ...voidAll,
    outcome: "LOSS",
    targets: [{ playId: "S1", expectedOutcome: "LOSS" }],
  });
  assert.equal(noop.ok, true);
  assert.equal((noop as { changedPlays: number }).changedPlays, 0);
  assert.equal(same.transactions(), 0);
});
