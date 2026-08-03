import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { test } from "node:test";

const source = readFileSync(
  new URL("../app/layout.tsx", import.meta.url),
  "utf8",
);

test("the app defaults to dark mode without using the system preference", () => {
  assert.match(source, /defaultTheme="dark"/);
  assert.match(source, /enableSystem=\{false\}/);
});
