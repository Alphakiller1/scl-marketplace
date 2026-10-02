import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import test from "node:test";

const source = fs.readFileSync(
  path.join(process.cwd(), "src/lib/queries/admin-operations.ts"),
  "utf8",
);

test("active plays count every unresolved position independently of grading", () => {
  assert.match(source, /activeStraight \+ activeParlays/);
  assert.match(source, /outcome: "PENDING" as const/);
  assert.match(source, /status: "COMMITTED" as const/);
});

test("pending grades uses the same actionable queue as the grading page", () => {
  assert.match(source, /import \{ listGradingWorkQueue \}/);
  assert.match(source, /listGradingWorkQueue\(\)/);
  assert.match(source, /pendingGrades: gradingWorkQueue\.length/);
  assert.doesNotMatch(source, /eventStartsAt: \{ lt: now \}/);
});
