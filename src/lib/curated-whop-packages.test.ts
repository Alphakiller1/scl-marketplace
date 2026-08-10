import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import path from "node:path";
import test from "node:test";

const migration = readFileSync(
  path.join(
    process.cwd(),
    "prisma/migrations/20260810204500_curate_whop_packages/migration.sql",
  ),
  "utf8",
);

test("curated Whop package migration locks verified checkout facts", () => {
  for (const fact of [
    "Super Picks 3-Day Free VIP Trial",
    "3 days free, then $49.99/month",
    "plan_WDBMS1kVzsn54",
    "Super Picks Monthly VIP",
    "plan_XQPxDbBRLRKM3",
    "Super Picks Single-Day VIP",
    "plan_sujbuYWnK69Cw",
    "Bankroll Blueprint Weekly VIP",
    "bankroll-blueprint-exclusive",
    "Inevitable Picks Weekly VIP",
    "plan_L2zzDCtIjiSIE",
  ]) {
    assert.ok(migration.includes(fact), `missing curated Whop fact: ${fact}`);
  }

  for (const pricing of [
    /Super Picks 3-Day Free VIP Trial[\s\S]*?"priceCents" = 4999[\s\S]*?"billingPeriod" = 'MONTH'[\s\S]*?plan_WDBMS1kVzsn54/,
    /migration-20260810-superpicks-monthly[\s\S]*?3999,\s*'MONTH',[\s\S]*?plan_XQPxDbBRLRKM3/,
    /Super Picks Single-Day VIP[\s\S]*?"priceCents" = 1499[\s\S]*?"billingPeriod" = 'ONE_TIME'[\s\S]*?plan_sujbuYWnK69Cw/,
    /Bankroll Blueprint Weekly VIP[\s\S]*?"priceCents" = 19900[\s\S]*?"billingPeriod" = 'WEEK'[\s\S]*?bankroll-blueprint-exclusive/,
    /migration-20260810-inevitable-weekly[\s\S]*?1499,\s*'WEEK',[\s\S]*?plan_L2zzDCtIjiSIE/,
  ]) {
    assert.match(migration, pricing);
  }
});

test("every curated offer receives or retains an SCL tracking destination", () => {
  assert.equal(
    (migration.match(/INSERT INTO scl\."TrackingUrl"/g) ?? []).length,
    5,
  );
  assert.match(migration, /UPDATE scl\."TrackingUrl" AS tracking/);
});
