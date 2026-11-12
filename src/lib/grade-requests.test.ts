import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

import {
  adminGradeRequestPath,
  renderGradeRequestEmail,
  type GradeRequestEmailInput,
} from "@/lib/grade-request-email";
import {
  availableGradeRequestTypes,
  GRADE_REQUEST_SUBJECT,
  gradeRequestTypeFromSlug,
  myPicksRequestHref,
  parlayPickDetails,
  pickSummaryLine,
  straightPickDetails,
} from "@/lib/grade-requests";
import {
  bulkCorrectionSchema,
  reviewGradeRequestSchema,
  submitGradeRequestSchema,
} from "@/lib/schemas/grade-request.schema";

const straight = straightPickDetails({
  id: "play_1",
  sport: "NBA",
  league: "NBA",
  market: "Rebounds",
  selection: "Jabari Smith Jr Over 4.5",
  oddsAmerican: -115,
  units: 1.5,
  book: "draftkings",
  outcome: "LOSS",
  profitUnits: -1.5,
  eventLabel: "Houston Rockets @ Atlanta Hawks",
  homeTeam: "Atlanta Hawks",
  awayTeam: "Houston Rockets",
  eventStartsAt: new Date("2026-11-12T00:30:00Z"),
  createdAt: new Date("2026-11-11T18:02:00Z"),
});

const parlay = parlayPickDetails({
  id: "parlay_1",
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
      eventLabel: "Detroit Lions @ Chicago Bears",
      homeTeam: "Chicago Bears",
      awayTeam: "Detroit Lions",
      eventStartsAt: new Date("2026-11-08T18:00:00Z"),
    },
    {
      id: "leg_b",
      sport: "NFL",
      market: "Receiving Yds",
      selection: "George Pickens Over 59.5",
      oddsAmerican: -110,
      outcome: "LOSS",
      eventLabel: null,
      homeTeam: "Dallas Cowboys",
      awayTeam: "Philadelphia Eagles",
      eventStartsAt: new Date("2026-11-09T01:20:00Z"),
    },
  ],
});

test("request buttons appear only on graded picks; a void pick offers regrade only", () => {
  assert.deepEqual(availableGradeRequestTypes("PENDING"), []);
  for (const outcome of ["WIN", "LOSS", "PUSH"] as const) {
    assert.deepEqual(availableGradeRequestTypes(outcome), [
      "REGRADE",
      "INJURY_PROTECTION",
    ]);
  }
  assert.deepEqual(availableGradeRequestTypes("VOID"), ["REGRADE"]);
});

test("subjects are exactly the owners' wording, and slugs round-trip", () => {
  assert.equal(GRADE_REQUEST_SUBJECT.REGRADE, "Regrade Request");
  assert.equal(
    GRADE_REQUEST_SUBJECT.INJURY_PROTECTION,
    "Injury Protection Request",
  );
  for (const type of ["REGRADE", "INJURY_PROTECTION"] as const) {
    const href = myPicksRequestHref({ type, kind: "straight", id: "a b" });
    const slug = new URL(href, "https://x.test").searchParams.get("type");
    assert.equal(gradeRequestTypeFromSlug(slug), type);
    assert.ok(href.startsWith("/dashboard/picks/straight/a%20b/request?type="));
  }
  assert.equal(gradeRequestTypeFromSlug("regrade-please"), null);
  assert.equal(gradeRequestTypeFromSlug(undefined), null);
});

test("a prop names its stat once; a game line keeps its market", () => {
  // #744: "Over 21.5" alone never says 21.5 of what.
  assert.equal(straight.title, "Jabari Smith Jr Over 4.5 Rebounds");
  const total = straightPickDetails({
    id: "play_2",
    sport: "NBA",
    league: "NBA",
    market: "Total",
    selection: "Over 221.5",
    oddsAmerican: -110,
    units: 1,
    book: "fanduel",
    outcome: "LOSS",
    profitUnits: -1,
    eventLabel: "Houston Rockets @ Atlanta Hawks",
    homeTeam: null,
    awayTeam: null,
    eventStartsAt: null,
    createdAt: new Date("2026-11-11T18:00:00Z"),
  });
  assert.equal(total.title, "Over 221.5");
  assert.equal(
    pickSummaryLine(total),
    "Over 221.5 · Total · Houston Rockets @ Atlanta Hawks · -110 · 1U",
  );
  assert.equal(total.book, "FanDuel");
});

