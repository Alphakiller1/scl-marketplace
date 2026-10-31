import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const migration = readFileSync(
  "prisma/migrations/20261031171000_repair_reduced_parlay_settlements/migration.sql",
  "utf8",
);

test("historical one-survivor parlays are repaired without touching overrides", () => {
  assert.match(migration, /p\."outcome" = 'VOID'/);
  assert.match(migration, /leg\."outcome" = 'WIN'\) = 1/);
  assert.match(migration, /NOT IN \('WIN', 'PUSH', 'VOID'\)/);
  assert.match(migration, /audit\."source" = 'AUTO'/);
  assert.match(migration, /"outcome" = 'WIN'/);
  assert.match(
    migration,
    /"combinedOddsAmerican" = repair\."effectiveOddsAmerican"/,
  );
  assert.match(migration, /"profitUnits" = repair\."newProfitUnits"/);
  assert.match(migration, /INSERT INTO scl\."ParlayGradingAudit"/);
});
