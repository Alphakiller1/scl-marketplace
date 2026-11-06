import assert from "node:assert/strict";
import test from "node:test";
import { loadTestModule } from "@/lib/test-support/load-module";
import * as daily from "@/lib/results/daily-deadline";
import type * as Health from "@/lib/grading-health";
import {
  dailyDeadlineState,
  isOvernightGradingRecovery,
  slateDeadlines,
} from "@/lib/results/daily-deadline";
import {
  findGame,
  resolveOutcome,
  type GradablePlay,
} from "@/lib/results/match";
import {
  mergeSettledGames,
  type SettledGame,
} from "@/lib/results/settled-game";

test("5/7 a.m. deadlines follow Eastern daylight saving, not the server clock", () => {
  for (const [slate, target, deadline] of [
    ["2026-07-01", "2026-07-02T09:00:00.000Z", "2026-07-02T11:00:00.000Z"],
    ["2026-11-05", "2026-11-06T10:00:00.000Z", "2026-11-06T12:00:00.000Z"],
    ["2026-03-07", "2026-03-08T09:00:00.000Z", "2026-03-08T11:00:00.000Z"],
    ["2026-10-31", "2026-11-01T10:00:00.000Z", "2026-11-01T12:00:00.000Z"],
    ["2026-12-31", "2027-01-01T10:00:00.000Z", "2027-01-01T12:00:00.000Z"],
  ]) {
    const value = slateDeadlines(slate);
    assert.equal(value.targetAt.toISOString(), target);
    assert.equal(value.deadlineAt.toISOString(), deadline);
  }
});

test("previous slate includes late west-coast games, manual tennis, missing metadata and parlay legs", () => {
  const row = {
    eventStartsAt: new Date("2026-11-06T03:30:00Z"),
    createdAt: new Date("2026-11-05T21:00Z"),
    parlayId: null,
  };
  const plays = [
    row,
    { ...row, parlayId: "ticket" },
    { ...row, eventStartsAt: null },
    { ...row, eventStartsAt: new Date("2026-11-06T05:00Z") }, // midnight ET: today's slate
    { ...row, eventStartsAt: new Date("2026-11-07T00:00Z") },
  ];
  assert.equal(
    dailyDeadlineState(plays, new Date("2026-11-06T09:59:59Z")).summary.status,
    "DUE",
  );
  const target = dailyDeadlineState(
    plays,
    new Date("2026-11-06T10:00Z"),
  ).summary;
  assert.equal(target.status, "RECOVERY");
  assert.equal(target.pending, 3);
  assert.equal(target.pastTarget, 3);
  assert.equal(target.pastDeadline, 0);
  assert.equal(target.straightPlays, 2);
  assert.equal(target.parlayLegs, 1);
  assert.equal(target.missingSchedule, 1);
  const hard = dailyDeadlineState(plays, new Date("2026-11-06T12:00Z")).summary;
  assert.equal(hard.status, "BREACHED");
  assert.equal(hard.pastDeadline, 3);
  assert.equal(
    dailyDeadlineState([row], new Date("2026-11-07T05:01Z")).summary.status,
    "BREACHED",
    "older misses must not reset at midnight",
  );
  assert.equal(
    dailyDeadlineState([], new Date("2026-11-06T12:00Z")).summary.status,
    "CLEAR",
  );
});

test("full scores recovery starts at 3 a.m. and ends at 7 a.m. Eastern in summer and winter", () => {
  for (const [stamp, expected] of [
    ["2026-07-02T06:59Z", false],
    ["2026-07-02T07:00Z", true],
    ["2026-07-02T10:55Z", true],
    ["2026-07-02T11:00Z", false],
    ["2026-11-06T07:59Z", false],
    ["2026-11-06T08:00Z", true],
    ["2026-11-06T11:55Z", true],
    ["2026-11-06T12:00Z", false],
  ] as const)
    assert.equal(isOvernightGradingRecovery(new Date(stamp)), expected, stamp);
});