test("a parlay is dated by its last game and summarised with the leg in question", () => {
  assert.equal(parlay.eventStartsAt?.toISOString(), "2026-11-09T01:20:00.000Z");
  assert.equal(
    pickSummaryLine(parlay, "leg_b"),
    "2-Leg Parlay +264 · 1U — Leg 2: George Pickens Over 59.5 Receiving Yards (Philadelphia Eagles @ Dallas Cowboys) -110",
  );
  assert.equal(pickSummaryLine(parlay, null), "2-Leg Parlay +264 · 1U");
  assert.equal(
    pickSummaryLine(straight),
    "Jabari Smith Jr Over 4.5 Rebounds · Houston Rockets @ Atlanta Hawks · -115 · 1.50U",
  );
});

function emailInput(
  overrides: Partial<GradeRequestEmailInput> = {},
): GradeRequestEmailInput {
  return {
    requestId: "req_9",
    type: "REGRADE",
    capper: {
      handle: "petespicks",
      displayName: "Pete",
      email: "pete@example.com",
      userId: "u1",
    },
    details: straight,
    legId: null,
    commentary: "Box score shows 5 rebounds — he went over.",
    submittedAt: new Date("2026-11-12T04:00:00Z"),
    ...overrides,
  };
}

test("the email carries every pre-populated field and both admin links", () => {
  const mail = renderGradeRequestEmail(emailInput(), "https://scl.example");
  assert.equal(
    mail.subject,
    "Regrade Request — @petespicks — Jabari Smith Jr Over 4.5 Rebounds (Wed, Nov 11, 2026)",
  );
  assert.equal(
    mail.correctionUrl,
    "https://scl.example/admin/plays/straight/play_1?request=req_9#capper-requests",
  );
  assert.equal(mail.queueUrl, "https://scl.example/admin/grading/requests");
  for (const expected of [
    "Regrade Request",
    "@petespicks",
    "pete@example.com",
    "Jabari Smith Jr Over 4.5",
    "Rebounds",
    "Houston Rockets @ Atlanta Hawks",
    "-115",
    "1.50U",
    "DraftKings",
    "Wed, Nov 11, 2026",
    "Loss · -1.50U",
    "play_1",
    "req_9",
    "Box score shows 5 rebounds",
    mail.correctionUrl,
    mail.queueUrl,
  ]) {
    assert.ok(mail.html.includes(expected), `html missing ${expected}`);
    assert.ok(mail.text.includes(expected), `text missing ${expected}`);
  }
});

test("capper commentary is escaped, never rendered as markup", () => {
  const mail = renderGradeRequestEmail(
    emailInput({
      type: "INJURY_PROTECTION",
      commentary: '<a href="https://evil.test">click</a> & <script>x</script>',
    }),
    "https://scl.example",
  );
  assert.ok(mail.subject.startsWith("Injury Protection Request — @petespicks"));
  assert.ok(!mail.html.includes("<script>"));
  assert.ok(!mail.html.includes('<a href="https://evil.test">'));
  assert.ok(mail.html.includes("&lt;script&gt;"));
});

test("a parlay email names the leg in question and links to the ticket", () => {
  const mail = renderGradeRequestEmail(
    emailInput({ details: parlay, legId: "leg_b" }),
    "https://scl.example",
  );
  assert.ok(
    mail.subject.includes(
      "2-Leg Parlay — George Pickens Over 59.5 Receiving Yards",
    ),
  );
  assert.ok(mail.html.includes("Leg 2: George Pickens Over 59.5"));
  assert.ok(mail.text.includes("<-- in question"));
  assert.equal(
    adminGradeRequestPath({
      requestId: "r",
      kind: "parlay",
      pickId: "parlay_1",
    }),
    "/admin/plays/parlay/parlay_1?request=r#capper-requests",
  );
  const whole = renderGradeRequestEmail(
    emailInput({ details: parlay, legId: null }),
    "https://scl.example",
  );
  assert.ok(whole.html.includes("Whole ticket"));
});

