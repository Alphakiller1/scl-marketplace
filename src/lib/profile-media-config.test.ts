import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import test from "node:test";

test("next.config raises the Server Action body limit for profile media", () => {
  const source = fs.readFileSync(
    path.join(process.cwd(), "next.config.ts"),
    "utf8",
  );
  assert.match(source, /bodySizeLimit:\s*["']6mb["']/);
  assert.match(source, /www\.sportscappersleaderboard\.com/);
  assert.match(source, /allowedOrigins/);
});
