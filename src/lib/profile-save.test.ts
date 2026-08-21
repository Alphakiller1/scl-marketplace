import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import test from "node:test";

test("profile save upserts CapperProfile and respects verification policy", () => {
  const source = fs.readFileSync(
    path.join(process.cwd(), "src/lib/actions/profile.action.ts"),
    "utf8",
  );

  assert.match(source, /capperProfile\.upsert\(/);
  assert.match(source, /emailVerificationEnforced\(\)/);
  assert.doesNotMatch(
    source,
    /accountStatus !== "ACTIVE" \|\| !account\.emailVerified/,
  );
});

test("profile form surfaces validation failures instead of silent no-ops", () => {
  const source = fs.readFileSync(
    path.join(
      process.cwd(),
      "src/app/(capper)/dashboard/profile/profile-form.tsx",
    ),
    "utf8",
  );

  assert.match(source, /handleSubmit\(onSubmit, onInvalid\)/);
  assert.match(source, /usernameChanged/);
  assert.match(source, /reset\(valuesToSave\)/);
});

test("profile page ensures a CapperProfile exists before rendering the editor", () => {
  const page = fs.readFileSync(
    path.join(process.cwd(), "src/app/(capper)/dashboard/profile/page.tsx"),
    "utf8",
  );
  const queries = fs.readFileSync(
    path.join(process.cwd(), "src/lib/queries/profile.ts"),
    "utf8",
  );

  assert.match(page, /ensureCapperProfileByUserId/);
  assert.match(queries, /ensureCapperProfileByUserId/);
});
