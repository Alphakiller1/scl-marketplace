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
  assert.match(source, /currentEmail: current\.email/);
  assert.match(source, /handle occupant lookup failed/);
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

test("JWT can copy an updated handle after Save, but Save must not call it", () => {
  const source = read("src/auth.config.ts");
  const auth = read("src/auth.ts");
  const action = read("src/lib/actions/profile.action.ts");

  assert.match(auth, /unstable_update/);
  assert.match(source, /trigger === "update"/);
  assert.match(source, /token\.name = name\.trim\(\)/);
  assert.doesNotMatch(
    action,
    /unstable_update/,
    "session cookie writes were failing the Server Action after the handle already saved",
  );
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
  assert.match(source, /id="scl-public-handle"/);
  assert.match(source, /data-form-type="other"/);
  assert.doesNotMatch(source, /id="username"/);
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

test("a taken canonical spelling cannot block a capper who kept their handle", () => {
  const source = read("src/lib/actions/profile.action.ts");

  // The write stays unconditional — skipping it is what made Save look like a
  // no-op for mixed-case rows. The conflict is what gets classified.
  assert.match(source, /data: \{ username: nextUsername \}/);
  // A real rename onto somebody else's handle is still refused.
  assert.match(
    source,
    /if \(usernameChanged\) \{\s*return \{ ok: false, error: HANDLE_TAKEN_MESSAGE \};/,
  );
  // A collision while only folding the stored spelling is survivable.
  assert.match(source, /canonicalHandleRefused = true/);
  assert.match(source, /const savedUsername =/);
  // What the caller is told, and what gets revalidated, is what is on the row.
  assert.match(source, /username: savedUsername/);
  assert.match(
    source,
    /revalidateProfileSurfaces\(currentUsername, savedUsername\)/,
  );
});

test("public profile lookup resolves handles that differ only by case", () => {
  const source = read("src/lib/queries/capper.ts");

  // findFirst returned an arbitrary row when two handles folded together, so
  // one of the two live accounts was unreachable at its own URL.
  assert.doesNotMatch(
    source,
    /capperProfile\.findFirst\(\{\s*where: \{\s*user: \{\s*username: \{ equals: normalizedHandle/,
  );
  assert.match(
    source,
    /const requestedHandle = handle\.replace\(\/\^@\+\/, ""\)\.trim\(\)/,
  );
  assert.match(
    source,
    /matches\.find\(\(match\) => match\.user\.username === requestedHandle\)/,
  );
});

test("libvips ships with the functions that resize profile media", () => {
  const config = read("next.config.ts");

  // sharp is auto-externalised by Next, so its native binary is only present
  // if tracing is told to include it. Without this every upload died with
  // ERR_DLOPEN_FAILED and blamed the capper's photo.
  assert.match(config, /outputFileTracingIncludes/);
  assert.match(
    config,
    /"\/dashboard\/profile": \["\.\/node_modules\/@img\/\*\*\/\*"\]/,
  );
  assert.match(config, /"\/api\/\*": \["\.\/node_modules\/@img\/\*\*\/\*"\]/);
});
