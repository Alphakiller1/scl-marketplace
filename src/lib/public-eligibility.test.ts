import assert from "node:assert/strict";
import { test } from "node:test";

import {
  isTestHandle,
  isValidPublicStake,
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

test("isValidPublicStake enforces 0.25U minimum", () => {
  assert.equal(isValidPublicStake(0.25), true);
  assert.equal(isValidPublicStake(0.24), false);
  assert.equal(isValidPublicStake(1), true);
});
