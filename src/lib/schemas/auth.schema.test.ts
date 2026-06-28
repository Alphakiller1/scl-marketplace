import assert from "node:assert/strict";
import test from "node:test";

import {
  passwordResetRequestSchema,
  passwordSchema,
  resetPasswordSchema,
  signupSchema,
} from "@/lib/schemas/auth.schema";

test("password contract requires at least 12 characters", () => {
  assert.equal(passwordSchema.safeParse("short-pass").success, false);
  assert.equal(passwordSchema.safeParse("long-passphrase").success, true);
});

test("password reset request normalizes surrounding whitespace", () => {
  const parsed = passwordResetRequestSchema.parse({
    email: "  capper@example.com ",
  });

  assert.equal(parsed.email, "capper@example.com");
});

test("signup normalizes public handles and email addresses", () => {
  const parsed = signupSchema.parse({
    displayName: " Chase Analytics ",
    username: " Chase_Analytics ",
    email: " CAPPPER@EXAMPLE.COM ",
    password: "long-passphrase",
    confirmPassword: "long-passphrase",
    acceptTerms: true,
  });

  assert.equal(parsed.displayName, "Chase Analytics");
  assert.equal(parsed.username, "chase_analytics");
  assert.equal(parsed.email, "cappper@example.com");
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
