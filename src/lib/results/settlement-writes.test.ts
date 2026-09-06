import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import { loadTestModule } from "@/lib/test-support/load-module";
import * as grading from "@/lib/grading";
import * as odds from "@/lib/odds";
import * as correction from "@/lib/grading-correction";
import * as schema from "@/lib/schemas/grading.schema";
import * as parlaySchema from "@/lib/schemas/parlay.schema";
import * as match from "@/lib/results/match";
import * as skip from "@/lib/results/skip-reason";
import type * as Auto from "@/lib/results/auto-grade";
import type * as Manual from "@/lib/actions/grading.action";
import type * as Parlay from "@/lib/actions/parlay.action";

// Unused imports remain empty and fail if touched. All grading math below is real.
function importsFor(file: string): Record<string, unknown> {
  return Object.fromEntries(
    [...readFileSync(file, "utf8").matchAll(/from "([^"]+)"/g)].map((m) => [
      m[1]!,
      {},
    ]),
  );
}

const single = {
  id: "single",
  sport: "TENNIS",
  market: "Moneyline",
  selection: "Iga Swiatek",
  oddsAmerican: -200,
  units: 2,
  eventId: "final",
  eventStartsAt: new Date("2026-08-23T18:00Z"),
  outcome: "PENDING",
  profitUnits: null,
  parlayId: null,
  capper: { user: { username: "capper" } },
  closingOddsAmerican: null,
};

test("auto-grading cannot overwrite a manual result saved after the pending snapshot", async () => {
  for (const parlayId of [null, "ticket"]) {
    let locked = false;
    let audited = false;
    const file = "src/lib/results/auto-grade.ts";
    const auto = loadTestModule<typeof Auto>(file, {
      ...importsFor(file),
      "server-only": {},
      "@/lib/grading": grading,
      "@/lib/odds": odds,
      "@/lib/results/match": match,
      "@/lib/results/skip-reason": skip,
      "@/lib/period-markets": { parsePeriodMarket: () => null },
      "@/lib/results/schema-features": { hasClvColumns: async () => false },
      "@/lib/results/settlement-lock": {
        lockParlaySettlement: async (_tx: unknown, id: string) => {
          assert.equal(id, "ticket");
          locked = true;
        },
      },
      "@/lib/prisma": {
        prisma: {
          play: {
            findMany: async ({
              select,
              where,
            }: {
              select: { sport?: boolean; id?: boolean };
              where: { parlayId?: unknown };
            }) =>
              !select.id ||
              (parlayId === null
                ? where.parlayId === null
                : where.parlayId !== null)
                ? [{ ...single, parlayId }]
                : [],
          },
          parlay: { findMany: async () => [] },
          $transaction: async (fn: (tx: unknown) => Promise<unknown>) =>
            fn({
              play: {
                updateMany: async ({
                  where,
                }: {
                  where: { outcome: string };
                }) => {
                  assert.equal(where.outcome, "PENDING");
                  if (parlayId) assert.ok(locked);
                  // DB row is already manually VOID; the conditional update loses.
                  return { count: 0 };
                },
              },
              gradingAudit: {
                create: async () => {
                  audited = true;
                },
              },
            }),
        },
      },
    });
    const result = await auto.autoGradePending({
      name: "fixture",
      fetchSettled: async () => [],
      fetchSettledForSports: async (_sports, scope) => {
        assert.ok(scope?.tennisEventDates?.includes("20260823"));
        return [
          {
            sport: "TENNIS",
            eventId: "final",
            home: "Iga Swiatek",
            away: "Elena Rybakina",
            homeScore: 2,
            awayScore: 0,
            completed: true,
          },
        ];
      },
    });
    assert.equal(result.graded, 0);
    assert.equal(audited, false);
  }
});

