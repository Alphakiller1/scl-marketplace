import assert from "node:assert/strict";
import { test } from "node:test";

import {
  mapSummaryToBoxScore,
  mapSummaryToPlayerBox,
} from "@/lib/results/stats-provider";

// Shape mirrors ESPN's public event-summary response (verified against the live API).
const ESPN_SUMMARY = {
  header: {
    competitions: [
      {
        competitors: [
          {
            homeAway: "home",
            linescores: [
              { value: 0 },
              { value: 1 },
              { value: 0 },
              { value: 2 },
              { value: 0 },
              { value: 3 },
            ],
          },
          {
            homeAway: "away",
            linescores: [
              { value: 1 },
              { value: 0 },
              { value: 0 },
              { value: 0 },
              { value: 1 },
              { value: 0 },
            ],
          },
        ],
      },
    ],
  },
};

test("mapSummaryToBoxScore extracts home/away per-period line-scores", () => {
  const box = mapSummaryToBoxScore(ESPN_SUMMARY);
  assert.ok(box);
  assert.deepEqual(box.homePeriods, [0, 1, 0, 2, 0, 3]);
  assert.deepEqual(box.awayPeriods, [1, 0, 0, 0, 1, 0]);
});

/**
 * The shape the SUMMARY endpoint actually returns — captured from a live MLB
 * response. It carries `displayValue` and NO `value`, which the fixture above
 * (written from the scoreboard endpoint's shape) never exercised: reading only
 * `value` made every inning NaN, so the mapper returned null and not one
 * first-N-innings play could settle.
 */
const ESPN_SUMMARY_LIVE_SHAPE = {
  header: {
    competitions: [
      {
        competitors: [
          {
            homeAway: "home",
            linescores: [
              { displayValue: "0", hits: 0, errors: 0 },
              { displayValue: "0", hits: 1, errors: 0 },
              { displayValue: "2", hits: 2, errors: 0 },
            ],
          },
          {
            homeAway: "away",
            linescores: [
              { displayValue: "1", hits: 3, errors: 0 },
              { displayValue: "0", hits: 0, errors: 0 },
              { displayValue: "4", hits: 4, errors: 0 },
            ],
          },
        ],
      },
    ],
  },
};

test("mapSummaryToBoxScore reads the summary endpoint's displayValue periods", () => {
  const box = mapSummaryToBoxScore(ESPN_SUMMARY_LIVE_SHAPE);
  assert.ok(box);
  assert.deepEqual(box.homePeriods, [0, 0, 2]);
  assert.deepEqual(box.awayPeriods, [1, 0, 4]);
});

test("mapSummaryToBoxScore keeps the innings it can read past an unplayed one", () => {
  // A home team that never batted in the 9th shows "X". Dropping the whole line
  // for that would throw away the first innings a period market settles from.
  const box = mapSummaryToBoxScore({
    header: {
      competitions: [
        {
          competitors: [
            {
              homeAway: "home",
              linescores: [
                { displayValue: "1" },
                { displayValue: "0" },
                { displayValue: "3" },
                { displayValue: "X" },
              ],
            },
            {
              homeAway: "away",
              linescores: [
                { displayValue: "0" },
                { displayValue: "2" },
                { displayValue: "0" },
                { displayValue: "-" },
              ],
            },
          ],
        },
      ],
    },
  });
  assert.ok(box);
  assert.deepEqual(box.homePeriods, [1, 0, 3]);
  assert.deepEqual(box.awayPeriods, [0, 2, 0]);
});

test("mapSummaryToBoxScore returns null on missing/partial data (→ defer)", () => {
  assert.equal(mapSummaryToBoxScore({}), null);
  assert.equal(mapSummaryToBoxScore(null), null);
  assert.equal(
    mapSummaryToBoxScore({
      header: {
        competitions: [{ competitors: [{ homeAway: "home", linescores: [] }] }],
      },
    }),
    null,
  );
});

test("mapSummaryToPlayerBox keeps football yardage groups distinct", () => {
  const box = mapSummaryToPlayerBox({
    boxscore: {
      players: [
        {
          team: { abbreviation: "BUF" },
          statistics: [
            {
              type: "passing",
              labels: ["YDS"],
              athletes: [
                {
                  athlete: { displayName: "Josh Allen" },
                  stats: ["287"],
                },
              ],
            },
            {
              type: "rushing",
              labels: ["YDS"],
              athletes: [
                {
                  athlete: { displayName: "Josh Allen" },
                  stats: ["42"],
                },
              ],
            },
            {
              type: "receiving",
              labels: ["REC", "YDS"],
              athletes: [
                {
                  athlete: { displayName: "Khalil Shakir" },
                  stats: ["7", "96"],
                },
              ],
            },
          ],
        },
      ],
    },
  });
  assert.ok(box);
  assert.deepEqual(
    box.players.find((player) => player.name === "Josh Allen")?.stats,
    { passingYards: 287, rushingYards: 42 },
  );
  assert.deepEqual(
    box.players.find((player) => player.name === "Khalil Shakir")?.stats,
    { receptions: 7, receivingYards: 96 },
  );
});
