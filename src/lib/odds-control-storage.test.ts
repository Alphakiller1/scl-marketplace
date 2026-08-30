import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const schema = readFileSync("prisma/schema.prisma", "utf8");
const rolloutMigration = readFileSync(
  "prisma/migrations/20260829120000_add_odds_credit_controls/migration.sql",
  "utf8",
);
const completionMigration = readFileSync(
  "prisma/migrations/20260829230000_complete_odds_credit_dashboard/migration.sql",
  "utf8",
);
const migration = `${rolloutMigration}\n${completionMigration}`;
const oddsApi = readFileSync("src/lib/odds-api.ts", "utf8");

test("credit-control migration persists every dashboard source of truth", () => {
  for (const model of [
    "OddsControlConfig",
    "OddsSportControl",
    "OddsApiRun",
    "OddsControlAuditEvent",
    "OddsUsageMarketDaily",
  ]) {
    assert.match(schema, new RegExp(`model ${model} \\{`));
    assert.match(migration, new RegExp(`\"${model}\"`));
  }
  assert.match(schema, /perRunCreditLimit\s+Int/);
  assert.match(migration, /"perRunCreditLimit" INTEGER NOT NULL/);
  assert.match(completionMigration, /ADD COLUMN IF NOT EXISTS/);
});

test("market telemetry attributes the provider response cost without guessing", () => {
  assert.match(oddsApi, /x-requests-last/);
  assert.match(oddsApi, /persistOddsMarketUsageDaily/);
  assert.match(oddsApi, /date_purpose_sport_market/);
  assert.match(oddsApi, /"market_catalog"/);
});