test("manual straight saves derive profit, audit the admin, and reject concurrent changes", async () => {
  for (const winsWrite of [true, false]) {
    const audits: {
      data: { source: string; gradedById: string; newProfitUnits: number };
    }[] = [];
    const file = "src/lib/actions/grading.action.ts";
    const action = loadTestModule<typeof Manual>(file, {
      ...importsFor(file),
      "next/cache": { revalidatePath: () => {} },
      "@/lib/grading-correction": correction,
      "@/lib/odds": odds,
      "@/lib/schemas/grading.schema": schema,
      "@/lib/results/schema-features": { hasClvColumns: async () => false },
      "@/lib/session": { requireAdmin: async () => ({ id: "owner-admin" }) },
      "@/lib/prisma": {
        prisma: {
          play: { findUnique: async () => single },
          $transaction: async (fn: (tx: unknown) => Promise<unknown>) =>
            fn({
              play: {
                findUnique: async () => single,
                updateMany: async ({
                  where,
                  data,
                }: {
                  where: { outcome: string; profitUnits: null };
                  data: { profitUnits: number };
                }) => {
                  assert.equal(where.outcome, "PENDING");
                  assert.equal(where.profitUnits, null);
                  assert.equal(data.profitUnits, 1);
                  return { count: winsWrite ? 1 : 0 };
                },
              },
              gradingAudit: {
                create: async (audit: (typeof audits)[number]) => {
                  audits.push(audit);
                },
              },
            }),
        },
      },
    });
    const result = await action.gradePlayAction({
      playId: "single",
      outcome: "WIN",
      reason: "Verified final score",
      expectedOutcome: "PENDING",
      expectedProfitUnits: null,
      confirmedPublicImpact: true,
    });
    assert.equal(result.ok, winsWrite);
    assert.equal(audits.length, winsWrite ? 1 : 0);
    if (winsWrite) {
      assert.equal(audits[0]!.data.source, "MANUAL");
      assert.equal(audits[0]!.data.gradedById, "owner-admin");
      assert.equal(audits[0]!.data.newProfitUnits, 1);
    }
  }
});

test("manual stale parlay settlement locks the ticket and recomputes parent profit and odds", async () => {
  const file = "src/lib/actions/parlay.action.ts";
  const ticket = {
    id: "ticket",
    units: 2,
    outcome: "PENDING",
    profitUnits: null,
    capper: single.capper,
    legs: [
      { id: "leg", oddsAmerican: -200, outcome: "PENDING" },
      { id: "won", oddsAmerican: 100, outcome: "WIN" },
    ],
  };
  let locked = false;
  let parentAudit = 0;
  let legAudit = 0;
  const action = loadTestModule<typeof Parlay>(file, {
    ...importsFor(file),
    "next/cache": { revalidatePath: () => {} },
    "@/lib/grading": grading,
    "@/lib/grading-correction": correction,
    "@/lib/schemas/parlay.schema": parlaySchema,
    "@/lib/session": { requireAdmin: async () => ({ id: "owner-admin" }) },
    "@/lib/results/settlement-lock": {
      lockParlaySettlement: async () => {
        locked = true;
      },
    },
    "@/lib/prisma": {
      prisma: {
        parlay: { findUnique: async () => ticket },
        $transaction: async (fn: (tx: unknown) => Promise<unknown>) =>
          fn({
            parlay: {
              findUnique: async () => {
                assert.ok(locked);
                return ticket;
              },
              update: async ({
                data,
              }: {
                data: {
                  outcome: string;
                  profitUnits: number;
                  combinedOddsAmerican: number;
                };
              }) => {
                assert.equal(data.outcome, "WIN");
                assert.equal(data.profitUnits, 4);
                assert.equal(data.combinedOddsAmerican, 200);
              },
            },
            play: {
              update: async ({
                data,
              }: {
                data: { outcome: string; profitUnits?: unknown };
              }) => {
                assert.equal(data.outcome, "WIN");
                assert.equal(data.profitUnits, undefined);
              },
            },
            gradingAudit: {
              create: async () => {
                legAudit++;
              },
            },
            parlayGradingAudit: {
              create: async () => {
                parentAudit++;
              },
            },
          }),
      },
    },
  });
  const result = await action.gradeParlayAction({
    parlayId: "ticket",
    legs: [{ playId: "leg", outcome: "WIN", expectedOutcome: "PENDING" }],
    reason: "Verified final score",
    expectedOutcome: "PENDING",
    expectedProfitUnits: null,
    confirmedPublicImpact: true,
  });
  assert.equal(result.ok, true);
  assert.equal(legAudit, 1);
  assert.equal(parentAudit, 1);
});
