import assert from "node:assert/strict";
import test from "node:test";

import {
  bareHandle,
  formatHandle,
  identityDisplayLines,
  identityDisplayLinesFromCapper,
  identityKeysEqual,
  looksLikeEmail,
  normalizeIdentityKey,
} from "@/lib/identity";

test("formatHandle enforces a single leading @", () => {
  assert.equal(formatHandle("battle"), "@battle");
  assert.equal(formatHandle("@battle"), "@battle");
  assert.equal(formatHandle("@@battle"), "@battle");
  assert.equal(formatHandle("  @Sharp_Signals  "), "@Sharp_Signals");
  assert.equal(formatHandle(""), null);
  assert.equal(formatHandle(null), null);
  assert.equal(formatHandle("   "), null);
});

test("formatHandle and bareHandle never surface emails", () => {
  assert.equal(looksLikeEmail("user@example.com"), true);
  assert.equal(formatHandle("user@example.com"), null);
  assert.equal(bareHandle("user@example.com"), null);
  assert.equal(formatHandle("@user@example.com"), null);
});

test("identityKeysEqual compares casing and @ prefixes", () => {
  assert.equal(identityKeysEqual("Battle", "battle"), true);
  assert.equal(identityKeysEqual("Battle", "@battle"), true);
  assert.equal(identityKeysEqual("Sharp Signals", "sharp-signals"), true);
  assert.equal(identityKeysEqual("Sharp Signals", "sharpsignals"), true);
  assert.equal(identityKeysEqual("Sharp Signals", "gridironedge"), false);
  assert.equal(normalizeIdentityKey("@Battle!!"), "battle");
});

test("identityDisplayLines prefers display name with @handle secondary", () => {
  assert.deepEqual(
    identityDisplayLines({
      displayName: "Sharp Signals",
      handle: "sharpsignals",
    }),
    { primary: "Sharp Signals", secondary: "@sharpsignals" },
  );
});

test("identityDisplayLines uses @handle only when display name is missing", () => {
  assert.deepEqual(
    identityDisplayLines({ displayName: null, handle: "battle" }),
    { primary: "@battle", secondary: null },
  );
  assert.deepEqual(
    identityDisplayLines({ displayName: "   ", handle: "@@battle" }),
    { primary: "@battle", secondary: null },
  );
});

test("identityDisplayLines uses display name only when handle is missing", () => {
  assert.deepEqual(
    identityDisplayLines({ displayName: "Chase Analytics", handle: null }),
    { primary: "Chase Analytics", secondary: null },
  );
});

test("identityDisplayLines never shows email as public identity", () => {
  assert.deepEqual(
    identityDisplayLines({
      displayName: "user@example.com",
      handle: "chase",
    }),
    { primary: "@chase", secondary: null },
  );
  assert.deepEqual(
    identityDisplayLines({
      displayName: "Chase",
      handle: "user@example.com",
    }),
    { primary: "Chase", secondary: null },
  );
  assert.deepEqual(
    identityDisplayLines({
      displayName: "user@example.com",
      handle: "also@example.com",
    }),
    { primary: "SCL Capper", secondary: null },
  );
});

test("identityDisplayLines collapses near-duplicates in compact mode", () => {
  assert.deepEqual(
    identityDisplayLines({
      displayName: "Battle",
      handle: "battle",
      compact: true,
    }),
    { primary: "Battle", secondary: null },
  );
  assert.deepEqual(
    identityDisplayLines({
      displayName: "Battle",
      handle: "battle",
      compact: false,
    }),
    { primary: "Battle", secondary: "@battle" },
  );
});

test("identityDisplayLinesFromCapper infers missing displayName when name≈handle", () => {
  assert.deepEqual(
    identityDisplayLinesFromCapper(
      { name: "battle", handle: "battle" },
      { compact: true },
    ),
    { primary: "@battle", secondary: null },
  );
  assert.deepEqual(
    identityDisplayLinesFromCapper(
      { name: "Sharp Signals", handle: "sharpsignals", displayName: null },
      { compact: true },
    ),
    { primary: "@sharpsignals", secondary: null },
  );
  assert.deepEqual(
    identityDisplayLinesFromCapper({
      name: "Sharp Signals",
      handle: "sharpsignals",
      displayName: "Sharp Signals",
    }),
    { primary: "Sharp Signals", secondary: "@sharpsignals" },
  );
});
