import assert from "node:assert/strict";
import test from "node:test";

import {
  classifyLoginIdentifier,
  loginSchema,
  passwordResetRequestSchema,
  passwordSchema,
  resetPasswordSchema,
  sclExistingUsernameSchema,
  sclUsernameSchema,
  signupSchema,
} from "@/lib/schemas/auth.schema";

/*
 * The legacy importer accepts handles up to 30 characters; new signups are
 * capped at 20. Sign-in and recovery identify accounts that already exist, so
 * they have to accept the longer imported handles — otherwise an imported capper
 * is rejected at the form, before any lookup, and told their credentials are
 * wrong.
 */
const IMPORTED_LONG_HANDLE = "a".repeat(24);

test("an imported handle longer than the signup cap can still sign in and recover", () => {
  assert.equal(
    sclUsernameSchema.safeParse(IMPORTED_LONG_HANDLE).success,
    false,
  );
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
      username: IMPORTED_LONG_HANDLE,
      email: "capper@example.com",
    }).success,
    true,
  );
});

test("the longer allowance still enforces the floor, charset, and its own ceiling", () => {
  assert.equal(sclExistingUsernameSchema.safeParse("ab").success, false);
  assert.equal(
    sclExistingUsernameSchema.safeParse("bad-handle").success,
    false,
  );
  assert.equal(
    sclExistingUsernameSchema.safeParse("a".repeat(31)).success,
    false,
  );
  // Creating a new handle is unchanged — still capped at 20.
  assert.equal(sclUsernameSchema.safeParse("a".repeat(20)).success, true);
  assert.equal(sclUsernameSchema.safeParse("a".repeat(21)).success, false);
});

test("password contract requires at least 12 characters", () => {
  assert.equal(passwordSchema.safeParse("short-pass").success, false);
  assert.equal(passwordSchema.safeParse("long-passphrase").success, true);
});

test("password reset request normalizes surrounding whitespace", () => {
  const parsed = passwordResetRequestSchema.parse({
    username: " Chase_Analytics ",
    email: "  capper@example.com ",
  });

  assert.equal(parsed.username, "chase_analytics");
  assert.equal(parsed.email, "capper@example.com");
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
