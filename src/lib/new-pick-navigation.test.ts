import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import test from "node:test";

test("same-route New Pick starts a fresh entry session", () => {
  const source = fs.readFileSync(
    path.join(process.cwd(), "src/components/app-nav.tsx"),
    "utf8",
  );
  assert.match(source, /pathname !== n\.href/);
  assert.match(source, /window\.location\.assign\(n\.href\)/);
});
