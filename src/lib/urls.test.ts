import assert from "node:assert/strict";
import test from "node:test";

import { safeHttpUrl, socialProfileUrl } from "@/lib/urls";

test("safeHttpUrl allows public HTTP links and normalizes them", () => {
  assert.equal(
    safeHttpUrl(" https://example.com/profile "),
    "https://example.com/profile",
  );
  assert.equal(safeHttpUrl("http://example.com"), "http://example.com/");
});

test("safeHttpUrl rejects unsafe protocols and embedded credentials", () => {
  assert.equal(safeHttpUrl("javascript:alert(1)"), null);
  assert.equal(safeHttpUrl("https://user:secret@example.com"), null);
  assert.equal(safeHttpUrl("not a url"), null);
});

test("socialProfileUrl treats handles as path data", () => {
  assert.equal(
    socialProfileUrl("https://x.com", "@chase.analytics"),
    "https://x.com/chase.analytics",
  );
});
