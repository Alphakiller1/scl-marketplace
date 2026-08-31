import assert from "node:assert/strict";
import fs from "node:fs";
import test from "node:test";

import {
  verificationPolicyBlockReason,
  type VerificationPolicy,
} from "@/lib/odds-control";

const policy: VerificationPolicy = {
  enabled: true,
  dailyRequestLimit: 10,
  dailyCreditLimit: 50,
  maxCreditsPerRequest: 5,
  cacheMinutes: 30,
  overallDailyLimit: 100,
  overallWeeklyLimit: 500,
  overallMonthlyLimit: 1_000,
};

const now = new Date("2026-08-30T12:00:00.000Z");
const baseline = {
  requestsToday: 2,
  creditsToday: 10,
  allCreditsToday: 20,
  allCreditsWeek: 50,
  allCreditsMonth: 100,
  reservedCredits: 3,
  estimatedCredits: 4,
  providerRemaining: 100,
  providerBalanceUpdatedAt: now,
  now,
};

test("verification policy independently blocks disable, count, credit, and per-request limits", () => {
  assert.equal(verificationPolicyBlockReason(policy, baseline), null);
  assert.equal(
    verificationPolicyBlockReason({ ...policy, enabled: false }, baseline),
    "Owner-disabled verification.",
  );
  assert.equal(
    verificationPolicyBlockReason(policy, { ...baseline, requestsToday: 10 }),
    "Daily verification request limit reached.",
  );
  assert.equal(
    verificationPolicyBlockReason(policy, { ...baseline, creditsToday: 44 }),
    "Daily verification credit limit reached.",
  );
  assert.equal(
    verificationPolicyBlockReason(policy, { ...baseline, estimatedCredits: 6 }),
    "Per-verification credit limit exceeded.",
  );
  assert.equal(
    verificationPolicyBlockReason(policy, {
      ...baseline,
      allCreditsToday: 94,
    }),
    "Overall daily credit limit reached.",
  );
});

test("verification policy blocks an exhausted current provider balance", () => {
  assert.equal(
    verificationPolicyBlockReason(policy, {
      ...baseline,
      providerRemaining: 6,
    }),
    "Provider has insufficient remaining credits.",
  );
  assert.equal(
    verificationPolicyBlockReason(policy, {
      ...baseline,
      providerRemaining: 0,
      providerBalanceUpdatedAt: new Date("2026-08-29T11:59:59.999Z"),
    }),
    null,
  );
});

test("expanded boards are board usage and true checks request only needed markets", () => {
  const source = fs.readFileSync("src/lib/odds-api.ts", "utf8");
  const boardStart = source.indexOf("export async function fetchEventBoard");
  const boardEnd = source.indexOf(
    "async function pricedExpandedMarkets",
    boardStart,
  );
  assert.match(source.slice(boardStart, boardEnd), /purpose: "board"/);

  const verifyStart = source.indexOf("export async function verifyPick");
  const verifyEnd = source.indexOf(
    "export async function fetchLiveLine",
    verifyStart,
  );
  assert.match(
    source.slice(verifyStart, verifyEnd),
    /markets: params\.marketKeys/,
  );

  const liveStart = verifyEnd;
  const liveEnd = source.indexOf(
    "export async function fetchEventBoard",
    liveStart,
  );
  assert.match(source.slice(liveStart, liveEnd), /markets: params\.marketKeys/);
});
