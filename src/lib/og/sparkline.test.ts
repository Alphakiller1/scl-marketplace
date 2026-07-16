import assert from "node:assert/strict";
import { test } from "node:test";

import { buildSparklinePath } from "@/lib/og/sparkline";

test("sparkline path starts with M and uses L segments", () => {
  const { d, strokeTone, lastX, lastY } = buildSparklinePath(
    [0, 1.5, 0.5, 3],
    100,
    40,
    4,
  );
  assert.match(d, /^M/);
  assert.ok(d.includes(" L"));
  assert.equal(strokeTone, "win");
  assert.ok(Number.isFinite(lastX));
  assert.ok(Number.isFinite(lastY));
});

test("sparkline marks loss tone when cumulative ends below start", () => {
  const { strokeTone } = buildSparklinePath([0, -1, -2], 100, 40);
  assert.equal(strokeTone, "loss");
});

test("empty points still produce a flat path", () => {
  const { d, strokeTone } = buildSparklinePath([], 100, 40);
  assert.match(d, /^M/);
  assert.equal(strokeTone, "flat");
});
