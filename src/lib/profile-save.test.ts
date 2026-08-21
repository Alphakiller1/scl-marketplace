import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import test from "node:test";

const root = process.cwd();

function read(rel: string) {
  return fs.readFileSync(path.join(root, rel), "utf8");
}

test("profile save upserts CapperProfile and respects verification policy", () => {
  const source = read("src/lib/actions/profile.action.ts");

  assert.match(source, /capperProfile\.upsert\(/);
  assert.match(source, /emailVerificationEnforced\(\)/);
  assert.doesNotMatch(
    source,
    /accountStatus !== "ACTIVE" \|\| !account\.emailVerified/,
  );
});

test("profile save always writes User.username from the submitted handle", () => {
  const source = read("src/lib/actions/profile.action.ts");

  assert.match(
    source,
    /await tx\.user\.update\(\{\s*where: \{ id: account\.id \},\s*data: \{ username: nextUsername \},/,
  );
  assert.doesNotMatch(
    source,
    /if \(usernameChanged\) \{\s*await tx\.user\.update/,
  );
  assert.match(
    source,
    /username: \{ equals: nextUsername, mode: "insensitive" \}/,
  );
  assert.match(
    source,
    /unstable_update\(\{ user: \{ name: nextUsername \} \}\)/,
  );
});

test("JWT copies an updated handle so the session matches the saved username", () => {
  const source = read("src/auth.config.ts");
  const auth = read("src/auth.ts");

  assert.match(auth, /unstable_update/);
  assert.match(source, /trigger === "update"/);
  assert.match(source, /token\.name = name\.trim\(\)/);
});

test("profile form username field is editable and not a login autofill target", () => {
  const source = read("src/app/(capper)/dashboard/profile/profile-form.tsx");

  assert.match(source, /handleSubmit\(onSubmit, onInvalid\)/);
  assert.match(source, /usernameChanged/);
  assert.match(source, /reset\(valuesToSave\)/);
  assert.match(source, /\{\.\.\.register\("username"\)\}/);
  assert.match(source, /autoComplete="off"/);
  assert.doesNotMatch(source, /autoComplete="username"/);
  assert.doesNotMatch(source, /readOnly/);
  assert.doesNotMatch(source, /disabled=\{true\}/);
});

test("profile page remounts the editor from the saved handle", () => {
  const page = read("src/app/(capper)/dashboard/profile/page.tsx");
  const queries = read("src/lib/queries/profile.ts");

  assert.match(page, /ensureCapperProfileByUserId/);
  assert.match(page, /key=\{profile\.user\.username \?\? "no-handle"\}/);
  assert.match(queries, /ensureCapperProfileByUserId/);
});
