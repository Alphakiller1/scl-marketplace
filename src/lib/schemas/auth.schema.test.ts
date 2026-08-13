import assert from "node:assert/strict";
import test from "node:test";

import {
  classifyLoginIdentifier,
  loginSchema,
  passwordResetRequestSchema,
  passwordSchema,
  resetPasswordSchema,
  SCL_USERNAME_MAX_LENGTH,
  sclExistingUsernameSchema,
  sclUsernameSchema,
  signupSchema,
} from "@/lib/schemas/auth.schema";

/*
 * Signup and sign-in now share one 30-character ceiling, which is what the
 * legacy importer and extractor always accepted. Before, signup capped at 20
 * while imported cappers ran to 30, so an imported capper was rejected at the
 * form before any lookup and told their credentials were wrong.
 */
const IMPORTED_LONG_HANDLE = "a".repeat(24);

test("a 24-character imported handle works for signup, sign-in and recovery", () => {
  assert.equal(sclUsernameSchema.safeParse(IMPORTED_LONG_HANDLE).success, true);
  assert.equal(
    sclExistingUsernameSchema.safeParse(IMPORTED_LONG_HANDLE).success,
    true,
  );

  const login = loginSchema.safeParse({
    identifier: `@${IMPORTED_LONG_HANDLE.toUpperCase()}`,
    password: "oldpass1",
  });
  assert.equal(login.success, true);
  assert.equal(login.data?.identifier, IMPORTED_LONG_HANDLE);

  assert.equal(
    passwordResetRequestSchema.safeParse({
      identifier: IMPORTED_LONG_HANDLE,
    }).success,
    true,
  );
});

test("both schemas enforce the same floor, charset, and ceiling", () => {
  for (const schema of [sclUsernameSchema, sclExistingUsernameSchema]) {
    assert.equal(schema.safeParse("ab").success, false);
    assert.equal(schema.safeParse("bad-handle").success, false);
    assert.equal(
      schema.safeParse("a".repeat(SCL_USERNAME_MAX_LENGTH)).success,
      true,
    );
    assert.equal(
      schema.safeParse("a".repeat(SCL_USERNAME_MAX_LENGTH + 1)).success,
      false,
    );
  }
  assert.equal(SCL_USERNAME_MAX_LENGTH, 30);
});

test("password contract requires at least 12 characters", () => {
  assert.equal(passwordSchema.safeParse("short-pass").success, false);
  assert.equal(passwordSchema.safeParse("long-passphrase").success, true);
});

test("password reset takes the same single identifier as sign-in", () => {
  // Whichever half of the old email+username pair they remember now works on
  // its own — demanding both is what made reset mail silently never send.
  assert.equal(
    passwordResetRequestSchema.parse({ identifier: " @Chase_Analytics " })
      .identifier,
    "chase_analytics",
  );
  assert.equal(
    passwordResetRequestSchema.parse({ identifier: "  Capper@Example.com " })
      .identifier,
    "capper@example.com",
  );
  assert.equal(
    passwordResetRequestSchema.safeParse({ identifier: "" }).success,
    false,
  );
});

test("login takes one identifier — a username or an email — plus a password", () => {
  // A handle, with or without the leading @, normalized the way it is stored.
  assert.equal(
    loginSchema.parse({ identifier: "@Capper_One", password: "secret" })
      .identifier,
    "capper_one",
  );
  // An email, trimmed and lowercased.
  assert.equal(
    loginSchema.parse({
      identifier: " CAPPPER@EXAMPLE.COM ",
      password: "secret",
    }).identifier,
    "cappper@example.com",
  );

  // The `@` that decides which is the one *inside* the address, not a leading
  // handle prefix.
  assert.equal(classifyLoginIdentifier("@capper_one"), "username");
  assert.equal(classifyLoginIdentifier("capper_one"), "username");
  assert.equal(classifyLoginIdentifier("capper@example.com"), "email");
  assert.equal(classifyLoginIdentifier("@capper@example.com"), "email");
});

test("login rejects an identifier that is neither a valid handle nor an email", () => {
  for (const identifier of ["", "  ", "ab", "bad-handle", "not@an@@email"]) {
    assert.equal(
      loginSchema.safeParse({ identifier, password: "secret" }).success,
      false,
      `expected ${JSON.stringify(identifier)} to be rejected`,
    );
  }
  assert.equal(
    loginSchema.safeParse({ identifier: "capper_one", password: "" }).success,
    false,
  );
});

test("signup normalizes public handles and email addresses", () => {
  const parsed = signupSchema.parse({
    username: " Chase_Analytics ",
    email: " CAPPPER@EXAMPLE.COM ",
    password: "long-passphrase",
    confirmPassword: "long-passphrase",
    confirmEligibility: true,
    acceptPolicies: true,
    acknowledgeResponsibleGaming: true,
  });

  assert.equal(parsed.username, "chase_analytics");
  assert.equal(parsed.email, "cappper@example.com");
});

test("scl username schema strips a leading @ and lowercases", () => {
  assert.equal(sclUsernameSchema.parse("@Chase_Analytics"), "chase_analytics");
  assert.equal(sclUsernameSchema.safeParse("ab").success, false);
  assert.equal(sclUsernameSchema.safeParse("bad-handle").success, false);
});

test("signup requires every legal and responsible-gaming acknowledgement", () => {
  const base = {
    username: "policy_ready",
    email: "policy@example.com",
    password: "long-passphrase",
    confirmPassword: "long-passphrase",
    confirmEligibility: true,
    acceptPolicies: true,
    acknowledgeResponsibleGaming: true,
  };

  for (const field of [
    "confirmEligibility",
    "acceptPolicies",
    "acknowledgeResponsibleGaming",
  ] as const) {
    assert.equal(
      signupSchema.safeParse({ ...base, [field]: false }).success,
      false,
    );
  }
});

test("password reset requires a valid token and matching passwords", () => {
  const token = "a".repeat(64);

  assert.equal(
    resetPasswordSchema.safeParse({
      token,
      password: "long-passphrase",
      confirmPassword: "different-passphrase",
    }).success,
    false,
  );
  assert.equal(
    resetPasswordSchema.safeParse({
      token,
      password: "long-passphrase",
      confirmPassword: "long-passphrase",
    }).success,
    true,
  );
});
