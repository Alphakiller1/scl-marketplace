import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { test } from "node:test";

const source = readFileSync(
  new URL("../components/scl/rank-board-table.tsx", import.meta.url),
  "utf8",
);

test("desktop rank links never use table-row-sized pseudo-element overlays", () => {
  assert.doesNotMatch(source, /after:absolute|after:inset-0/);
  assert.match(source, /Open rank \$\{rank\}, \$\{capper\.handle\} profile/);
});
