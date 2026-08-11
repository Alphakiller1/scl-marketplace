import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";
import { test } from "node:test";

const playAction = readFileSync(
  new URL("./actions/play.action.ts", import.meta.url),
  "utf8",
);
const parlayAction = readFileSync(
  new URL("./actions/parlay.action.ts", import.meta.url),
  "utf8",
);
const unifiedEntry = readFileSync(
  new URL("../components/scl/unified-pick-entry.tsx", import.meta.url),
  "utf8",
);
const betSlip = readFileSync(
  new URL("../components/scl/bet-slip.tsx", import.meta.url),
  "utf8",
);

test("straight and bulk pick submission never call or import the odds provider", () => {
  assert.doesNotMatch(playAction, /from ["']@\/lib\/odds-api["']/);
  assert.doesNotMatch(playAction, /\b(?:fetchLiveLine|verifyPick)\s*\(/);
  assert.match(playAction, /confirmBoardSelection\s*\(/);
  assert.match(playAction, /verify:\s*null/);
  assert.match(playAction, /oddsAmerican:\s*d\.oddsAmerican/);
  assert.match(playAction, /selectedOddsAmerican:\s*d\.oddsAmerican/);
});

test("parlay submission never calls or imports the odds provider", () => {
  assert.doesNotMatch(parlayAction, /from ["']@\/lib\/odds-api["']/);
  assert.doesNotMatch(parlayAction, /\b(?:fetchLiveLine|verifyPick)\s*\(/);
  assert.match(parlayAction, /confirmBoardSelection\s*\(/);
  assert.match(parlayAction, /verify:\s*null/);
  assert.match(parlayAction, /oddsAmerican:\s*l\.oddsAmerican/);
  assert.match(parlayAction, /selectedOddsAmerican:\s*l\.oddsAmerican/);
});

test("pick entry has no odds-movement confirmation or unavailable-line blocker", () => {
  assert.doesNotMatch(
    unifiedEntry,
    /needsConfirm|acceptedMoves|MovedLinePayload/,
  );
  assert.doesNotMatch(betSlip, /LineMovedPrompt|hasPrompt|movedLines/);
  assert.equal(
    existsSync(
      new URL("../components/scl/line-moved-prompt.tsx", import.meta.url),
    ),
    false,
  );
});
