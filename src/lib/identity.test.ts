import assert from "node:assert/strict";
import { test } from "node:test";

import {
  bareHandle,
  formatHandle,
  identityDisplayLines,
  identityDisplayLinesFromCapper,
  identityKeysEqual,
  looksLikeEmail,
  normalizeIdentityKey,
} from "@/lib/identity";

test("looksLikeEmail detects addresses", () => {
  assert.equal(looksLikeEmail("user@example.com"), true);
  assert.equal(looksLikeEmail("not-an-email"), false);
  assert.equal(looksLikeEmail(null), false);
});

test("bareHandle strips @ and rejects email", () => {
  assert.equal(bareHandle("@battle"), "battle");
  assert.equal(bareHandle("@@battle"), "battle");
  assert.equal(bareHandle("user@example.com"), null);
  assert.equal(bareHandle("  "), null);
});

test("formatHandle normalizes to one @", () => {
  assert.equal(formatHandle("battle"), "@battle");
  assert.equal(formatHandle("@battle"), "@battle");
  assert.equal(formatHandle("user@example.com"), null);
});

test("normalizeIdentityKey / identityKeysEqual", () => {
  assert.equal(normalizeIdentityKey("@Battle!"), "battle");
  assert.equal(identityKeysEqual("Battle", "@battle"), true);
  assert.equal(identityKeysEqual("a", "b"), false);
});

test("identityDisplayLines is username-only (ignores displayName)", () => {
  assert.deepEqual(
    identityDisplayLines({
      displayName: "Sharp Signals",
      handle: "sharpsignals",
    }),
    { primary: "@sharpsignals", secondary: null },
  );
  assert.deepEqual(
    identityDisplayLines({ displayName: null, handle: "battle" }),
    { primary: "@battle", secondary: null },
  );
  assert.deepEqual(
    identityDisplayLines({ displayName: "Chase Analytics", handle: null }),
    { primary: "", secondary: null },
  );
  assert.deepEqual(
    identityDisplayLines({
      displayName: "user@example.com",
      handle: "user@example.com",
    }),
    { primary: "", secondary: null },
  );
});

test("identityDisplayLinesFromCapper uses handle, never displayName", () => {
  assert.deepEqual(
    identityDisplayLinesFromCapper({
      name: "Sharp Signals",
      handle: "sharpsignals",
      displayName: "Sharp Signals",
    }),
    { primary: "@sharpsignals", secondary: null },
  );
  assert.deepEqual(
    identityDisplayLinesFromCapper({
      name: "battle",
      handle: "battle",
      displayName: null,
    }),
    { primary: "@battle", secondary: null },
  );
});
