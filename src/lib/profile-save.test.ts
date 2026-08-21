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

test("profile save writes User.username independently of CapperProfile upsert", () => {
  const source = read("src/lib/actions/profile.action.ts");

  assert.match(source, /data: \{ username: nextUsername \}/);
  assert.doesNotMatch(
    source,
    /if \(usernameChanged\) \{\s*await tx\.user\.update/,
  );
  assert.match(source, /decideHandleCollision/);
  assert.match(source, /parkedReleasedHandle/);
  assert.match(source, /afterResponse/);
  assert.match(source, /username: \{ equals: username, mode: "insensitive"/);
  // Handle write and profile upsert must not share a transaction — a profile
  // column error used to roll back the rename and toast the generic save error.
  const upsertIndex = source.indexOf("capperProfile.upsert");
  const transactionIndex = source.lastIndexOf("$transaction", upsertIndex);
  const usernameWriteIndex = source.indexOf("data: { username: nextUsername }");
  assert.ok(upsertIndex > 0 && usernameWriteIndex > 0);
  assert.ok(
    usernameWriteIndex < upsertIndex,
    "username write must run before CapperProfile upsert",
  );
  assert.ok(
    transactionIndex > 0 && transactionIndex < usernameWriteIndex,
    "username write stays in its own transaction",
  );
  assert.ok(
    source.indexOf("$transaction", usernameWriteIndex) === -1 ||
      source.indexOf("$transaction", usernameWriteIndex) > upsertIndex,
    "CapperProfile upsert must not join the username transaction",
  );
});

test("JWT copies an updated handle so the session matches the saved username", () => {
  const source = read("src/auth.config.ts");
  const auth = read("src/auth.ts");
  const action = read("src/lib/actions/profile.action.ts");

  assert.match(auth, /unstable_update/);
  assert.match(source, /trigger === "update"/);
  assert.match(source, /token\.name = name\.trim\(\)/);
  assert.match(
    action,
    /unstable_update\(\{ user: \{ name: nextUsername \} \}\)/,
  );
  assert.match(action, /session username update failed/);
});

test("a failed session or cache bust cannot fail a handle that already wrote", () => {
  const source = read("src/lib/actions/profile.action.ts");
  assert.match(
    source,
    /afterResponse\(async \(\) => \{\s*revalidateProfileSurfaces/,
  );
  assert.match(source, /profile fields save failed[\s\S]*ok: true/);
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
