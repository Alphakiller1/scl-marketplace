import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import path from "node:path";
import test from "node:test";

import {
  dueRefreshSlots,
  REFRESH_MAX_GAP_MINUTES,
  STRATEGIC_ODDS_COMPETITIONS,
} from "@/lib/strategic-odds-policy";

/**
 * The refresh cron and the `before-first` leads are one design, split across a
 * YAML file and a TypeScript module. Nothing else connects them, and drift is
 * silent in the worst way: a competition whose window falls between two runs is
 * never due, so it is never refreshed, and no run reports an error — the board
 * just quietly stops updating for that league.
 */

const WORKFLOW = path.join(process.cwd(), ".github/workflows/odds-refresh.yml");

/** Scheduled run times from the workflow, as minutes past midnight UTC. */
function scheduledRunMinutes(): number[] {
  const yaml = readFileSync(WORKFLOW, "utf8");
  const crons = [...yaml.matchAll(/- cron:\s*"([^"]+)"/g)].map((m) => m[1]!);
  assert.ok(crons.length > 0, "no cron entries found in odds-refresh.yml");

  const minutes: number[] = [];
  for (const cron of crons) {
    const [minute, hour] = cron.trim().split(/\s+/);
    // A step or wildcard hour means a dense schedule; this test exists for the
    // sparse one, and a dense schedule cannot violate the invariant anyway.
    assert.match(
      hour ?? "",
      /^\d+$/,
      `expected a fixed hour, got "${cron}" — update this test if the cadence changed shape`,
    );
    assert.match(minute ?? "", /^\d+$/, `expected a fixed minute in "${cron}"`);
    minutes.push(Number(hour) * 60 + Number(minute));
  }
  return minutes.sort((a, b) => a - b);
}

test("every scheduled run is a fixed time and there are only a handful", () => {
  const runs = scheduledRunMinutes();
  // The endpoint warms expanded MLB boards at 44 credits per event, so cadence is
  // the largest lever on the monthly bill. Ninety-six runs a day is what
  // exhausted three provider keys in three days.
  assert.ok(
    runs.length <= 8,
    `expected a sparse schedule, found ${runs.length} runs a day`,
  );
  assert.equal(new Set(runs).size, runs.length, "duplicate cron times");
});

/**
 * The hours a fixture can realistically start, in minutes past midnight UTC.
 *
 * 14:00 UTC through 04:00 the next day. Under EDT that is 10:00 ET to midnight;
 * under EST, 09:00 ET to 23:00 — so the span covers both halves of the year
 * without the test needing to know which is in force. The earliest starts we
 * carry are tennis around 11:00 ET and the latest are west-coast MLB near 22:10
 * ET, both comfortably inside it.
 *
 * Outside this window the schedule is deliberately allowed a long gap: nothing
 * starts overnight, so nothing needs a refresh ahead of it.
 */
const FIRST_START_UTC = 14 * 60;
const LAST_START_UTC = 28 * 60;

test("every possible kickoff has a scheduled run inside its before-first window", () => {
  const runs = scheduledRunMinutes();
  // Repeat the schedule across three days so a window that reaches back over
  // midnight still finds yesterday's last run.
  const timeline = [-1440, 0, 1440].flatMap((offset) =>
    runs.map((minute) => minute + offset),
  );

  const leads = STRATEGIC_ODDS_COMPETITIONS.flatMap((competition) =>
    competition.slots
      .filter((slot) => slot.kind === "before-first")
      .map((slot) => ({
        id: competition.id,
        lead: (slot as { leadMinutes: number }).leadMinutes,
      })),
  );

  for (const { id, lead } of leads) {
    assert.ok(
      lead <= REFRESH_MAX_GAP_MINUTES * 2,
      `${id} leads by ${lead} min, which is suspiciously far ahead of kickoff`,
    );
    for (let start = FIRST_START_UTC; start <= LAST_START_UTC; start += 15) {
      const covered = timeline.some(
        (run) => run >= start - lead && run < start,
      );
      assert.ok(
        covered,
        `${id}: a kickoff at ${String(Math.floor((start % 1440) / 60)).padStart(2, "0")}:` +
          `${String(start % 60).padStart(2, "0")} UTC has no run in its ${lead}-minute window — ` +
          `that competition would never refresh that day`,
      );
    }
  }
});

test("a competition is still due when the only run lands hours before kickoff", () => {
  // The concrete regression: MLB first pitch at 13:00 ET with the old 120-minute
  // lead, and runs at 12:00 and 16:00 ET. The window was [11:00, 13:00) and
  // neither run fell inside it, so MLB refreshed zero times that day.
  const mlb = STRATEGIC_ODDS_COMPETITIONS.find((c) => c.id === "mlb")!;
  const firstPitch = new Date("2026-08-15T17:00:00Z"); // 13:00 ET
  const noonEt = new Date("2026-08-15T16:00:00Z"); // 12:00 ET

  const due = dueRefreshSlots(mlb, [firstPitch], new Set(), noonEt);
  assert.ok(
    due.some((key) => key.endsWith(":pre-first")),
    "the 12:00 ET run must find MLB due before a 13:00 ET first pitch",
  );
});

test("a slot fires once per day however many runs see it as due", () => {
  const mlb = STRATEGIC_ODDS_COMPETITIONS.find((c) => c.id === "mlb")!;
  const firstPitch = new Date("2026-08-15T23:00:00Z"); // 19:00 ET
  const runs = [
    new Date("2026-08-15T20:00:00Z"), // 16:00 ET — inside the window
    new Date("2026-08-16T00:00:00Z"), // 20:00 ET — kickoff passed
  ];

  const completed = new Set<string>();
  let fired = 0;
  for (const now of runs) {
    for (const key of dueRefreshSlots(mlb, [firstPitch], completed, now)) {
      if (!key.endsWith(":pre-first")) continue;
      fired++;
      completed.add(key);
    }
  }
  assert.equal(fired, 1, "widening the lead must not buy repeat refreshes");
});
