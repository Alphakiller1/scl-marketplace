import assert from "node:assert/strict";
import test from "node:test";

import { safeCallbackPath } from "@/lib/safe-redirect";

test("same-origin paths pass through unchanged", () => {
  assert.equal(safeCallbackPath("/admin"), "/admin");
  assert.equal(
    safeCallbackPath("/dashboard/picks?tab=open"),
    "/dashboard/picks?tab=open",
  );
});

test("absolute and protocol-relative URLs are rejected", () => {
  assert.equal(safeCallbackPath("https://evil.example/"), null);
  assert.equal(safeCallbackPath("//evil.example/"), null);
  assert.equal(safeCallbackPath("/\\evil.example/"), null);
  assert.equal(safeCallbackPath("javascript:alert(1)"), null);
});

test("missing callback urls fall back to the caller's default", () => {
  assert.equal(safeCallbackPath(null), null);
  assert.equal(safeCallbackPath(undefined), null);
  assert.equal(safeCallbackPath(""), null);
});
