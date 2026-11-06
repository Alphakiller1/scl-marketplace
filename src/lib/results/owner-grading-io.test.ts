import assert from "node:assert/strict";
import { test } from "node:test";
import { loadTestModule } from "@/lib/test-support/load-module";
import * as scoreboard from "@/lib/results/espn-scoreboard-map";
import * as settled from "@/lib/results/settled-game";
import * as queueBuilder from "@/lib/results/grading-work-queue";
import * as dailyDeadline from "@/lib/results/daily-deadline";
import type * as EspnProvider from "@/lib/results/espn-scores";
import type * as StuckPlays from "@/lib/results/stuck-plays";

test("the real ESPN provider fetches unranked NCAAB finals and yesterday's late NBA slate", async () => {
  const urls: URL[] = [];
  const provider = loadTestModule<typeof EspnProvider>(
    "src/lib/results/espn-scores.ts",
    {
      "server-only": {},
      "@/lib/results/espn-scoreboard-map": scoreboard,
      "@/lib/results/espn-soccer-leagues": { espnSoccerLeagueSlug: () => null },
      "@/lib/results/espn-tennis-map": { mapEspnTennisScoreboard: () => [] },
      "@/lib/results/settled-game": settled,
    },
    {
      fetch: async (url: string) => {
        const parsed = new URL(url);
        urls.push(parsed);
        const college = parsed.pathname.includes("mens-college");
        const fullSlate =
          parsed.searchParams.get("groups") === "50" &&
          parsed.searchParams.get("limit") === "300";
        const yesterday = parsed.searchParams.get("dates") === "20261102";
        return {
          ok: true,
          json: async () => ({
            events:
              yesterday && (!college || fullSlate)
                ? [
                    {
                      id: college ? "unranked" : "late-nba",
                      date: "2026-11-03T03:30:00Z",
                      status: {
                        type: { completed: true, name: "STATUS_FINAL" },
                      },
                      competitions: [
                        {
                          competitors: [
                            {
                              homeAway: "home",
                              score: "80",
                              team: {
                                displayName: college
                                  ? "Drake Bulldogs"
                                  : "Golden State Warriors",
                              },
                            },
                            {
                              homeAway: "away",
                              score: "60",
                              team: {
                                displayName: college
                                  ? "Yale Bulldogs"
                                  : "Phoenix Suns",
                              },
                            },
                          ],
                        },
                      ],
                    },
                  ]
                : [],
          }),
        };
      },
    },
  ).espnHistoricalResultsProvider(2, new Date("2026-11-03T07:00:00Z"));
  const results = await provider.fetchSettledForSports(["NCAAB", "NBA"]);
  assert.equal(results.length, 2);
  assert.ok(results.some((g) => g.eventId === "espn:unranked"));
  assert.ok(results.some((g) => g.eventId === "espn:late-nba"));
  assert.equal(urls.length, 4);
});

test("the real admin work queue fetches and exposes plays beyond 50 and 1000", async () => {
  const rows = Array.from({ length: 1_205 }, (_, i) => ({
    id: String(i),
    capper: { user: { username: i === 1_204 ? "last-capper" : "capper" } },
    sport: "NCAAB",
    market: "Spread",
    selection: "Drake Bulldogs -7",
    oddsAmerican: -110,
    units: 1,
    eventId: "event",
    eventStartsAt: new Date("2026-11-02T23:00:00Z"),
    createdAt: new Date("2026-11-02T20:00:00Z"),
    parlayId: null,
  }));
  const queries = loadTestModule<typeof StuckPlays>(
    "src/lib/results/stuck-plays.ts",
    {
      "server-only": {},
      "@/lib/results/grading-work-queue": queueBuilder,
      "@/lib/results/daily-deadline": dailyDeadline,
      "@/lib/constants": { UNIT_MIN: 0.1 },
      "@/lib/prisma": {
        prisma: {
          play: {
            findMany: async (query: {
              take?: number;
              where: { parlayId?: unknown };
            }) => {
              assert.equal(
                query.take,
                undefined,
                "an SQL cap would hide eligible rows before filtering",
              );
              return query.where.parlayId != null &&
                typeof query.where.parlayId === "object"
                ? []
                : rows;
            },
          },
        },
      },
      "@/lib/results/skip-reason": { isAgedOut: () => true },
      "@/lib/results/grading-window": {
        expectedFinalAt: () => new Date("2026-11-03T04:00:00Z"),
      },
      "@/lib/results/match": { isAutoGradeBlocked: () => false },
      "@/lib/results/manual-grading": {
        manualGradingReason: () => "",
        needsManualGrading: () => false,
      },
      "@/lib/public-eligibility-prisma": {
        prismaExcludeTestHandlesLive: async () => ({}),
      },
    },
  );
  const queue = await queries.listGradingWorkQueue(
    new Date("2026-11-04T15:00:00Z"),
  );
  assert.equal(queue.length, 1_205);
  assert.equal(queue.at(-1)?.handle, "last-capper");
  assert.equal(
    (await queries.listGradingWorkQueue(new Date("2026-11-04T15:00:00Z"), 5))
      .length,
    5,
  );
});
