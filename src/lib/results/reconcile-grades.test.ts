import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

import * as grading from "@/lib/grading";
import * as odds from "@/lib/odds";
import * as periods from "@/lib/period-markets";
import * as match from "@/lib/results/match";
import * as gate from "@/lib/results/publication-gate";
import * as settled from "@/lib/results/settled-game";
import * as skip from "@/lib/results/skip-reason";
import type * as Auto from "@/lib/results/auto-grade";
import { loadTestModule } from "@/lib/test-support/load-module";

function importsFor(file: string): Record<string, unknown> {
  return Object.fromEntries(
    [...readFileSync(file, "utf8").matchAll(/from "([^"]+)"/g)].map((m) => [
      m[1]!,
      {},
    ]),
  );
}

const rutgersFixture = {
  sport: "NCAAF",
  market: "Spread",
  oddsAmerican: -110,
  units: 10,
  eventId: "36f0cf10805eed69c78f80697f766cc0",
  eventLabel: "Howard Bison @ Rutgers Scarlet Knights",
  homeTeam: "Rutgers Scarlet Knights",
  awayTeam: "Howard Bison",
  eventStartsAt: new Date("2026-09-25T23:00:00Z"),
  createdAt: new Date("2026-09-25T14:00:00Z"),
  league: null,
  parlayId: null,
};

const autoGraded = { source: "AUTO", reason: "Auto-graded from espn" };

/** Rutgers 58, Howard 7 — ESPN's final. */
const rutgersFinal = {
  sport: "NCAAF",
  home: "Rutgers Scarlet Knights",
  away: "Howard Bison",
  homeScore: 58,
  awayScore: 7,
  completed: true,
  eventId: "espn:401858468",
  startsAt: new Date("2026-09-25T23:00:00Z"),
};

test("the reconcile pass corrects a wrong published grade and nothing else", async () => {
  const graded = [
    {
      // Published LOSS against Army's final; the confirmed answer is WIN.
      ...rutgersFixture,
      id: "wrong",
      selection: "Rutgers Scarlet Knights -41.5",
      side: "Rutgers Scarlet Knights",
      line: -41.5,
      outcome: "LOSS",
      profitUnits: -10,
      audits: [autoGraded],
    },
    {
      // Same wrong result, but an admin has since ruled on it.
      ...rutgersFixture,
      id: "overridden",
      selection: "Rutgers Scarlet Knights -42.5",
      side: "Rutgers Scarlet Knights",
      line: -42.5,
      outcome: "LOSS",
      profitUnits: -10,
      audits: [autoGraded, { source: "ADMIN_OVERRIDE", reason: "ruled" }],
    },
    {
      // Already reversed once by the grader: a human decides the next change.
      ...rutgersFixture,
      id: "flip-flop",
      selection: "Howard Bison +41.5",
      side: "Howard Bison",
      line: 41.5,
      outcome: "WIN",
      profitUnits: 9.09,
      audits: [
        autoGraded,
        { source: "AUTO", reason: "Auto-corrected LOSS -> WIN: ..." },
      ],
    },
    {
      // Correct already: left alone.
      ...rutgersFixture,
      id: "right",
      selection: "Rutgers Scarlet Knights -21.5",
      side: "Rutgers Scarlet Knights",
      line: -21.5,
      outcome: "WIN",
      profitUnits: 9.09,
      audits: [autoGraded],
    },
  ];

  const updates: { id: string; outcome: string }[] = [];
  const audits: { playId: string; newOutcome: string; reason: string }[] = [];
  const file = "src/lib/results/auto-grade.ts";
  const auto = loadTestModule<typeof Auto>(file, {
    ...importsFor(file),
    "server-only": {},
    "@/lib/grading": grading,
    "@/lib/odds": odds,
    "@/lib/period-markets": periods,
    "@/lib/results/match": match,
    "@/lib/results/skip-reason": skip,
    "@/lib/results/publication-gate": gate,
    "@/lib/results/settled-game": settled,
    "@/lib/results/provider": { ODDS_SCORES_ONLY_SPORTS: ["SOCCER"] },
    "@/lib/results/schema-features": { hasClvColumns: async () => false },
    "@/lib/prisma": {
      prisma: {
        play: {
          findMany: async ({ where }: { where: { gradedAt?: unknown } }) =>
            where.gradedAt ? graded : [],
        },
        parlay: { findMany: async () => [] },
        $transaction: async (fn: (tx: unknown) => Promise<unknown>) =>
          fn({
            play: {
              updateMany: async ({
                where,
                data,
              }: {
                where: { id: string };
                data: { outcome: string };
              }) => {
                updates.push({ id: where.id, outcome: data.outcome });
                return { count: 1 };
              },
            },
            gradingAudit: {
              create: async ({
                data,
              }: {
                data: { playId: string; newOutcome: string; reason: string };
              }) => {
                audits.push(data);
              },
            },
          }),
      },
    },
  });

  const result = await auto.autoGradePending({
    name: "fixture",
    fetchSettled: async () => [],
    fetchSettledForSports: async () => [rutgersFinal],
  });

  assert.deepEqual(updates, [{ id: "wrong", outcome: "WIN" }]);
  assert.equal(audits.length, 1);
  assert.equal(audits[0]!.playId, "wrong");
  assert.match(audits[0]!.reason, /^Auto-corrected LOSS -> WIN/);
  assert.match(
    audits[0]!.reason,
    /Howard Bison 7 @ Rutgers Scarlet Knights 58/,
  );
  // The module runs in its own realm, so compare fields, not object identity.
  assert.equal(result.reconciled?.checked, 3, "the override is never checked");
  assert.equal(result.reconciled?.corrected, 1);
  assert.equal(result.reconciled?.needsHuman, 1);
});
