import assert from "node:assert/strict";
import fs from "node:fs";
import test from "node:test";

import {
  easternLocalToUtc,
  nextRecurringVerificationAt,
  scheduledVerificationEstimate,
} from "@/lib/verification-schedule";
import { verificationScheduleInputSchema } from "@/lib/schemas/verification-schedule.schema";

test("one-time Eastern schedules convert correctly on both sides of DST", () => {
  assert.equal(
    easternLocalToUtc("2026-01-15", "09:30")?.toISOString(),
    "2026-01-15T14:30:00.000Z",
  );
  assert.equal(
    easternLocalToUtc("2026-07-15", "09:30")?.toISOString(),
    "2026-07-15T13:30:00.000Z",
  );
});

test("recurring schedules honor Eastern weekday and time", () => {
  const next = nextRecurringVerificationAt({
    after: new Date("2026-08-30T14:01:00.000Z"),
    timeOfDayMinutes: 10 * 60,
    daysOfWeek: [1],
  });
  assert.equal(next?.toISOString(), "2026-08-31T14:00:00.000Z");
});

test("slate verification estimates markets by every bounded event", () => {
  assert.equal(
    scheduledVerificationEstimate({
      markets: ["h2h", "spreads", "totals"],
      maxEvents: 20,
      surfaceCompetitionCount: 1,
    }),
    63,
  );
});

test("schedule input requires a league only for league scope", () => {
  const base = {
    name: "Monday slate",
    sport: "NFL",
    coverage: "SURFACE",
    maxEvents: 20,
    recurrence: "RECURRING",
    date: "",
    time: "09:00",
    daysOfWeek: [1],
  } as const;
  assert.equal(
    verificationScheduleInputSchema.safeParse({
      ...base,
      scope: "SLATE",
      league: "",
    }).success,
    true,
  );
  assert.equal(
    verificationScheduleInputSchema.safeParse({
      ...base,
      scope: "LEAGUE",
      league: "",
    }).success,
    false,
  );
});

test("fixed dispatcher securely claims database-backed verification schedules", () => {
  const route = fs.readFileSync(
    "src/app/api/cron/odds-dispatch/route.ts",
    "utf8",
  );
  const config = fs.readFileSync("vercel.json", "utf8");
  assert.match(route, /Bearer \$\{secret\}/);
  assert.match(route, /claimDueVerificationSchedule/);
  assert.match(route, /executeVerificationScheduleRun/);
  assert.match(config, /"schedule": "\*\/5 \* \* \* \*"/);
});

test("database rejects incomplete scope and recurrence records", () => {
  const migration = fs.readFileSync(
    "prisma/migrations/20260831030000_verification_schedules/migration.sql",
    "utf8",
  );
  assert.match(migration, /OddsVerificationSchedule_scope_fields_check/);
  assert.match(migration, /OddsVerificationSchedule_recurrence_fields_check/);
  assert.match(migration, /daysOfWeek" <@ ARRAY\[0,1,2,3,4,5,6\]/);
});
