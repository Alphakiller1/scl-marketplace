import assert from "node:assert/strict";
import test from "node:test";

import { meetsCurrentPasswordPolicy } from "@/lib/password-policy";

test("passwords carried over from the previous platform are measured against the current rules", () => {
  // Typical legacy passwords — short enough to fail today's minimum.
  assert.equal(meetsCurrentPasswordPolicy("oldpass1"), false);
  assert.equal(meetsCurrentPasswordPolicy("Winner2019!"), false);
  assert.equal(meetsCurrentPasswordPolicy(""), false);

  assert.equal(meetsCurrentPasswordPolicy("twelvechars1"), true);
  assert.equal(
    meetsCurrentPasswordPolicy("correct horse battery staple"),
    true,
  );
});

test("the policy tracks the shared password schema, including its ceiling", () => {
  assert.equal(meetsCurrentPasswordPolicy("a".repeat(11)), false);
  assert.equal(meetsCurrentPasswordPolicy("a".repeat(12)), true);
  assert.equal(meetsCurrentPasswordPolicy("a".repeat(100)), true);
  assert.equal(meetsCurrentPasswordPolicy("a".repeat(101)), false);
});
