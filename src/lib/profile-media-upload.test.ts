import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import test from "node:test";

test("upload action upserts CapperProfile and respects the verification gate policy", () => {
  const source = fs.readFileSync(
    path.join(process.cwd(), "src/lib/actions/profile-media.action.ts"),
    "utf8",
  );

  assert.match(source, /capperProfile\.upsert\(/);
  assert.match(source, /emailVerificationEnforced\(\)/);
  assert.doesNotMatch(
    source,
    /accountStatus !== "ACTIVE" \|\| !account\.emailVerified/,
    "upload must not block all unverified accounts when the verify gate is off",
  );
});

test("profile media editor accepts HEIC in the file picker", () => {
  const source = fs.readFileSync(
    path.join(process.cwd(), "src/components/scl/profile-media-editor.tsx"),
    "utf8",
  );

  assert.match(source, /image\/heic/);
  assert.match(source, /\.heic/);
});