test("UMass and Southern Mississippi finals settle both sides, totals and merged feed copies", () => {
  for (const [home, away, oddsHome, oddsAway, homeScore, awayScore] of [
    [
      "Massachusetts Minutemen",
      "Ball State Cardinals",
      "UMass Minutemen",
      "Ball State Cardinals",
      31,
      30,
    ],
    [
      "Southern Miss Golden Eagles",
      "James Madison Dukes",
      "Southern Mississippi Golden Eagles",
      "James Madison Dukes",
      23,
      54,
    ],
  ] as const) {
    const final: SettledGame = {
      sport: "NCAAF",
      home,
      away,
      homeScore,
      awayScore,
      completed: true,
      eventId: "espn:final",
      startsAt: new Date("2026-11-06T01:00Z"),
    };
    const play: GradablePlay = {
      id: "stuck",
      sport: "NCAAF",
      market: "Spread",
      selection: `${oddsAway} -2.5`,
      oddsAmerican: -110,
      units: 1,
      eventId: "odds:final",
      eventLabel: `${oddsAway} @ ${oddsHome}`,
      eventStartsAt: final.startsAt,
    };
    assert.equal(findGame(play, [final]), final);
    assert.equal(
      resolveOutcome(play, [final]),
      awayScore - homeScore > 2.5 ? "WIN" : "LOSS",
    );
    assert.equal(
      resolveOutcome({ ...play, selection: `${oddsHome} +2.5` }, [final]),
      homeScore + 2.5 > awayScore ? "WIN" : "LOSS",
    );
    assert.equal(
      resolveOutcome({ ...play, selection: "Under 60", market: "Total" }, [
        final,
      ]),
      homeScore + awayScore < 60 ? "WIN" : "LOSS",
    );
    assert.equal(
      findGame(play, [{ ...final, home: "Unrelated Golden Eagles" }]),
      null,
    );
    assert.equal(
      mergeSettledGames(
        [{ ...final, home: oddsHome, away: oddsAway, eventId: "odds:final" }],
        [final],
      ).length,
      1,
    );
  }
});

test("real health stays red for an uncapped manual-only backlog after the deadline", async () => {
  const rows = Array.from({ length: 1_205 }, (_, i) => ({
    sport: "TENNIS",
    market: "Total",
    eventStartsAt: i === 1_204 ? null : new Date("2026-11-05T18:00Z"),
    createdAt: new Date("2026-11-05T17:00Z"),
    parlayId: i === 1_203 ? "ticket" : null,
  }));
  const health = loadTestModule<typeof Health>("src/lib/grading-health.ts", {
    "server-only": {},
    "@/lib/constants": { UNIT_MIN: 0.1 },
    "@/lib/database-retry": {
      withTransientDatabaseRetry: async (read: () => Promise<unknown>) =>
        read(),
    },
    "@/lib/public-eligibility-prisma": {
      prismaExcludeTestHandlesLive: async () => ({}),
    },
    "@/lib/results/lookback": {
      RESULTS_LOOKBACK_DAYS: 3,
      RESULTS_CLIFF_WARNING_DAYS: 2,
    },
    "@/lib/results/grading-window": {
      expectedFinalAt: () => new Date("2026-11-06T01:00Z"),
    },
    "@/lib/results/match": { isAutoGradeBlocked: () => true },
    "@/lib/results/daily-deadline": daily,
    "@/lib/prisma": {
      prisma: {
        play: {
          count: async () => 0,
          findMany: async (query: {
            take?: number;
            where: { parlayId?: unknown };
          }) => {
            assert.equal(
              query.take,
              undefined,
              "health must count rows beyond 1000",
            );
            return query.where.parlayId
              ? rows.filter((play) => play.parlayId)
              : rows;
          },
        },
      },
    },
  });
  const report = await health.getGradingHealthReport(
    new Date("2026-11-06T12:00Z"),
  );
  assert.equal(
    report.pendingPastExpectedFinal,
    0,
    "manual-only expected-final exclusion remains separate",
  );
  assert.equal(
    report.status,
    "UNHEALTHY",
    "manual markets cannot hide a missed daily deadline",
  );
  assert.equal(report.dailyDeadline.status, "BREACHED");
  assert.equal(report.dailyDeadline.pastDeadline, 1_205);
  assert.equal(report.dailyDeadline.missingSchedule, 1);
  assert.equal(report.dailyDeadline.parlayLegs, 1);
});
