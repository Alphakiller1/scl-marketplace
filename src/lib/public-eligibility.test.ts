import assert from "node:assert/strict";
import { test } from "node:test";

import {
  hasQaNoteMarker,
  isExcludedFromPublicPublication,
  isTestHandle,
  isValidPublicStake,
  prismaExcludeTestHandles,
  PUBLIC_EXCLUDED_HANDLES,
} from "@/lib/public-eligibility";

test("isTestHandle matches qa and sclqa prefixes", () => {
  assert.equal(isTestHandle("qa_demo"), true);
  assert.equal(isTestHandle("SCLQA_test"), true);
  assert.equal(isTestHandle("real_capper"), false);
  assert.equal(isTestHandle(null), false);
});

test("isTestHandle excludes known public fixture handles", () => {
  for (const handle of PUBLIC_EXCLUDED_HANDLES) {
    assert.equal(isTestHandle(handle), true, handle);
    assert.equal(isTestHandle(`@${handle}`), true, `@${handle}`);
    assert.equal(isTestHandle(handle.toUpperCase()), true);
  }
  assert.equal(isTestHandle("demo_capper_real"), false);
});

test("hasQaNoteMarker flags QA fixtures, not genuine analysis", () => {
  // The exact leak this guard was written for.
  assert.equal(
    hasQaNoteMarker(
      "DISPOSABLE QA TEST - post-submit Ticket receipt verification - 2026-07-14",
    ),
    true,
  );
  assert.equal(hasQaNoteMarker("qa test"), true);
  assert.equal(hasQaNoteMarker("QA fixture — ignore"), true);
  assert.equal(hasQaNoteMarker("do not publish"), true);
  // Must NOT false-positive on plausible capper notes.
  assert.equal(hasQaNoteMarker("only bet disposable income"), false);
  assert.equal(hasQaNoteMarker("testing the waters on this line"), false);
  assert.equal(hasQaNoteMarker("sharp line, key number"), false);
  assert.equal(hasQaNoteMarker(null), false);
  assert.equal(hasQaNoteMarker(undefined), false);
});

test("solpickz QA fixture is excluded from public surfaces", () => {
  assert.equal(isTestHandle("solpickz"), true);
  assert.equal(isTestHandle("@solpickz"), true);
});

test("isValidPublicStake enforces 0.25U minimum", () => {
  assert.equal(isValidPublicStake(0.25), true);
  assert.equal(isValidPublicStake(0.24), false);
  assert.equal(isValidPublicStake(1), true);
});

test("isExcludedFromPublicPublication honors isTest over handle alone", () => {
  assert.equal(
    isExcludedFromPublicPublication({ username: "legit_capper", isTest: true }),
    true,
  );
  assert.equal(
    isExcludedFromPublicPublication({
      username: "legit_capper",
      isTest: false,
    }),
    false,
  );
  assert.equal(
    isExcludedFromPublicPublication({ username: "demo_capper", isTest: false }),
    true,
  );
});

test("prismaExcludeTestHandles adds isTest when column ready", () => {
  const without = prismaExcludeTestHandles();
  assert.ok("NOT" in without);
  assert.equal("AND" in without, false);

  const withCol = prismaExcludeTestHandles({ includeIsTestColumn: true });
  assert.ok("AND" in withCol);
  const and = withCol.AND as unknown[];
  assert.deepEqual(and[0], { isTest: false });
  assert.ok(and[1] && typeof and[1] === "object" && "NOT" in and[1]);
});