test("the request form requires real commentary and accepts only known types", () => {
  const base = {
    type: "REGRADE",
    kind: "straight",
    pickId: "play_1",
    commentary: "Box score shows 5 rebounds — he went over.",
  };
  assert.ok(submitGradeRequestSchema.safeParse(base).success);
  assert.ok(
    !submitGradeRequestSchema.safeParse({ ...base, commentary: "   wrong   " })
      .success,
  );
  assert.ok(
    !submitGradeRequestSchema.safeParse({ ...base, type: "REFUND" }).success,
  );
  assert.ok(
    !submitGradeRequestSchema.safeParse({ ...base, kind: "leg" }).success,
  );
  const blankLeg = submitGradeRequestSchema.parse({ ...base, legId: "" });
  assert.equal(blankLeg.legId, undefined);
});

test("declining a request needs a note; resolving does not", () => {
  assert.ok(
    !reviewGradeRequestSchema.safeParse({
      requestId: "r",
      decision: "DECLINED",
    }).success,
  );
  assert.ok(
    reviewGradeRequestSchema.safeParse({
      requestId: "r",
      decision: "DECLINED",
      note: "Official box score confirms 4 rebounds.",
    }).success,
  );
  assert.ok(
    reviewGradeRequestSchema.safeParse({ requestId: "r", decision: "RESOLVED" })
      .success,
  );
});

test("a bulk correction needs a reason, the confirmation, and unique targets", () => {
  const base = {
    sourcePlayId: "play_1",
    outcome: "VOID",
    reason: "Injury protection: left in 1Q",
    confirmedPublicImpact: true,
    targets: [{ playId: "play_1", expectedOutcome: "LOSS" }],
  };
  assert.ok(bulkCorrectionSchema.safeParse(base).success);
  assert.ok(
    !bulkCorrectionSchema.safeParse({ ...base, confirmedPublicImpact: false })
      .success,
  );
  assert.ok(!bulkCorrectionSchema.safeParse({ ...base, reason: "ok" }).success);
  assert.ok(
    !bulkCorrectionSchema.safeParse({ ...base, outcome: "PENDING" }).success,
  );
  assert.ok(!bulkCorrectionSchema.safeParse({ ...base, targets: [] }).success);
  assert.ok(
    !bulkCorrectionSchema.safeParse({
      ...base,
      targets: [base.targets[0], base.targets[0]],
    }).success,
  );
});

test("the grade-request server module exposes only the three intended actions", () => {
  // Every exported async function in a "use server" file is a public endpoint.
  const source = readFileSync(
    "src/lib/actions/grade-request.action.ts",
    "utf8",
  );
  const exported = [...source.matchAll(/export async function (\w+)/g)].map(
    (match) => match[1],
  );
  assert.deepEqual(exported.sort(), [
    "reopenGradeRequestAction",
    "reviewGradeRequestAction",
    "submitGradeRequestAction",
  ]);
  const bulk = readFileSync(
    "src/lib/actions/bulk-correction.action.ts",
    "utf8",
  );
  assert.deepEqual(
    [...bulk.matchAll(/export async function (\w+)/g)].map((m) => m[1]),
    ["applyBulkCorrectionAction"],
  );
});

test("request buttons render only on the capper's own dashboard lists", () => {
  const item = readFileSync("src/components/scl/play-list-item.tsx", "utf8");
  const guarded = [
    ...item.matchAll(/\{dashboard \? \(\s*<GradeRequestButtons/g),
  ];
  assert.equal(
    guarded.length,
    2,
    "both list items gate the buttons on dashboard",
  );
  for (const page of [
    "src/app/(capper)/dashboard/picks/page.tsx",
    "src/app/(capper)/dashboard/page.tsx",
  ]) {
    const source = readFileSync(page, "utf8");
    assert.match(
      source,
      /<ParlayListItem[\s\S]*?dashboard[\s\S]*?openRequests=/,
    );
    assert.match(source, /<PlayListItem[\s\S]*?dashboard[\s\S]*?openRequests=/);
  }
});
