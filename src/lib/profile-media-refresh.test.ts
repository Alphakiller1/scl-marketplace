import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import test from "node:test";

test("profile media clears a prior image failure when an upload returns a new URL", () => {
  for (const file of ["capper-avatar.tsx", "capper-banner.tsx"]) {
    const source = fs.readFileSync(
      path.join(process.cwd(), "src/components/scl", file),
      "utf8",
    );
    assert.match(source, /failedSrc !== src/);
    assert.match(source, /setFailedSrc\(/);
  }
});

test("cover and profile upload buttons occupy separate vertical zones", () => {
  const source = fs.readFileSync(
    path.join(process.cwd(), "src/components/scl/profile-media-editor.tsx"),
    "utf8",
  );
  assert.match(source, /absolute top-3 right-3/);
  assert.doesNotMatch(source, /absolute right-3 bottom-3/);
});
